import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { pinecone } from '@/utils/pinecone-client';
import {
  PINECONE_INDEX_NAME,
  PINECONE_NAME_SPACE_MORSE_FEDERICK,
} from '@/config/pinecone';
import fs from 'fs';
import { CheerioWebBaseLoader } from 'langchain/document_loaders/web/cheerio';
import { PuppeteerWebBaseLoader } from 'langchain/document_loaders/web/puppeteer';
export const run = async () => {
  try {
    // const loader = new CheerioWebBaseLoader(
    //   'https://docs.pinecone.io/docs/overview',
    // );

    const loader = new PuppeteerWebBaseLoader(
      'https://docs.pinecone.io/docs/overview',
    );

    const rawDocs = await loader.load();
    console.log(
      '🚀 ~ file: ingest-data-cheerio-pc.ts:21 ~ run ~ rawDocs:',
      rawDocs,
    );

    // write the docs to a file system
    await fs.writeFile(
      'docs/results/cheerio-raw-docs-pinecone.json',
      JSON.stringify(rawDocs),
      (err) => {
        console.log('raw docs JSON data is saved.');
      },
    );

    return;

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
