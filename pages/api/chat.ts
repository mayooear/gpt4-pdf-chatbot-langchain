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

export const maxDuration = 60; // This function can run for a maximum of 60 seconds

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { collection, question, history, privateSession } = req.body;
  
  if (req.method == 'POST') {
    if (typeof collection !== 'string' || !['master_swami', 'whole_library'].includes(collection)) {
      return res.status(400).json({ error: 'Invalid collection provided' });
    }

    let clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
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

      const filter = {
        // 'library': { $in: ['Ananda Library', 'Treasures'] },
        ...(collection === 'master_swami' && { 'pdf.info.Author': { $in: ['Paramhansa Yogananda', 'Swami Kriyananda'] } })
      };

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
      
      const chain = makeChain(retriever, collection as CollectionKey);

      const pastMessages = history
        .map((message: [string, string]) => {
          return [`Human: ${message[0]}`, `Assistant: ${message[1]}`].join('\n');
        })
        .join('\n');

      // Ask a question using chat history
      const response = await chain.invoke({
        question: sanitizedQuestion,
        chat_history: pastMessages,
      });
      const answerWordCount = response.split(/\s+/).length;
      const sourceDocuments = await documentPromise;
      const processedSourceDocuments = [...sourceDocuments];
      console.log('Processed Source Documents:', processedSourceDocuments); 
      let sourceTitlesString = '';
      if (processedSourceDocuments && processedSourceDocuments.length > 0) {
        const sourceTitles = processedSourceDocuments.map((doc: any) => {
          console.log('Document Metadata:', doc.metadata);
          return doc.metadata.title || doc.metadata['pdf.info.Title'];
        });
        sourceTitlesString = '\nSources:\n* ' + sourceTitles.join('\n* ');
        console.log(sourceTitlesString);
      }

      // Log the question and answer in Firestore, anonymize if private session
      const chatLogRef = db.collection(getChatLogsCollectionName());
      const logEntry = privateSession ? {
        question: 'private',
        answer: '(' + answerWordCount + " words)",
        collection: collection,
        sources: '',
        history: [],
        likeCount: 0,
        ip: '',
        timestamp: fbadmin.firestore.FieldValue.serverTimestamp(),
      } : {
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
      const docId = docRef.id;
      res.status(200).json({ text: response, sourceDocuments: processedSourceDocuments, docId });

    } catch (error: any) {
      console.log('error', error);
      res.status(500).json({ error: error.message || 'Something went wrong' });
    }
  }
  else
  {    
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
}