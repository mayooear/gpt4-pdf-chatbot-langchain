/* eslint-disable import/no-anonymous-default-export */
import { NextApiRequest, NextApiResponse } from 'next';
import { Document, DocumentParams } from 'langchain/document';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { pinecone } from '@/utils/pinecone-client';
import { PINECONE_INDEX_NAME } from '@/config/pinecone';

export default async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const { chunks, namespace } = req.body;
  if (!chunks) {
    res.status(400).send('No chunks provided');
    return;
  }

  try {
    const docs = chunks.map((chunk: Partial<DocumentParams<Record<string, any>>> | undefined) => new Document(chunk));
    const embeddings = new OpenAIEmbeddings();
    const index = pinecone.Index(PINECONE_INDEX_NAME);

    await PineconeStore.fromDocuments(docs, embeddings, {
      pineconeIndex: index,
      namespace: namespace || 'default_namespace',
      textKey: 'text',
    });

    res.status(200).send('Embeddings saved to Pinecone');
  } catch (error) {
    res.status(500).send('Failed to save embeddings to Pinecone');
    console.error(error);
  }
};
