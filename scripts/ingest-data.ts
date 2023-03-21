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

    //embed the PDF documents

    /* Pinecone recommends a limit of 100 vectors per upsert request to avoid errors*/
    const chunkSize = 50;
    for (let i = 0; i < docs.length; i += chunkSize) {
      const chunk = docs.slice(i, i + chunkSize);
      console.log('chunk', i, chunk);
      await PineconeStore.fromDocuments(
        index,
        chunk,
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
