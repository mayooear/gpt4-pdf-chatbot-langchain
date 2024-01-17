import type { NextApiRequest, NextApiResponse } from 'next';
import type { Document } from 'langchain/document';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { makeChain } from '@/utils/makechain';
import { pinecone } from '@/utils/pinecone-client';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';
import { IncomingForm } from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false, // Disabling the default body parser
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const form = new IncomingForm({
    //multiples: true, // Support for multiple file uploads
    //keepExtensions: true, // Keep file extensions
    maxFileSize: 20 * 1024 * 1024, // Max file size in bytes (20MB)
  });

  //only accept post requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  form.parse(req, async (err, fields, files) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    const { question, history } = fields;
    const imageFile = files.image; // This will be undefined if no image is uploaded
    console.log('imageFile', imageFile);
    console.log('question', question);
    console.log('history', history);

    // Ensure 'question' is provided
    if (!question) {
      return res.status(400).json({ message: 'No question in the request' });
    }

    let sanitizedQuestion = fields.question!.toString();

    if (Array.isArray(sanitizedQuestion)) {
      sanitizedQuestion = sanitizedQuestion[0]; // Take the first element if it's an array
    }
    sanitizedQuestion = sanitizedQuestion.trim().replaceAll('\n', ' ');


    try {
      const index = pinecone.Index(PINECONE_INDEX_NAME);

      /* create vectorstore*/
      const vectorStore = await PineconeStore.fromExistingIndex(
          new OpenAIEmbeddings({}),
          {
            pineconeIndex: index,
            textKey: 'text',
            namespace: PINECONE_NAME_SPACE, //namespace comes from your config folder
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
      var pastMessages: string = "";

      if (history !== undefined && history !== null) {
        const parsedHistory = JSON.parse(history!.toString());

        parsedHistory.forEach((message: [string, string]) => {
            pastMessages += `Human: ${message[0]}\nAssistant: ${message[1]}\n`;
        });

        console.log(pastMessages);
      }

      let base64Image = '';
      const imageFile = Array.isArray(files.image) ? files.image[0] : files.image;
      if (imageFile && imageFile.filepath) {
        // Read the image file
        const imagePath = imageFile.filepath;
        const imageBuffer = fs.readFileSync(imagePath);

        // Convert the image to base64
        base64Image = imageBuffer.toString('base64');

        // Optionally, you can prefix it with data URL format, depending on how your chain.invoke expects it
        const mimeType = path.extname(imagePath).substring(1); // Extracts file extension and assumes it as MIME type
        base64Image = `data:image/${mimeType};base64,${base64Image}`;
      }


      //Ask a question using chat history
      const response = await chain.invoke({
        question: sanitizedQuestion,
        chat_history: pastMessages,
        image: base64Image,
      });

      const sourceDocuments = await documentPromise;

      console.log('response', response);
      res.status(200).json({ text: response, sourceDocuments });
    } catch (error: any) {
      console.log('error', error);
      res.status(500).json({ error: error.message || 'Something went wrong' });
    }
  });
}
