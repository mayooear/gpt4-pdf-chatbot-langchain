// We have to use a custom chat route because that's how we can get streaming on Vercel production,
// per https://vercel.com/docs/functions/streaming/quickstart

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

export const runtime = 'nodejs';
export const maxDuration = 240; // This function can run for a maximum of 240 seconds

export async function POST(req: NextRequest) {
  console.log('Received POST request to /api/chat');

  let requestBody;
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

  const { collection, question, history, privateSession, mediaTypes } =
    requestBody;

  if (
    typeof collection !== 'string' ||
    !['master_swami', 'whole_library'].includes(collection)
  ) {
    return NextResponse.json(
      { error: 'Invalid collection provided' },
      { status: 400 },
    );
  }

  if (!question) {
    return NextResponse.json(
      { message: 'No question in the request' },
      { status: 400 },
    );
  }

  let clientIP =
    req.headers.get('x-forwarded-for') ||
    req.ip ||
    req.headers.get('x-real-ip') ||
    'unknown';
  if (Array.isArray(clientIP)) {
    clientIP = clientIP[0];
  }

  const originalQuestion = question;
  const sanitizedQuestion = question.trim().replaceAll('\n', ' ');

  let fullResponse = '';

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendData = (data: {
        token?: string;
        sourceDocs?: Document[];
        done?: boolean;
        error?: string;
      }) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const pinecone = await getPineconeClient();
        const index = pinecone.Index(
          getPineconeIndexName() || '',
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

        let resolveWithDocuments: (value: Document[]) => void;
        const documentPromise = new Promise<Document[]>((resolve) => {
          resolveWithDocuments = resolve;
        });

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

        const chain = await makeChain(retriever);
        const pastMessages = history
          .map((message: [string, string]) => {
            return [`Human: ${message[0]}`, `Assistant: ${message[1]}`].join(
              '\n',
            );
          })
          .join('\n');

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
                  sendData({ token });
                },
                handleChainEnd() {
                  sendData({ done: true });
                },
              } as Partial<BaseCallbackHandler>,
            ],
          },
        );

        // Wait for the documents to be retrieved
        const promiseDocuments = await documentPromise;

        // Wait for the chain to complete
        await chainPromise;

        if (!privateSession) {
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
          const docId = docRef.id;

          console.time('updateRelatedQuestions');
          try {
            const response = await fetch(
              `${process.env.NEXT_PUBLIC_BASE_URL}/api/relatedQuestions`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ docId }),
              },
            );

            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
          } catch (error) {
            console.error('Error updating related questions:', error);
          }
          console.timeEnd('updateRelatedQuestions');
        }

        controller.close();
      } catch (error: unknown) {
        console.error('Error in chat route:', error);
        if (error instanceof Error) {
          if (error.name === 'PineconeNotFoundError') {
            console.error('Pinecone index not found:', getPineconeIndexName());
            sendData({
              error:
                'The specified Pinecone index does not exist. Please notify your administrator.',
            });
          } else if (error.message.includes('429')) {
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
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
