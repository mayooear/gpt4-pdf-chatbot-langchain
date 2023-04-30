import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { pinecone } from '@/utils/pinecone-client';
import { CustomPDFLoader } from '@/utils/customPDFLoader';
import {
  PINECONE_INDEX_NAME,
  PINECONE_NAME_SPACE_MORSE_FEDERICK,
} from '@/config/pinecone';
import { DirectoryLoader } from 'langchain/document_loaders/fs/directory';
import fs from 'fs';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';

/* Name of directory to retrieve your files from */
const filePath = 'docs/input/MorseVsFrederick.pdf';

export const run = async () => {
  try {
    /*load raw docs from the all files in the directory */
    const fileLoader = new PDFLoader(filePath);
    const rawDocs = await fileLoader.load();
    console.log('🚀 ~ file: ingest-data-pdf.ts:21 ~ run ~ rawDocs:', rawDocs);

    /* Split text into chunks */
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const docs = await textSplitter.splitDocuments(rawDocs);
    // write the docs to a file system
    const dataDocs = JSON.stringify(docs);
    await fs.writeFile('docs/results/docs.json', dataDocs, (err) => {
      console.log('Docs JSON data is saved.');
    });

    console.log('creating vector store...');
    /*create and store the embeddings in the vectorStore*/
    const embeddings = new OpenAIEmbeddings();
    const index = pinecone.Index(PINECONE_INDEX_NAME); //change to your own index name

    //embed the PDF documents
    await PineconeStore.fromDocuments(docs, embeddings, {
      pineconeIndex: index,
      namespace: PINECONE_NAME_SPACE_MORSE_FEDERICK,
      textKey: 'text',
    });
  } catch (error) {
    console.log('🚀 ~ file: ingest-data-pdf.ts:49 ~ run ~ error:', error);
    throw new Error('Failed to ingest your data');
  }
};

(async () => {
  await run();
  console.log('ingestion complete');
})();
