import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { getPineconeClient } from '@/utils/server/pinecone-client';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import { PINECONE_INDEX_NAME } from '@/config/pinecone';
import { DirectoryLoader } from 'langchain/document_loaders/fs/directory';
import ProgressBar from 'progress';
import readline from 'readline';
import { Index } from '@pinecone-database/pinecone';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const readdir = promisify(fs.readdir);

/* Name of directory to retrieve your files from 
   Make sure to add your PDF files inside the 'docs' folder
*/
const filePath = 'docs';

export const run = async (keepData: boolean) => {
  console.log(`\nProcessing documents from ${filePath}`);

  // Print count of PDF files in the directory
  try {
    const files = await readdir(filePath);
    const pdfFiles = files.filter((file: string) => file.toLowerCase().endsWith('.pdf'));
    console.log(`Found ${pdfFiles.length} PDF files.`);
  } catch (err) {
    console.error('Unable to scan directory:', err);
    process.exit(1);
  }

  let pinecone;
  try {
    pinecone = await getPineconeClient();
  } catch (error) {
    console.error('Failed to initialize Pinecone:', error);
    return;
  }

  let pineconeIndex: Index;
  try {
    pineconeIndex = pinecone.Index(PINECONE_INDEX_NAME);
  } catch (error) {
    console.error('Error getting pinecone index:', error);
    process.exit(1);
  }

  let stats;
  try {
    stats = await pineconeIndex.describeIndexStats();
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error describing index stats:', error.message);
    } else {
      console.error('Unknown error describing index stats');
    }
    process.exit(1);
  }

  const vectorCount = stats.totalRecordCount;
  if (vectorCount && vectorCount > 0 && !keepData) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    await new Promise<void>((resolve) => {
      rl.question(`The index contains ${vectorCount} vectors. Are you sure you want to delete? (y/N) `, async (answer) => {
        if (answer.toLowerCase().charAt(0) === 'y') {
          await pineconeIndex.deleteAll();
          console.log('All vectors deleted.');
        } else {
          console.log('Deletion aborted.');
          process.exit(0);
        }
        rl.close();
        resolve();
      });
    });
  } else if (keepData) {
    console.log(`Keeping existing ${vectorCount} vectors in the index.`);
  }

  // Print count of PDF files in the directory
  try {
    const files = await readdir(filePath);
    const pdfFiles = files.filter((file: string) => path.extname(file).toLowerCase() === '.pdf');
    console.log(`Found ${pdfFiles.length} PDF files.`);
  } catch (err) {
    console.error('Unable to scan directory:', err);
    process.exit(1);
  }
  
  let rawDocs: any;
  try {
    const directoryLoader = new DirectoryLoader(filePath, {
      '.pdf': (path: string) => new PDFLoader(path),
    });
    rawDocs = await directoryLoader.load();
    console.log('Number of items in rawDocs:', rawDocs.length);
  } catch (error) {
    console.error('Failed to load documents:', error);
    return;
  }

  try {
    for (const rawDoc of rawDocs) {
      const sourceURL = rawDoc.metadata?.pdf?.info?.Subject;

      if (!sourceURL) {
        console.error('No source URL found in metadata for document:', rawDoc);
        console.error('Skipping it...');
        continue;
      }

      // Set the source URL for all pages of the document
      rawDoc.metadata.source = sourceURL;

      // Only print debug information for the first page
      if (rawDoc.metadata.loc.pageNumber === 1) {
        console.log('Processing document with source URL:', sourceURL);
        console.log('First 100 characters of document content:', rawDoc.pageContent.substring(0, 100));
        console.log('Updated metadata:', rawDoc.metadata);
      }
    }
  } catch (error) {
    console.error('Failed during document processing:', error);
    return;
  }

  let docs;
  try {
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    docs = await textSplitter.splitDocuments(rawDocs);

    // Log the structure of the first document to check for the 'text' property
    if (docs.length > 0) {
      console.log('Structure of the first document:', docs[0]);
    }

    // Check if each document has a 'text' property after splitting
    for (const doc of docs) {
      if (typeof doc.pageContent !== 'string') {
        console.error(`Document missing 'pageContent' property: ${JSON.stringify(doc)}`);
        continue; // Skip this document or handle the error as needed
      }
    }

    // Check if each document has a 'text' property after splitting
    // for (const doc of docs) {
    //   if (typeof doc.text !== 'string') {
    //     throw new Error(`Document missing 'text' property: ${JSON.stringify(doc)}`);
    //   }
    // }
  } catch (error) {
    console.error('Failed to split documents:', error);
    return;
  }

  console.log('creating vector store...');
  try {
    /* create and store the embeddings in the vectorStore */
    /* possible way to specify model: 
       const embeddings = new OpenAIEmbeddings({ modelName: 'text-similarity-babbage-001' }); */
    const embeddings = new OpenAIEmbeddings();
    const progressBar = new ProgressBar('Embedding and storing documents [:bar] :percent :etas', {
      total: rawDocs.length,
      width: 40,
    });

    // Process documents in batches instead of all at once so we can give progress bar
    const chunk = 40;
    for (let i = 0; i < rawDocs.length; i += chunk) {
      const docsBatch = rawDocs.slice(i, i + chunk);
      docsBatch.forEach((doc: any) => {
        doc.metadata.library = "Ananda Library";
      });

      await PineconeStore.fromDocuments(docsBatch, embeddings, {
        pineconeIndex,
        textKey: 'text',
      });
      
      progressBar.tick(chunk);
    }
    
    console.log(`Ingestion complete. ${rawDocs.length} documents processed.`);

  } catch (error: any) {
    if (error.message && error.message.includes("Starter index record limit reached")) {
      console.error('Error: Starter index record limit reached.');
    } else {
      console.error('Failed to embed documents or store in Pinecone:', error.message || error);
    }
  }
};

const keepData = process.argv.includes('--keep-data') || process.argv.includes('-k');
(async () => {
  await run(keepData);
})();
