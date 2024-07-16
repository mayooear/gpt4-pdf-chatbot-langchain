import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { getPineconeClient } from '@/utils/server/pinecone-client';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import { PINECONE_INGEST_INDEX_NAME } from '@/config/pinecone';
import { DirectoryLoader } from 'langchain/document_loaders/fs/directory';
import readline from 'readline';
import { Index } from '@pinecone-database/pinecone';
import { promises as fsPromises } from 'fs';
import crypto from 'crypto';
import { Document } from 'langchain/document';
import pMap from 'p-map';
import path from 'path';

const CHECKPOINT_FILE = 'text_ingestion_checkpoint.json';
const filePath = process.env.PDF_DIRECTORY || './docs';

/**
 * Creates a unique signature for the folder based on PDF file names and modification times.
 * This helps detect changes in the folder contents between ingestion runs.
 * @param directory The path to the directory containing PDF files
 * @returns A hash string representing the folder's current state
 */
async function createFolderSignature(directory: string): Promise<string> {
  const files = await fsPromises.readdir(directory);
  const pdfFiles = files.filter((file: string) => file.toLowerCase().endsWith('.pdf'));
  
  const fileInfos = await Promise.all(pdfFiles.map(async (file) => {
    const fullPath = path.join(directory, file);
    const stats = await fsPromises.stat(fullPath);
    return `${file}:${stats.mtime.getTime()}`;
  }));

  const signatureString = fileInfos.sort().join('|');
  return crypto.createHash('md5').update(signatureString).digest('hex');
}

/**
 * Saves the current ingestion progress and folder signature to a checkpoint file.
 * @param processedDocs The number of documents processed so far
 * @param folderSignature The current folder signature
 */
async function saveCheckpoint(processedDocs: number, folderSignature: string) {
  await fsPromises.writeFile(CHECKPOINT_FILE, JSON.stringify({ processedDocs, folderSignature }));
}

/**
 * Loads the previous ingestion checkpoint, if it exists.
 * @returns An object containing the number of processed documents and folder signature, or null if no checkpoint exists
 */
async function loadCheckpoint(): Promise<{ processedDocs: number; folderSignature: string } | null> {
  try {
    const data = await fsPromises.readFile(CHECKPOINT_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

async function clearAnandaLibraryTextVectors(pineconeIndex: Index) {
  console.log("Clearing existing Ananda Library text vectors from Pinecone...");
  try {
    const prefix = 'text||Ananda_Library||';
    let paginationToken: string | undefined;
    let totalDeleted = 0;

    do {
      const response = await pineconeIndex.listPaginated({ 
        prefix, 
        paginationToken,
      });
      
      if (response.vectors && response.vectors.length > 0) {
        const vectorIds = response.vectors.map(vector => vector.id);
        
        await pineconeIndex.deleteMany(vectorIds);
        totalDeleted += vectorIds.length;
        
        console.log(`Deleted ${totalDeleted} vectors so far...`);
      }
      
      paginationToken = response.pagination?.next;
    } while (paginationToken);

    console.log(`Cleared a total of ${totalDeleted} Ananda Library text vectors.`);
  } catch (error) {
    console.error("Error clearing Ananda Library text vectors:", error);
    process.exit(1);
  }
}

async function processDocument(rawDoc: any, vectorStore: PineconeStore, index: number) {
  const sourceURL = rawDoc.metadata?.pdf?.info?.Subject;
  let title = rawDoc.metadata?.pdf?.info?.Title || 'Untitled';

  if (!sourceURL) {
    console.error('No source URL found in metadata for document:', rawDoc);
    console.error('Skipping it...');
    return;
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

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const docs = await textSplitter.splitDocuments([rawDoc]);

  const validDocs = docs.filter(doc => {
    if (typeof doc.pageContent !== 'string') {
      console.error(`Document missing 'pageContent' property: ${JSON.stringify(doc)}`);
      return false;
    }
    return true;
  });

  await pMap(validDocs, async (doc, i) => {
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
          type: "text",
          author: doc.metadata.pdf?.info?.Author || 'Unknown', 
        }
      })
    ], [id]);
  }, { concurrency: 5 });
}

let isExiting = false;

process.on('SIGINT', async () => {
  if (isExiting) {
    console.log('\nForced exit. Data may be inconsistent.');
    process.exit(1);
  } else {
    console.log('\nGraceful shutdown initiated. Press Ctrl+C again to force exit.');
    isExiting = true;
    // Optionally, you can save the current state here
  }
});

export const run = async (keepData: boolean) => {
  console.log(`\nProcessing documents from ${filePath}`);

  // Print count of PDF files in the directory
  try {
    const files = await fsPromises.readdir(filePath);
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
    pineconeIndex = pinecone.Index(PINECONE_INGEST_INDEX_NAME);
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
      const response = await pineconeIndex.listPaginated({ 
        prefix, 
        paginationToken,
      });
            
      if (response.vectors) {
        const pageVectorIds = response.vectors.map(vector => vector.id).filter(id => id !== undefined) as string[];
        console.log(`Found ${pageVectorIds.length} vectors on this page`);
        vectorIds.push(...pageVectorIds);
      } else {
        console.log('No vectors found in this response');
      }
      
      paginationToken = response.pagination?.next;
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
    if (vectorIds.length === 0) {
      console.log('The index contains 0 vectors. Proceeding with adding more.');
      rl.close();
      resolve();
    } else {
      rl.question(`The index contains ${vectorIds.length} vectors. Do you want to proceed with ${keepData ? 'adding more' : 'deleting and then adding more'}? (y/N) `, async (answer) => {
        if (answer.toLowerCase().charAt(0) !== 'y') {
          console.log('Ingestion process aborted.');
          process.exit(0);
        }
        rl.close();
        if (!keepData) {
          await clearAnandaLibraryTextVectors(pineconeIndex);
        }
        resolve();
      });
    }
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
    const vectorStore = await PineconeStore.fromExistingIndex(new OpenAIEmbeddings(), {
      pineconeIndex,
      textKey: 'text',
    });
    let startIndex = 0;
    const currentFolderSignature = await createFolderSignature(filePath);
    if (keepData) {
      const checkpoint = await loadCheckpoint();
      if (checkpoint && checkpoint.folderSignature === currentFolderSignature) {
        startIndex = checkpoint.processedDocs;
        console.log(`Resuming from document ${startIndex + 1}`);
      } else if (!checkpoint) {
        console.log('No valid checkpoint found. Starting from the beginning.');
      } else {
        console.log('Folder contents have changed. Starting from the beginning.');
      }
    }

    for (let i = startIndex; i < rawDocs.length; i++) {
      if (isExiting) {
        console.log('Graceful shutdown: saving progress...');
        await saveCheckpoint(i, currentFolderSignature);
        console.log(`Progress saved. Resumed from document ${i + 1} next time.`);
        process.exit(0);
      }

      await processDocument(rawDocs[i], vectorStore, i);
      await saveCheckpoint(i + 1, currentFolderSignature);
      console.log(`Processed document ${i + 1} of ${rawDocs.length} (${Math.floor((i + 1) / rawDocs.length * 100)}% done)`);
    }

    console.log(`Ingestion complete. ${rawDocs.length} documents processed.`);
  } catch (error: any) {
    console.error('Failed to ingest documents:', error);
  }
};

const keepData = process.argv.includes('--keep-data') || process.argv.includes('-k');
(async () => {
  await run(keepData);
})();