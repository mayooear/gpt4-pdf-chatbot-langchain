import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { CohereEmbeddings } from 'langchain/embeddings/cohere';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { pinecone } from '@/utils/pinecone-client';
import { CustomPDFLoader } from '@/utils/customPDFLoader';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';
import { DirectoryLoader } from 'langchain/document_loaders/fs/directory';
import { TextLoader } from "langchain/document_loaders/fs/text";
import { DocxLoader } from "langchain/document_loaders/fs/docx";

/* Name of directory to retrieve your files from */
const filePath = 'docs';

export const run = async () => {
  try {
    /*load raw docs from the all files in the directory */
    const directoryLoader = new DirectoryLoader(filePath, {
      '.pdf': (path) => new CustomPDFLoader(path),
      '.txt': (path) => new TextLoader(path),
      '.docx': (path) => new DocxLoader(path),
    });
 
    // const loader = new PDFLoader(filePath);
    const rawDocs = await directoryLoader.load();

    /* Split text into chunks */
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 3000,
      chunkOverlap: 250,
    });

    const docs = await textSplitter.splitDocuments(rawDocs);
    docs.forEach(doc => {
      doc.pageContent=doc.pageContent.replace(/\n/," ");
    })
    console.log('split docs');

    console.log('creating vector store...inside',PINECONE_NAME_SPACE);
    /*create and store the embeddings in the vectorStore*/
    //const embeddings = new OpenAIEmbeddings();
    const embeddings = new CohereEmbeddings({modelName:"embed-multilingual-v2.0"});
    const index = pinecone.Index(PINECONE_INDEX_NAME); //change to your own index name

    //embed the PDF documents
    await PineconeStore.fromDocuments(docs, embeddings, {
      pineconeIndex: index,
      namespace: PINECONE_NAME_SPACE,
      textKey: 'text',
   });
  } catch (error) {
    console.log('error', error);
    throw new Error('Failed to ingest your data');
  }
};

(async () => {
  let  date = new Date()
  console.log(date.toLocaleString('en-US')); 
  await run();
  console.log('ingestion complete');
  let  date2 = new Date()
  console.log(date2.toLocaleString('en-US')); 
})();
