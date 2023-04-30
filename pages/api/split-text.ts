/* eslint-disable import/no-anonymous-default-export */
import { NextApiRequest, NextApiResponse } from 'next';
import { Document } from 'langchain/document';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

export default async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const { text } = req.body;
  if (!text) {
    res.status(400).send('No text provided');
    return;
  }

  try {
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const rawDocs = [new Document({ pageContent: text })];
    const chunks = await textSplitter.splitDocuments(rawDocs);
    res.status(200).json({ chunks });
  } catch (error) {
    res.status(500).send('Failed to split text');
    console.error(error);
  }
};