import type { NextApiRequest, NextApiResponse } from 'next';
import type { Document } from 'langchain/document';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { makeChain, CollectionKey } from '@/utils/server/makechain';
import { getPineconeClient } from '@/utils/server/pinecone-client';
import { PINECONE_INDEX_NAME } from '@/config/pinecone';
import * as fbadmin from 'firebase-admin';
import { db } from '@/services/firebase';
import { getChatLogsCollectionName } from '@/utils/server/firestoreUtils';
import { updateRelatedQuestions } from '@/utils/server/relatedQuestionsUtils';

export const maxDuration = 60; // This function can run for a maximum of 60 seconds

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { collection, question, history, privateSession, mediaTypes } =
    req.body;

  if (req.method == 'POST') {
    if (
      typeof collection !== 'string' ||
      !['master_swami', 'whole_library'].includes(collection)
    ) {
      return res.status(400).json({ error: 'Invalid collection provided' });
    }

    let clientIP =
      req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    if (Array.isArray(clientIP)) {
      clientIP = clientIP[0];
    }

    if (!question) {
      return res.status(400).json({ message: 'No question in the request' });
    }

    const originalQuestion = question;

    // Use the sanitized version for processing, but keep the original for storage.
    // OpenAI recommends replacing newlines with spaces for best results
    const sanitizedQuestion = question.trim().replaceAll('\n', ' ');

    try {
      const pinecone = await getPineconeClient();
      const index = pinecone.Index(PINECONE_INDEX_NAME);

      const filter: {
        type: { $in: string[] };
        author?: { $in: string[] };
      } = {
        type: { $in: [] },
        ...(collection === 'master_swami' && {
          author: { $in: ['Paramhansa Yogananda', 'Swami Kriyananda'] },
        }),
      };

      // require at least one media type to be selected or set all to true
      if (!mediaTypes.text && !mediaTypes.audio && !mediaTypes.youtube) {
        mediaTypes.text = true;
        mediaTypes.audio = true;
        mediaTypes.youtube = true;
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
          return [`Human: ${message[0]}`, `Assistant: ${message[1]}`].join(
            '\n',
          );
        })
        .join('\n');

      // Ask a question using chat history
      const response = await chain.invoke({
        question: sanitizedQuestion,
        chat_history: pastMessages,
      });
      const sourceDocuments = await documentPromise;
      const processedSourceDocuments = [...sourceDocuments];
      let sourceTitlesString = '';
      if (processedSourceDocuments && processedSourceDocuments.length > 0) {
        const sourceTitles = processedSourceDocuments.map((doc: any) => {
          // Log audio sources
          if (doc.metadata.type === 'youtube') {
            console.log('youtube source:', doc);
          }
          return doc.metadata.title;
        });
        sourceTitlesString = '\nSources:\n* ' + sourceTitles.join('\n* ');
        console.log(sourceTitlesString);
      }

      let docId: string | undefined;

      if (!privateSession) {
        // Log the question and answer in Firestore only for non-private sessions
        const chatLogRef = db.collection(getChatLogsCollectionName());
        const logEntry = {
          question: originalQuestion,
          answer: response,
          collection: collection,
          sources: JSON.stringify(processedSourceDocuments),
          likeCount: 0,
          history: history.map((messagePair: [string, string]) => ({
            question: messagePair[0],
            answer: messagePair[1],
          })),
          ip: clientIP,
          timestamp: fbadmin.firestore.FieldValue.serverTimestamp(),
        };
        const docRef = await chatLogRef.add(logEntry);
        docId = docRef.id;

        // Call the updateRelatedQuestions function to update related questions
        console.time('updateRelatedQuestions');
        await updateRelatedQuestions(docId);
        console.timeEnd('updateRelatedQuestions');
      }

      res.status(200).json({
        text: response,
        sourceDocuments: processedSourceDocuments,
        docId: docId,
      });
    } catch (error: any) {
      console.log('error', error);
      if (error.name === 'PineconeNotFoundError') {
        console.error('Pinecone index not found:', PINECONE_INDEX_NAME);
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
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
}
