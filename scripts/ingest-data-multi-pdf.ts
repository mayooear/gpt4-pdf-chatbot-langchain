import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from 'langchain/embeddings';
import { PineconeStore } from 'langchain/vectorstores';
import { pinecone } from '@/utils/pinecone-client';
import { PINECONE_INDEX_NAME } from '@/config/pinecone';
import dotenv from 'dotenv';
import { DirectoryLoader } from 'langchain/document_loaders/fs/directory';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import fs from 'fs';
import path from 'path';
import axios, { Method } from 'axios';

/* Name of directory to retrieve files from. You can change this as required */
const filePath = 'docs/input/tesla';
dotenv.config();

export const run = async () => {
  try {
    // Read all the files in the directory
    fs.readdir(filePath, async function (err, files) {
      // If there's an error, log it and exit
      if (err) {
        console.error('Error reading directory:', err);
        return;
      }

      // Loop through the files in the directory
      for (const file of files) {
        // Get the year from the file name
        const year = file!.match(/TSLA_(\d{4})\.pdf/)![1];
        // if year is 2018 or 2019, skip it
        if (year === '2018' || year === '2020') {
          continue;
        }

        const fileLoader = new PDFLoader(path.join(filePath, file));
        const rawDocs = await fileLoader.load();

        // File 2020 contains a lot of \t characters, so we remove them
        rawDocs.forEach(
          (obj) => (obj.pageContent = obj.pageContent.replace(/\t/g, ' ')),
        );

        // write the docs to a file system
        await fs.writeFile(
          `docs/results/rawDocs-tesla${year}.json`,
          JSON.stringify(rawDocs),
          (err) => {
            console.log('Docs JSON data is saved.');
          },
        );
        console.log(
          '🚀 ~ file: ingest-data-pdf.ts:21 ~ run ~ rawDocs:',
          `rawDocs-tesla${year}.json`,
        );

        /* Split text into chunks */
        const textSplitter = new RecursiveCharacterTextSplitter({
          chunkSize: 1000,
          chunkOverlap: 200,
        });

        const docs = await textSplitter.splitDocuments(rawDocs);

        // write the docs to a file system
        await fs.writeFile(
          `docs/results/split-docs-tesla${year}.json`,
          JSON.stringify(docs),
          (err) => {
            console.log('Split docs JSON data is saved.');
          },
        );

        const index = pinecone.Index(PINECONE_INDEX_NAME); //change to your own index name
        // derive namespace from the year
        const namespace = `tesla-${year}`;
        console.log(
          '🚀 ~ file: ingest-data-multi-pdf.ts:72 ~ namespace:',
          namespace,
        );

        // pinecone recommends a limit of 100 vectors per upsert request
        const upsertChunkSize = 50;

        // loop through the chunks
        for (let i = 0; i < docs.length; i += upsertChunkSize) {
          // embed the chunk
          const embeddings = new OpenAIEmbeddings();
          const chunk = docs.slice(i, i + upsertChunkSize);
          // upsert the chunk
          PineconeStore.fromDocuments(chunk, embeddings, {
            namespace,
            pineconeIndex: index,
            textKey: 'text',
          });

          console.log(
            `Upserted ${chunk.length} vectors to ${namespace} namespace`,
          );

          // wait for 1 second before the next upsert
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
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
