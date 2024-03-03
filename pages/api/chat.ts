import type { NextApiRequest, NextApiResponse } from 'next';
import type { Document } from 'langchain/document';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { makeChain } from '@/utils/makechain';
import { pinecone } from '@/utils/pinecone-client';
// import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';
import { PINECONE_INDEX_NAME } from '@/config/pinecone';

export const maxDuration = 60; // This function can run for a maximum of 60 seconds

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { question, history } = req.body;

  const forwarded = req.headers['x-forwarded-for'];
  const clientIP = typeof forwarded === 'string' ? forwarded.split(',')[0] : req.socket.remoteAddress;
  console.log('\nClient IP:', clientIP);
  console.log('QUESTION:', question);
  console.log('');
  
  //only accept post requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!question) {
    return res.status(400).json({ message: 'No question in the request' });
  }
  // OpenAI recommends replacing newlines with spaces for best results
  const sanitizedQuestion = question.trim().replaceAll('\n', ' ');

  try {
    const index = pinecone.Index(PINECONE_INDEX_NAME);

    /* create vectorstore*/
    const vectorStore = await PineconeStore.fromExistingIndex(
      new OpenAIEmbeddings({}),
      {
        pineconeIndex: index,
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
    const chain = makeChain(retriever);

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

    const sourceDocuments = await documentPromise;

    console.log('\nANSWER:\n');
    console.log(response);
    if (sourceDocuments) {
      const sourceTitles = sourceDocuments.map((doc: any, index: number) => {
        return `${doc.metadata['pdf.info.Title']}`;
      });
      console.log('\nSources:\n*', sourceTitles.join('\n* '));
    }
    console.log('\nHistory:', history);

    res.status(200).json({ text: response, sourceDocuments });

  } catch (error: any) {
    console.log('error', error);
    res.status(500).json({ error: error.message || 'Something went wrong' });
  }
}
