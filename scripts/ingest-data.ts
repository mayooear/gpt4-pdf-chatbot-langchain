import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { pinecone } from '@/utils/pinecone-client';
import { CustomPDFLoader } from '@/utils/customPDFLoader';
import { PINECONE_INDEX_NAME } from '@/config/pinecone';
// import { File } from 'langchain/document';

export const run = async (file: File, fileName: string, namespace?: string) => {
  try {
    /*load raw docs from the given file */
    const customPDFLoader = new CustomPDFLoader(file);
    const rawDocs = await customPDFLoader.load();

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
    const index = pinecone.Index(PINECONE_INDEX_NAME);

    //embed the PDF documents
    await PineconeStore.fromDocuments(docs, embeddings, {
      pineconeIndex: index,
      namespace: namespace || 'default_namespace',
      textKey: 'text',
    });
  } catch (error) {
    console.log('error', error);
    throw new Error('Failed to ingest your data');
  }
};

// export const runIngestChunks = async (chunks: string[], fileName: string) => {
//   try {
//     const docs = chunks.map(
//       (text) =>
//         new Document({
//           pageContent: text,
//           metadata: { source: fileName },
//         })
//     );

//     const embeddings = new OpenAIEmbeddings();
//     const index = pinecone.Index(PINECONE_INDEX_NAME);

//     // Embed the text chunks
//     await PineconeStore.fromDocuments(docs, embeddings, {
//       pineconeIndex: index,
//       namespace: fileName,
//       textKey: 'text',
//     });
//   } catch (error) {
//     console.log('error', error);
//     throw new Error('Failed to ingest your data');
//   }
// };