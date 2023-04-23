import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
/*
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { pinecone } from '@/utils/pinecone-client';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';
*/
/*
import { OPENAI_API_KEY } from '@/config/openai';
import { Chroma } from 'langchain/vectorstores/chroma';
import { ChromaClient, OpenAIEmbeddingFunction } from 'chromadb';
*/
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { CustomPDFLoader } from '@/utils/customPDFLoader';
import { DirectoryLoader } from 'langchain/document_loaders/fs/directory';

/* Name of directory to retrieve your files from */
const filePath = 'docs';

export const run = async () => {
  try {
    /*load raw docs from the all files in the directory */
    const directoryLoader = new DirectoryLoader(filePath, {
      '.pdf': (path) => new CustomPDFLoader(path),
    });

    // const loader = new PDFLoader(filePath);
    const rawDocs = await directoryLoader.load();

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
    /*
    const index = pinecone.Index(PINECONE_INDEX_NAME); //change to your own index name

    //embed the PDF documents
    await PineconeStore.fromDocuments(docs, embeddings, {
      pineconeIndex: index,
      namespace: PINECONE_NAME_SPACE,
      textKey: 'text',
    });
    */
    /*
    const chroma = new ChromaClient();
    const embedder = new OpenAIEmbeddingFunction(OPENAI_API_KEY);
    const collection = await chroma.getOrCreateCollection('test');
    await Chroma.fromDocuments(docs, embeddings, {
      collectionName: 'gpttest',
    });
    */
    const directory = "C:/GitHubRepo/gpt4-pdf-chatbot-langchain/hnsw_store";
    const vectorStore = await HNSWLib.fromDocuments(docs, embeddings);
    await vectorStore.save(directory);
  } catch (error) {
    console.log('error', error);
    throw new Error('Failed to ingest your data');
  }
};

(async () => {
  await run();
  console.log('ingestion complete');
})();
