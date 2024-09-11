import type { NextApiRequest, NextApiResponse } from 'next';
import type { Document } from 'langchain/document';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { makeChain } from '@/utils/server/makechain';
import { getPineconeClient } from '@/utils/server/pinecone-client';
import { getPineconeIndexName } from '@/config/pinecone';
import * as fbadmin from 'firebase-admin';
import { db } from '@/services/firebase';
import { getAnswersCollectionName } from '@/utils/server/firestoreUtils';
import { updateRelatedQuestions } from '@/utils/server/relatedQuestionsUtils';
import { Index, RecordMetadata } from '@pinecone-database/pinecone';

export const maxDuration = 240; // This function can run for a maximum of 240 seconds

export const config = {
  runtime: 'nodejs',
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { collection, question, history, privateSession, mediaTypes } =
    req.body;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (
    typeof collection !== 'string' ||
    !['master_swami', 'whole_library'].includes(collection)
  ) {
    return res.status(400).json({ error: 'Invalid collection provided' });
  }

  if (!question) {
    return res.status(400).json({ message: 'No question in the request' });
  }

  let clientIP =
    req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  if (Array.isArray(clientIP)) {
    clientIP = clientIP[0];
  }

  // Use the sanitized version for processing, but keep the original for storage.
  // OpenAI recommends replacing newlines with spaces for best results
  const originalQuestion = question;
  const sanitizedQuestion = question.trim().replaceAll('\n', ' ');

  try {
    const pinecone = await getPineconeClient();
    const index = pinecone.Index(
      getPineconeIndexName() || ('' as string),
    ) as Index<RecordMetadata>;

    const filter: {
      type: { $in: string[] };
      author?: { $in: string[] };
    } = {
      type: { $in: [] },
      ...(collection === 'master_swami' && {
        author: { $in: ['Paramhansa Yogananda', 'Swami Kriyananda'] },
      }),
    };

    if (!mediaTypes.text && !mediaTypes.audio && !mediaTypes.youtube) {
      mediaTypes.text = mediaTypes.audio = mediaTypes.youtube = true;
    }
    if (mediaTypes.text) filter.type.$in.push('text');
    if (mediaTypes.audio) filter.type.$in.push('audio');
    if (mediaTypes.youtube) filter.type.$in.push('youtube');

    const vectorStore = await PineconeStore.fromExistingIndex(
      new OpenAIEmbeddings({}),
      {
        pineconeIndex: index,
        textKey: 'text',
        filter: filter,
      },
    );

    // Use a callback to get intermediate sources from the middle of the chain
    let resolveWithDocuments: (value: Document[]) => void;
    const documentPromise = new Promise<Document[]>((resolve) => {
      resolveWithDocuments = resolve;
    });

    const retriever = vectorStore.asRetriever({
      callbacks: [
        {
          handleRetrieverEnd(documents) {
            resolveWithDocuments(documents);
          },
        },
      ],
    });

    const chain = await makeChain(retriever);

    const pastMessages = history
      .map((message: [string, string]) => {
        return [`Human: ${message[0]}`, `Assistant: ${message[1]}`].join('\n');
      })
      .join('\n');

    // Set up response for streaming
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });
    const sendData = (data: {
      token?: string;
      sourceDocs?: Document[];
      done?: boolean;
    }) => {
      console.log('Sending chunk:', data); // New log
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      res.flushHeaders();
    };

    let fullResponse = '';
    let retrievedDocuments: Document[] = [];
    let isStreamEnded = false;

    try {
      console.log('Starting chain invocation');
      const chainPromise = chain.invoke(
        {
          question: sanitizedQuestion,
          chat_history: pastMessages,
        },
        {
          callbacks: [
            {
              handleLLMNewToken(token: string) {
                if (!isStreamEnded) {
                  fullResponse += token;
                  sendData({ token });
                }
              },
              handleRetrieverStart() {
                console.log('Retriever started');
              },
              handleRetrieverEnd(docs: Document[]) {
                if (!isStreamEnded) {
                  console.log('Retriever ended, documents:', docs);
                  retrievedDocuments = docs;
                  sendData({ sourceDocs: retrievedDocuments });
                }
              },
              handleChainError(error: Error) {
                console.error('Chain error:', error);
                if (!isStreamEnded) {
                  sendData({ token: `Error: ${error.message}` });
                  isStreamEnded = true;
                  res.end();
                }
              },
              handleChainEnd() {
                console.log('Chain ended');
                if (!isStreamEnded) {
                  sendData({ done: true });
                  isStreamEnded = true;
                  res.end();
                }
              },
            },
          ],
        },
      );

      // Wait for the documents to be retrieved
      const promiseDocuments = await documentPromise;
      console.log('Retrieved documents:', promiseDocuments);

      // Wait for the chain to complete
      await chainPromise;
    } catch (chainError) {
      console.error('Error in chain invocation:', chainError);
      if (!isStreamEnded) {
        sendData({ token: 'An error occurred during processing' });
        isStreamEnded = true;
        res.end();
      }
    }

    if (!privateSession && !isStreamEnded) {
      const answerRef = db.collection(getAnswersCollectionName());
      const answerEntry = {
        question: originalQuestion,
        answer: fullResponse,
        collection: collection,
        sources: JSON.stringify(retrievedDocuments),
        likeCount: 0,
        history: history.map((messagePair: [string, string]) => ({
          question: messagePair[0],
          answer: messagePair[1],
        })),
        ip: clientIP,
        timestamp: fbadmin.firestore.FieldValue.serverTimestamp(),
      };
      const docRef = await answerRef.add(answerEntry);
      const docId = docRef.id;

      console.time('updateRelatedQuestions');
      await updateRelatedQuestions(docId);
      console.timeEnd('updateRelatedQuestions');
    }
  } catch (error: unknown) {
    console.error('Error:', error);
    if (error instanceof Error) {
      if (error.name === 'PineconeNotFoundError') {
        console.error('Pinecone index not found:', getPineconeIndexName());
        return res.status(404).json({
          error:
            'The specified Pinecone index does not exist. Please notify your administrator.',
        });
      }
      if (error.message.includes('429')) {
        console.log(
          'First 10 chars of OPENAI_API_KEY:',
          process.env.OPENAI_API_KEY?.substring(0, 10),
        );
        return res.status(429).json({
          error:
            'The site has exceeded its current quota with OpenAI, please tell an admin to check the plan and billing details.',
        });
      }
      res.status(500).json({ error: error.message || 'Something went wrong' });
    } else {
      res.status(500).json({ error: 'An unknown error occurred' });
    }
  }
}
