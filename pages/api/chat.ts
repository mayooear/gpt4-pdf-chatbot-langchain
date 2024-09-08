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

export const maxDuration = 60; // This function can run for a maximum of 60 seconds

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

    let fullResponse = '';
    const sendData = (data: string) => {
      res.write(`data: ${data}\n\n`);
    };

    // Start the chain invocation
    const chainPromise = chain.invoke(
      {
        question: sanitizedQuestion,
        chat_history: pastMessages,
      },
      {
        callbacks: [
          {
            handleLLMNewToken(token: string) {
              fullResponse += token;
              sendData(JSON.stringify({ token }));
            },
          },
        ],
      },
    );

    // Wait for the documents to be retrieved
    const documents = await documentPromise;

    // Send the source documents
    sendData(JSON.stringify({ sourceDocs: documents }));

    // Wait for the chain to complete
    await chainPromise;

    // Send the [DONE] message to indicate the end of the stream
    sendData(JSON.stringify({ done: true }));

    // Close the response
    res.end();

    if (!privateSession) {
      const answerRef = db.collection(getAnswersCollectionName());
      const answerEntry = {
        question: originalQuestion,
        answer: fullResponse,
        collection: collection,
        sources: JSON.stringify(documents),
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
