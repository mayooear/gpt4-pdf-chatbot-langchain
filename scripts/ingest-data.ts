import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from 'langchain/embeddings';
import { PineconeStore } from 'langchain/vectorstores';
import { pinecone } from '@/utils/pinecone-client';
import { PDFLoader } from 'langchain/document_loaders';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';

/* Name of directory to retrieve files from. You can change this as required */
const filePath = 'docs/MorseVsFrederick.pdf';

export const run = async () => {
  try {
    /*load raw docs from the pdf file in the directory */
    const loader = new PDFLoader(filePath);
    // const loader = new PDFLoader(filePath);
    const rawDocs = await loader.load();

    console.log(rawDocs);

    /* Split text into chunks */
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const docs = await textSplitter.splitDocuments(rawDocs);
    console.log('split docs', docs);

    console.log('creating vector store...');
    /*create and store the embeddings in the vectorStore*/
    const embeddings = new OpenAIEmbeddings();
    const index = pinecone.Index(PINECONE_INDEX_NAME); //change to your own index name
    
    // Split chunks into groups of 100 to accomodate current pinecone limitation
    const chunkGroups = [];
    const CHUNKS_PER_REQUEST = 100;
    for (let i = 0; i < docs.length; i += CHUNKS_PER_REQUEST) {
      chunkGroups.push(docs.slice(i, i + CHUNKS_PER_REQUEST));
    }

    // Upsert each group of chunks
    for (const group of chunkGroups) {
      await PineconeStore.fromDocuments(
        index,
        group,
        embeddings,
        'text',
        PINECONE_NAME_SPACE,
      );
    }
  } catch (error) {
    console.log('error', error);
    throw new Error('Failed to ingest your data');
  }
};

(async () => {
  await run();
  console.log('ingestion complete');
})();
