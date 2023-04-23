import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
/*
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { pinecone } from '@/utils/pinecone-client';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';
*/
import { OPENAI_API_KEY } from '@/config/openai';
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { Chroma } from 'langchain/vectorstores/chroma';
import { ChromaClient, OpenAIEmbeddingFunction } from 'chromadb';
import { CustomPDFLoader } from '@/utils/customPDFLoader';
import { DirectoryLoader } from 'langchain/document_loaders/fs/directory';

/* Name of directory to retrieve your files from */
const filePath = 'docs';

export const run = async () => {
  try {
    // /*load raw docs from the all files in the directory */
    // const directoryLoader = new DirectoryLoader(filePath, {
    //   '.pdf': (path) => new CustomPDFLoader(path),
    // });

    // // const loader = new PDFLoader(filePath);
    // const rawDocs = await directoryLoader.load();

    // /* Split text into chunks */
    // const textSplitter = new RecursiveCharacterTextSplitter({
    //   chunkSize: 1000,
    //   chunkOverlap: 200,
    // });

    // const docs = await textSplitter.splitDocuments(rawDocs);
    // console.log('split docs', docs);

    // console.log('creating vector store...');
    // /*create and store the embeddings in the vectorStore*/
    // const embeddings = new OpenAIEmbeddings();
    /*
    const index = pinecone.Index(PINECONE_INDEX_NAME); //change to your own index name

    //embed the PDF documents
    await PineconeStore.fromDocuments(docs, embeddings, {
      pineconeIndex: index,
      namespace: PINECONE_NAME_SPACE,
      textKey: 'text',
    });
    */
    // const chroma = new ChromaClient("http://localhost:8000");
    // console.log(chroma.listCollections());
    // const collection = await chroma.getOrCreateCollection('test');
    // const collections = chroma.listCollections();

    const directory = "C:/GitHubRepo/gpt4-pdf-chatbot-langchain/hnsw_store";
    /*
    const vectorStore = await HNSWLib.fromTexts(
      [
        "Tortoise: Labyrinth? Labyrinth? Could it Are we in the notorious Little\
            Harmonic Labyrinth of the dreaded Majotaur?",
        "Achilles: Yiikes! What is that?",
        "Tortoise: They say-although I person never believed it myself-that an I\
            Majotaur has created a tiny labyrinth sits in a pit in the middle of\
            it, waiting innocent victims to get lost in its fears complexity.\
            Then, when they wander and dazed into the center, he laughs and\
            laughs at them-so hard, that he laughs them to death!",
        "Achilles: Oh, no!",
        "Tortoise: But it's only a myth. Courage, Achilles.",
      ],
      [{ id: 2 }, { id: 1 }, { id: 3 }],
      new OpenAIEmbeddings(),
    );
    await vectorStore.save(directory);
      */
    const loadedVectorStore = await HNSWLib.load(
      directory,
      new OpenAIEmbeddings()
    );
    console.log(loadedVectorStore.embeddings)
  } catch (error) {
    console.log('error', error);
    throw new Error('Failed to ingest your data');
  }
};

(async () => {
  await run();
  console.log('ingestion complete');
})();
