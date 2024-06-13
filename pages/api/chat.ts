import type { NextApiRequest, NextApiResponse } from 'next';
import type { Document } from 'langchain/document';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore, PineconeStoreParams } from '@langchain/pinecone';
import { makeChain } from '@/utils/makechain';
import { PineconeConfigKey, pineconeConfig, getPineconeClient } from '@/utils/pinecone-client';
// import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';
import { PINECONE_INDEX_NAME } from '@/config/pinecone';
import * as fbadmin from 'firebase-admin';
import { db } from '@/services/firebase'; 

export const maxDuration = 60; // This function can run for a maximum of 60 seconds

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { collection, question, history, privateSession } = req.body;
  
  if (req.method == 'POST') {
    if (typeof collection !== 'string' || !(collection in pineconeConfig)) {
      return res.status(400).json({ error: 'Invalid collection provided' });
    }

    let clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    if (Array.isArray(clientIP)) {
      clientIP = clientIP[0];
    }

    // send question to chatbot 
    if (!question) {
      return res.status(400).json({ message: 'No question in the request' });
    }
    // OpenAI recommends replacing newlines with spaces for best results
    const sanitizedQuestion = question.trim().replaceAll('\n', ' ');

    try {  
      const pinecone = await getPineconeClient(collection as PineconeConfigKey, 'web');
      const index = pinecone.Index(PINECONE_INDEX_NAME);

      /* create vectorstore */
      const vectorStore = await PineconeStore.fromExistingIndex(
        new OpenAIEmbeddings({}),
        {
          pineconeIndex: index as any, // Work around temporary
          textKey: 'text',
          // namespace: PINECONE_NAME_SPACE, //namespace comes from your config folder
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
      
      //create chain
      const chain = makeChain(retriever, collection as PineconeConfigKey);

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
      let sourceTitlesString = '';
      if (sourceDocuments && sourceDocuments.length > 0) {
        const sourceTitles = sourceDocuments.map((doc: any) => doc.metadata['pdf.info.Title']);
        sourceTitlesString = '\nSources:\n* ' + sourceTitles.join('\n* ');
      }

      // Log the question and answer in Firestore, anonymize if private session
      const chatLogRef = db.collection(`${process.env.ENVIRONMENT}_chatLogs`);
      const logEntry = privateSession ? {
        question: 'private',
        answer: '(' + answerWordCount + " words)",
        collection: collection,
        sources: '',
        history: [],
        ip: '',
        timestamp: fbadmin.firestore.FieldValue.serverTimestamp(),
      } : {
        question: sanitizedQuestion,
        answer: response,
        collection: collection,
        sources: JSON.stringify(sourceDocuments),
        history: history.map((messagePair: [string, string]) => ({
          question: messagePair[0],
          answer: messagePair[1],
        })),
        ip: clientIP,
        timestamp: fbadmin.firestore.FieldValue.serverTimestamp(),
      };
      const docRef = await chatLogRef.add(logEntry);
      const docId = docRef.id;
      res.status(200).json({ text: response, sourceDocuments, docId });

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
