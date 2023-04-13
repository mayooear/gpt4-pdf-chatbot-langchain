import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from 'langchain/embeddings';
import { PineconeStore } from 'langchain/vectorstores';
import { pinecone } from '@/utils/pinecone-client';
import { DirectoryLoader, PDFLoader } from 'langchain/document_loaders';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';

/* Name of directory to retrieve files from. You can change this as required */
const filePath = 'reports';

export const run = async () => {
  try {
    /*load raw docs from the pdf file in the directory */
    // const directoryLoader = new DirectoryLoader(filePath + '**/*.pdf', {
    const directoryLoader = new DirectoryLoader(filePath, {
      '.pdf': (path) => new PDFLoader(path),
    });

    const groupedDocs = await directoryLoader.load();

    // console.log('docs', docs);
    console.log('docs len', groupedDocs.length);

    /* Split text into chunks */
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    // const docs = await textSplitter.splitDocuments(rawDocs);
    // console.log('split docs', docs);

    console.log('creating vector store...');
    /*create and store the embeddings in the vectorStore*/
    const index = pinecone.Index(PINECONE_INDEX_NAME); //change to your own index name

    console.log(
      `deleting all vectors in ${PINECONE_NAME_SPACE} namespace before ingestion...`,
    );
    await index.delete1({
      deleteAll: true,
      namespace: PINECONE_NAME_SPACE,
    });

    //embed the PDF documents

    /* Pinecone recommends a limit of 100 vectors per upsert request to avoid errors*/

    for (let i = 0; i < groupedDocs.length; i++) {
      const doc = groupedDocs[i];
      console.log('doc', doc);

      const splitDocs = await textSplitter.splitDocuments([groupedDocs[i]]);
      //   console.log('split docs', splitDocs);

      const chunkSize = 50;
      for (let j = 0; j < splitDocs.length; j += chunkSize) {
        const pineconeNameSpace = PINECONE_NAME_SPACE;

        const chunk = splitDocs.slice(j, j + chunkSize);
        console.log('chunk', j, chunk);
        await PineconeStore.fromDocuments(
          index,
          chunk,
          new OpenAIEmbeddings(),
          'text',
          pineconeNameSpace,
        );
      }
    }
    // const chunkSize = 50;
    // for (let i = 0; i < splitDocs.length; i += chunkSize) {
    //   const pineconeNameSpace = PINECONE_NAME_SPACE + i;

    //   const chunk = splitDocs.slice(i, i + chunkSize);
    //   console.log('chunk', i, chunk);
    //   await PineconeStore.fromDocuments(
    //     index,
    //     chunk,
    //     new OpenAIEmbeddings(),
    //     'text',
    //     pineconeNameSpace,
    //   );
    // }
  } catch (error) {
    console.log('error', error);
    throw new Error('Failed to ingest your data');
  }
};

(async () => {
  await run();
  console.log('ingestion complete');
})();
