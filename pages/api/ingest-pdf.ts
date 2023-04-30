/* eslint-disable import/no-anonymous-default-export */
// pages/api/ingest-pdf.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { run } from '../../scripts/ingest-data';
// import { File } from 'langchain/document';

export default async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const { file } = req.body;
  const fileName = req.body.fileName || 'default_namespace';
  if (!file) {
    res.status(400).send('No file provided');
    return;
  }

  try {
    console.log('try running the api...')
    
    const buffer = Buffer.from(file, 'base64');
    const blob = new Blob([buffer], { type: 'application/pdf' });
    console.log('blob:', blob)
    await run(blob as unknown as File,fileName); // Cast the Blob to File
    res.status(200).send('Ingestion complete');
  } catch (error) {
    res.status(500).send('Failed to ingest your data');
    console.error(error);
  }
};