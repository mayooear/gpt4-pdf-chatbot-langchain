/**
 * This file implements a custom chat route for handling streaming responses on Vercel production.
 * It processes incoming chat requests, interacts with a language model and vector store,
 * and returns responses in a streaming format. The route also handles rate limiting,
 * input validation, and error handling. It supports different collections and media types,
 * and can optionally save responses to Firestore for non-private sessions.
 */

// We have to use a custom chat route because that's how we can get streaming on Vercel production,
// per https://vercel.com/docs/functions/streaming/quickstart
//
// TODO: wrap this in apiMiddleware
//
import { NextRequest, NextResponse } from 'next/server';
import { Document } from 'langchain/document';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { makeChain } from '@/utils/server/makechain';
import { getPineconeClient } from '@/utils/server/pinecone-client';
import { getPineconeIndexName } from '@/config/pinecone';
import * as fbadmin from 'firebase-admin';
import { db } from '@/services/firebase';
import { getAnswersCollectionName } from '@/utils/server/firestoreUtils';
import { Index, RecordMetadata } from '@pinecone-database/pinecone';
import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { loadSiteConfigSync } from '@/utils/server/loadSiteConfig';
import validator from 'validator';
import { genericRateLimiter } from '@/utils/server/genericRateLimiter';
import { SiteConfig } from '@/types/siteConfig';
import { StreamingResponseData } from '@/types/StreamingResponseData';

export const runtime = 'nodejs';
export const maxDuration = 240;

interface ChatRequestBody {
  collection: string;
  question: string;
  history: [string, string][];
  privateSession: boolean;
  mediaTypes: Record<string, boolean>;
}

async function validateAndPreprocessInput(req: NextRequest): Promise<
  | {
      sanitizedInput: ChatRequestBody;
      originalQuestion: string;
    }
  | NextResponse
> {
  // Parse and validate request body
  let requestBody: ChatRequestBody;
  try {
    requestBody = await req.json();
    console.log('Request body:', JSON.stringify(requestBody));
  } catch (error) {
    console.error('Error parsing request body:', error);
    console.log('Raw request body:', await req.text());
    return NextResponse.json(
      { error: 'Invalid JSON in request body' },
      { status: 400 },
    );
  }

  const { collection, question } = requestBody;

  // Validate question length
  if (
    typeof question !== 'string' ||
    !validator.isLength(question, { min: 1, max: 4000 })
  ) {
    return NextResponse.json(
      { error: 'Invalid question. Must be between 1 and 4000 characters.' },
      { status: 400 },
    );
  }

  const originalQuestion = question;
  // Sanitize the input to prevent XSS attacks
  const sanitizedQuestion = validator
    .escape(question.trim())
    .replaceAll('\n', ' ');

  // Validate collection
  if (
    typeof collection !== 'string' ||
    !['master_swami', 'whole_library'].includes(collection)
  ) {
    return NextResponse.json(
      { error: 'Invalid collection provided' },
      { status: 400 },
    );
  }

  return {
    sanitizedInput: {
      ...requestBody,
      question: sanitizedQuestion,
    },
    originalQuestion,
  };
}

async function applyRateLimiting(
  req: NextRequest,
  siteConfig: SiteConfig,
): Promise<NextResponse | null> {
  const isAllowed = await genericRateLimiter(
    req,
    null,
    {
      windowMs: 24 * 60 * 60 * 1000, // 24 hours
      max: siteConfig.queriesPerUserPerDay,
      name: 'query',
    },
    req.ip,
  );

  if (!isAllowed) {
    return NextResponse.json(
      { error: 'Daily query limit reached. Please try again tomorrow.' },
      { status: 429 },
    );
  }

  return null; // Rate limiting passed
}

// Define a custom type for our filter structure
type PineconeFilter = {
  $and: Array<{
    [key: string]: {
      $in: string[];
    };
  }>;
};

async function setupPineconeAndFilter(
  collection: string,
  mediaTypes: Record<string, boolean>,
  siteConfig: SiteConfig,
): Promise<{ index: Index<RecordMetadata>; filter: PineconeFilter }> {
  // Initialize Pinecone client and index
  const pinecone = await getPineconeClient();
  const index = pinecone.Index(
    getPineconeIndexName() || '',
  ) as Index<RecordMetadata>;

  // Set up filter for vector search
  const filter: PineconeFilter = {
    $and: [{ type: { $in: [] } }],
  };

  // Add author filter for 'master_swami' collection if configured
  // TODO: Move author filters into config.json
  if (
    collection === 'master_swami' &&
    siteConfig.collectionConfig?.master_swami
  ) {
    filter.$and.push({
      author: { $in: ['Paramhansa Yogananda', 'Swami Kriyananda'] },
    });
  }

  // Add library filter based on site configuration
  if (siteConfig.includedLibraries) {
    filter.$and.push({ library: { $in: siteConfig.includedLibraries } });
  }

  // Set up media type filters
  const enabledMediaTypes = siteConfig.enabledMediaTypes || [
    'text',
    'audio',
    'youtube',
  ];

  enabledMediaTypes.forEach((type) => {
    if (mediaTypes[type]) {
      filter.$and[0].type.$in.push(type);
    }
  });

  if (filter.$and[0].type.$in.length === 0) {
    filter.$and[0].type.$in = enabledMediaTypes;
  }

  return { index, filter };
}

async function setupVectorStoreAndRetriever(
  index: Index<RecordMetadata>,
  filter: PineconeFilter,
  sendData: (data: {
    token?: string;
    sourceDocs?: Document[];
    done?: boolean;
    error?: string;
    docId?: string;
  }) => void,
): Promise<{
  vectorStore: PineconeStore;
  retriever: ReturnType<PineconeStore['asRetriever']>;
  documentPromise: Promise<Document[]>;
}> {
  // Initialize vector store with Pinecone
  const vectorStore = await PineconeStore.fromExistingIndex(
    new OpenAIEmbeddings({}),
    {
      pineconeIndex: index,
      textKey: 'text',
      filter: filter,
    },
  );

  // Set up promise to resolve with retrieved documents
  let resolveWithDocuments: (value: Document[]) => void;
  const documentPromise = new Promise<Document[]>((resolve) => {
    resolveWithDocuments = resolve;
  });

  // Create retriever with callback to send source documents
  const retriever = vectorStore.asRetriever({
    callbacks: [
      {
        handleRetrieverEnd(docs: Document[]) {
          resolveWithDocuments(docs);
          sendData({ sourceDocs: docs });
        },
      } as Partial<BaseCallbackHandler>,
    ],
  });

  return { vectorStore, retriever, documentPromise };
}

// This function executes the language model chain and handles the streaming response
async function setupAndExecuteLanguageModelChain(
  retriever: ReturnType<PineconeStore['asRetriever']>,
  sanitizedQuestion: string,
  history: [string, string][],
  sendData: (data: StreamingResponseData) => void,
): Promise<string> {
  // Create language model chain
  const chain = await makeChain(retriever);

  // Format chat history for the language model
  const pastMessages = history
    .map((message: [string, string]) => {
      return [`Human: ${message[0]}`, `Assistant: ${message[1]}`].join('\n');
    })
    .join('\n');

  let fullResponse = '';

  // Invoke the chain with callbacks for streaming tokens
  const chainPromise = chain.invoke(
    {
      question: sanitizedQuestion,
      chat_history: pastMessages,
    },
    {
      callbacks: [
        {
          // Callback for handling new tokens from the language model
          handleLLMNewToken(token: string) {
            fullResponse += token;
            sendData({ token });
          },
          // Callback for handling the end of the chain execution
          handleChainEnd() {
            sendData({ done: true });
          },
        } as Partial<BaseCallbackHandler>,
      ],
    },
  );

  // Wait for the chain to complete
  await chainPromise;

  return fullResponse;
}

// Function to save the answer and related information to Firestore
async function saveAnswerToFirestore(
  originalQuestion: string,
  fullResponse: string,
  collection: string,
  promiseDocuments: Document[],
  history: [string, string][],
  clientIP: string,
): Promise<string> {
  const answerRef = db.collection(getAnswersCollectionName());
  const answerEntry = {
    question: originalQuestion,
    answer: fullResponse,
    collection: collection,
    sources: JSON.stringify(promiseDocuments),
    likeCount: 0,
    history: history.map((messagePair: [string, string]) => ({
      question: messagePair[0],
      answer: messagePair[1],
    })),
    ip: clientIP,
    timestamp: fbadmin.firestore.FieldValue.serverTimestamp(),
  };
  const docRef = await answerRef.add(answerEntry);
  return docRef.id;
}

// Function for handling errors and sending appropriate error messages
function handleError(
  error: unknown,
  sendData: (data: StreamingResponseData) => void,
) {
  console.error('Error in chat route:', error);
  if (error instanceof Error) {
    // Handle specific error cases
    if (error.name === 'PineconeNotFoundError') {
      console.error('Pinecone index not found:', getPineconeIndexName());
      sendData({
        error:
          'The specified Pinecone index does not exist. Please notify your administrator.',
      });
    } else if (error.message.includes('429')) {
      // Log the first 10 characters of the API key for debugging purposes
      console.log(
        'First 10 chars of OPENAI_API_KEY:',
        process.env.OPENAI_API_KEY?.substring(0, 10),
      );
      sendData({
        error:
          'The site has exceeded its current quota with OpenAI, please tell an admin to check the plan and billing details.',
      });
    } else {
      sendData({ error: error.message || 'Something went wrong' });
    }
  } else {
    sendData({ error: 'An unknown error occurred' });
  }
}

// Main POST handler for the chat API
export async function POST(req: NextRequest) {
  // Validate and preprocess the input
  const validationResult = await validateAndPreprocessInput(req);
  if (validationResult instanceof NextResponse) {
    return validationResult;
  }

  const { sanitizedInput, originalQuestion } = validationResult;

  // Load site configuration
  const siteConfig = loadSiteConfigSync();
  if (!siteConfig) {
    return NextResponse.json(
      { error: 'Failed to load site configuration' },
      { status: 500 },
    );
  }

  // Apply rate limiting
  const rateLimitResult = await applyRateLimiting(req, siteConfig);
  if (rateLimitResult) {
    return rateLimitResult;
  }

  // Get client IP for logging purposes
  let clientIP =
    req.headers.get('x-forwarded-for') ||
    req.ip ||
    req.headers.get('x-real-ip') ||
    'unknown';
  if (Array.isArray(clientIP)) {
    clientIP = clientIP[0];
  }

  // Set up streaming response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Helper function to send data chunks
      const sendData = (data: StreamingResponseData) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Set up Pinecone and filter
        const { index, filter } = await setupPineconeAndFilter(
          sanitizedInput.collection,
          sanitizedInput.mediaTypes,
          siteConfig,
        );

        const { retriever, documentPromise } =
          await setupVectorStoreAndRetriever(index, filter, sendData);

        // Execute language model chain
        const fullResponse = await setupAndExecuteLanguageModelChain(
          retriever,
          sanitizedInput.question,
          sanitizedInput.history,
          sendData,
        );

        // Log warning if no sources were found
        const promiseDocuments = await documentPromise;
        if (promiseDocuments.length === 0) {
          console.warn(
            `Warning: No sources returned for query: "${sanitizedInput.question}"`,
          );
          console.log('Filter used:', JSON.stringify(filter));
          console.log('Pinecone index:', getPineconeIndexName());
        }

        // Save answer to Firestore if not a private session
        if (!sanitizedInput.privateSession) {
          const docId = await saveAnswerToFirestore(
            originalQuestion,
            fullResponse,
            sanitizedInput.collection,
            promiseDocuments,
            sanitizedInput.history,
            clientIP,
          );

          sendData({ docId });
        }

        controller.close();
      } catch (error: unknown) {
        handleError(error, sendData);
      } finally {
        controller.close();
      }
    },
  });

  // Return streaming response
  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
