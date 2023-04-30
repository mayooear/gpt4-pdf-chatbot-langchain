/* eslint-disable import/no-anonymous-default-export */
import { NextApiRequest, NextApiResponse } from 'next';
import { CustomPDFLoader } from '@/utils/customPDFLoader';

export default async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const { file } = req.body;
  if (!file) {
    res.status(400).send('No file provided');
    return;
  }

  try {
    const buffer = Buffer.from(file, 'base64');
    const blob = new Blob([buffer], { type: 'application/pdf' });
    const customPDFLoader = new CustomPDFLoader(blob as unknown as File);
    const [doc] = await customPDFLoader.load();
    res.status(200).json({ text: doc.pageContent });
  } catch (error) {
    res.status(500).send('Failed to parse the PDF file');
    console.error(error);
  }
};
// This API should be placed in your pages/api directory as parse-pdf.ts. It receives the base64 encoded PDF file, converts it into a Blob, and uses the CustomPDFLoader to extract the text from the PDF. The extracted text is then returned in the response.






