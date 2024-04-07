import type { NextApiRequest, NextApiResponse } from 'next';
import type { Document } from 'langchain/document';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore, PineconeStoreParams } from '@langchain/pinecone';
import { makeChain } from '@/utils/makechain';
import { PineconeConfigKey, pineconeConfig, usePinecone } from '@/utils/pinecone-client';
// import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';
import { PINECONE_INDEX_NAME } from '@/config/pinecone';
import * as fbadmin from 'firebase-admin';
import firebase from 'firebase-admin';
import { db } from '@/services/firebase'; 

export const maxDuration = 60; // This function can run for a maximum of 60 seconds

async function getAnswersByIds(ids: string[]): Promise<any[]> {
  const answers: any[] = [];

  // Firestore 'whereIn' queries are limited to 10 items per query.
  // If we get more than 10 IDs, we'll need to split them into chunks.
  const chunkSize = 10;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);

    const startTime = performance.now(); 

    const snapshot = await db.collection(`${process.env.ENVIRONMENT}_chatLogs`)
                             .where(firebase.firestore.FieldPath.documentId(), 'in', chunk)
                             .get();
    snapshot.forEach(doc => {
      const data = doc.data();
      try {
        if (typeof data.sources === 'string') {
          // Sanitize the string by replacing invisible/control characters
          const sanitizedSources = data.sources.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
          data.sources = JSON.parse(sanitizedSources);
        } else {
          data.sources =  [];
        }
      } catch (error) {
        data.sources = []
      }
      answers.push({ id: doc.id, ...data });
    });
  
    const endTime = performance.now(); 
    console.log(`Chat getAnswersByIds: call to Firestore took ${Math.round(endTime - startTime)} milliseconds.`);
  }

  return answers;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { collection, question, history, privateSession } = req.body;
  
  let clientIP = '';
  if (privateSession) {
    console.log("\nPRIVATE question asked");
  } else {
    const forwarded = req.headers['x-forwarded-for'];
    clientIP = typeof forwarded === 'string' ? forwarded.split(',')[0] : (req.socket.remoteAddress || '');
    console.log('\nClient IP:', clientIP);
    console.log('QUESTION:', question);
    console.log('');
  }
  
  if (req.method === 'GET') {
    try {
      // get a list of answers
      const { answerIds } = req.query;
      if (!answerIds || typeof answerIds !== 'string') {
        return res.status(400).json({ message: 'answerIds parameter is required and must be a comma-separated string.' });
      }

      const idsArray = answerIds.split(',');
      const answers = await getAnswersByIds(idsArray);
      res.status(200).json(answers);

    } catch (error) {
      console.error('Error fetching answers: ', error);
      res.status(500).json({ message: 'Error fetching answers', error });
    }
  }
  else if (req.method == 'POST') {
    if (typeof collection !== 'string' || !(collection in pineconeConfig)) {
      return res.status(400).json({ error: 'Invalid collection provided' });
    }
  
    // send question to chatbot 
    if (!question) {
      return res.status(400).json({ message: 'No question in the request' });
    }
    // OpenAI recommends replacing newlines with spaces for best results
    const sanitizedQuestion = question.trim().replaceAll('\n', ' ');

    try {  
      const pinecone = await usePinecone(collection as PineconeConfigKey);
      console.log("Pinecone collection:", collection);
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
        sources: '',
        history: [],
        ip: '',
        timestamp: fbadmin.firestore.FieldValue.serverTimestamp(),
      } : {
        question: sanitizedQuestion,
        answer: response,
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

      if (privateSession)
      {
        console.log(`Word count of answer: ${answerWordCount}`);
      } else {
        console.log('ANSWER:\n');
        console.log(response);
        console.log(sourceTitlesString);
        console.log('\nHistory:', history);
      }

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
