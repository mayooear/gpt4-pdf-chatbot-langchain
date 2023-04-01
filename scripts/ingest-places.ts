import dotenv from 'dotenv';
dotenv.config();
import { OpenAIEmbeddings } from 'langchain/embeddings';
import { PineconeStore } from 'langchain/vectorstores';
import { pinecone } from '@/utils/pinecone-client';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { getDocumentsForAllPlaces } from '@/utils/getDocumentsForAllPlaces';

export const run = async () => {
  const censusDocs = await getDocumentsForAllPlaces();

  /* Split text into chunks */
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const docs = await textSplitter.splitDocuments(censusDocs);
  console.log('split docs', docs);

  if (process.env.DRY_RUN === 'false') console.log('creating vector store...');
  /*create and store the embeddings in the vectorStore*/
  const embeddings = new OpenAIEmbeddings();

  const index = pinecone.Index(PINECONE_INDEX_NAME); //change to your own index name

  try {
    /* Pinecone recommends a limit of 100 vectors per upsert request to avoid errors*/
    const chunkSize = 50;
    for (let i = 0; i < docs.length; i += chunkSize) {
      const chunk = docs.slice(i, i + chunkSize);
      console.log('chunk', i, chunk);
      if (process.env.DRY_RUN === 'false') {
        await PineconeStore.fromDocuments(
          index,
          chunk,
          embeddings,
          'text',
          PINECONE_NAME_SPACE,
        );
      } else {
        console.log('DRY_RUN is true - not uploading');

        console.log({ success: true, dryRun: true });
      }
    }

    console.log({ success: true });
  } catch (error) {
    console.log('error', error);
    console.log({ error: error });
  } finally {
    console.log('END');
  }
};

(async () => {
  await run();
  if (process.env.DRY_RUN === 'false') {
    console.log('ingestion complete');
  } else {
    console.log('DRY ingestion complete');
  }
})();
