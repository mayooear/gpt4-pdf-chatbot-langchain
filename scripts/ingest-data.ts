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
import { Pinecone } from '@pinecone-database/pinecone';
import crypto from 'crypto';
import { Document } from 'langchain/document';

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

  const prefix = 'text||Ananda_Library||';

  let vectorIds: string[] = [];
  let paginationToken: string | undefined;

  console.log(`Attempting to list vectors with prefix: "${prefix}"`);

  try {
    do {
      console.log(`Fetching page${paginationToken ? ' with token: ' + paginationToken : ''}`);
      const response = await pineconeIndex.listPaginated({ 
        prefix, 
        paginationToken,
      });
      
      console.log(`Received response:`, JSON.stringify(response, null, 2));
      
      if (response.vectors) {
        const pageVectorIds = response.vectors.map(vector => vector.id).filter(id => id !== undefined) as string[];
        console.log(`Found ${pageVectorIds.length} vectors on this page`);
        vectorIds.push(...pageVectorIds);
      } else {
        console.log('No vectors found in this response');
      }
      
      paginationToken = response.pagination?.next;
      console.log(`Next pagination token: ${paginationToken || 'None'}`);
    } while (paginationToken);

  } catch (error) {
    console.error('Error listing records:', error);
    process.exit(1);
  }

  console.log(`Total vectors found: ${vectorIds.length}`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  await new Promise<void>((resolve) => {
    rl.question(`The index contains ${vectorIds.length} vectors. Do you want to proceed with adding more? (y/N) `, async (answer) => {
      if (answer.toLowerCase().charAt(0) !== 'y') {
        console.log('Ingestion process aborted.');
        process.exit(0);
      }
      rl.close();
      resolve();
    });
  });

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
      let title = rawDoc.metadata?.pdf?.info?.Title || 'Untitled';

      if (!sourceURL) {
        console.error('No source URL found in metadata for document:', rawDoc);
        console.error('Skipping it...');
        continue;
      }

      // Set the source URL and title for all pages of the document
      rawDoc.metadata.source = sourceURL;
      rawDoc.metadata.title = title;

      // Only print debug information for the first page
      if (rawDoc.metadata.loc.pageNumber === 1) {
        console.log('Processing document with source URL:', sourceURL);
        console.log('Document title:', title);
        console.log('First 100 characters of document content:', rawDoc.pageContent.substring(0, 100));
        console.log('Updated metadata:', rawDoc.metadata);
      }
    }
  } catch (error) {
    console.error('Failed during document processing:', error);
    return;
  }

  try {
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const docs = await textSplitter.splitDocuments(rawDocs);

    // Log the structure of the first document to check for the 'pageContent' property
    if (docs.length > 0) {
      console.log('Structure of the first document:', docs[0]);
    }

    // Check if each document has a 'text' property after splitting
    const validDocs = docs.filter(doc => {
      if (typeof doc.pageContent !== 'string') {
        console.error(`Document missing 'pageContent' property: ${JSON.stringify(doc)}`);
        return false;
      }
      return true;
    });

    const embeddings = new OpenAIEmbeddings();
    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex,
      textKey: 'text',
    });

    const progressBar = new ProgressBar('Embedding and storing documents [:bar] :percent :etas', {
      total: validDocs.length,
      width: 40,
    });

    for (let i = 0; i < validDocs.length; i++) {
      const doc = validDocs[i];
      let title = doc.metadata.pdf?.info?.Title || 'Untitled';
      title = title
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_]/g, '')
        .substring(0, 40);
      
      const contentHash = crypto.createHash('md5').update(doc.pageContent).digest('hex').substring(0, 8);
      const id = `text||Ananda_Library||${title}||${contentHash}||chunk${i + 1}`;
      
      await vectorStore.addDocuments([
        new Document({
          pageContent: doc.pageContent,
          metadata: {
            ...doc.metadata,
            id: id,
            library: "Ananda Library",
          }
        })
      ], [id]);
      
      progressBar.tick();
    }
    
    console.log(`Ingestion complete. ${validDocs.length} documents processed.`);

  } catch (error: any) {
    console.error('Failed to ingest documents:', error);
  }
};

const keepData = process.argv.includes('--keep-data') || process.argv.includes('-k');
(async () => {
  await run(keepData);
})();
