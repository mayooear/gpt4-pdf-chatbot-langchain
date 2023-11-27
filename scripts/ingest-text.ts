import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { pinecone } from '@/utils/pinecone-client';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';
import { DirectoryLoader } from 'langchain/document_loaders/fs/directory';

/* Name of directory to retrieve your files from 
   Make sure to add your PDF files inside the 'docs' folder
*/
const filePath = 'docs';

export const run = async () => {
  try {
    /*load raw docs from the all files in the directory */
    const directoryLoader = new DirectoryLoader(filePath, {
      '.md': (path) => new TextLoader(path),
    });

    // const loader = new PDFLoader(filePath);
    let rawDocs = await directoryLoader.load();
    /* Split text into chunks */
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      //chunkSize: 800,
      chunkOverlap:200,
    });
    rawDocs = rawDocs.map((doc)=>{
      doc.pageContent = doc.pageContent
        .replace(/ {2}/g, ' ')
        .replace(/ {2}/g, ' ')
        .replace(/ y ears /g, ' years ')
        .replace(/y ea rs /g, 'years ')
        .replace(/Pr o /g, 'Pro ')
        .replace(/ It s /g, " It's ");
      return doc
    })
    //console.log(rawDocs[10])
    const docs = await textSplitter.splitDocuments(rawDocs);
    //console.log('split docs', JSON.stringify(docs));

    console.log('creating vector store...');
    /*create and store the embeddings in the vectorStore*/
    const embeddings = new OpenAIEmbeddings();
    const index = pinecone.Index(PINECONE_INDEX_NAME); //change to your own index name

    //embed the PDF documents
    await PineconeStore.fromDocuments(docs, embeddings, {
      pineconeIndex: index,
      //namespace: PINECONE_NAME_SPACE,
      textKey: 'text',
    });
  } catch (error) {
    console.log('error', error);
    throw new Error('Failed to ingest your data');
  }
};

(async () => {
  await run();
  console.log('ingestion complete');
})();
