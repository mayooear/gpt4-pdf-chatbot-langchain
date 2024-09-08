/**
 * This script ingests PDF documents from a specified directory into a Pinecone vector database.
 * It processes the documents, splits them into chunks, and stores them as embeddings for efficient retrieval.
 *
 * The script supports resuming ingestion from checkpoints and handles graceful shutdowns.
 *
 * Note: If you encounter a "Warning: TT: undefined function" message during execution,
 * it can be safely ignored. This is a known issue related to font recovery and does not
 * affect the overall functionality of the script.
 * @see https://github.com/mozilla/pdf.js/issues/3768#issuecomment-36468349
 */

import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { getPineconeClient } from '@/utils/server/pinecone-client';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import { getPineconeIngestIndexName } from '@/config/pinecone';
import { DirectoryLoader } from 'langchain/document_loaders/fs/directory';
import readline from 'readline';
import { Index } from '@pinecone-database/pinecone';
import { promises as fsPromises } from 'fs';
import crypto from 'crypto';
import { Document } from 'langchain/document';
import pMap from 'p-map';
import path from 'path';
import { parseArgs } from 'util';
import { config } from 'dotenv';
import { Pinecone } from '@pinecone-database/pinecone';

const CHECKPOINT_FILE = './pdf-docs/text_ingestion_checkpoint.json';

/**
 * Creates a unique signature for the folder based on PDF file names and modification times.
 * This helps detect changes in the folder contents between ingestion runs.
 * @param directory The path to the directory containing PDF files
 * @returns A hash string representing the folder's current state
 */
async function createFolderSignature(directory: string): Promise<string> {
  async function getFilesRecursively(dir: string): Promise<string[]> {
    const entries = await fsPromises.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          console.log(`Searching subdirectory: ${fullPath}`);
          return getFilesRecursively(fullPath);
        } else {
          return fullPath;
        }
      }),
    );
    return files.flat();
  }

  const allFiles = await getFilesRecursively(directory);
  const pdfFiles = allFiles.filter((file) =>
    file.toLowerCase().endsWith('.pdf'),
  );
  console.log(`Total PDF files found: ${pdfFiles.length}`);

  const fileInfos = await Promise.all(
    pdfFiles.map(async (file) => {
      const stats = await fsPromises.stat(file);
      return `${file}:${stats.mtime.getTime()}`;
    }),
  );

  const signatureString = fileInfos.sort().join('|');
  return crypto.createHash('md5').update(signatureString).digest('hex');
}

/**
 * Saves the current ingestion progress and folder signature to a checkpoint file.
 * @param processedDocs The number of documents processed so far
 * @param folderSignature The current folder signature
 */
async function saveCheckpoint(processedDocs: number, folderSignature: string) {
  await fsPromises.writeFile(
    CHECKPOINT_FILE,
    JSON.stringify({ processedDocs, folderSignature }),
  );
}

/**
 * Loads the previous ingestion checkpoint, if it exists.
 * @returns An object containing the number of processed documents and folder signature, or null if no checkpoint exists
 */
async function loadCheckpoint(): Promise<{
  processedDocs: number;
  folderSignature: string;
} | null> {
  try {
    const data = await fsPromises.readFile(CHECKPOINT_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

async function clearAnandaLibraryTextVectors(
  pineconeIndex: Index,
  libraryName: string,
) {
  console.log(`Clearing existing ${libraryName} text vectors from Pinecone...`);
  try {
    const prefix = `text||${libraryName}||`;
    let paginationToken: string | undefined;
    let totalDeleted = 0;

    do {
      const response = await pineconeIndex.listPaginated({
        prefix,
        paginationToken,
      });

      if (response.vectors && response.vectors.length > 0) {
        const vectorIds = response.vectors.map((vector) => vector.id);

        await pineconeIndex.deleteMany(vectorIds);
        totalDeleted += vectorIds.length;

        console.log(`Deleted ${totalDeleted} vectors so far...`);
      }

      paginationToken = response.pagination?.next;
    } while (paginationToken);

    console.log(
      `Cleared a total of ${totalDeleted} ${libraryName} text vectors.`,
    );
  } catch (error) {
    console.error(`Error clearing ${libraryName} text vectors:`, error);
    process.exit(1);
  }
}

async function processDocument(
  rawDoc: Document,
  vectorStore: PineconeStore,
  index: number,
  libraryName: string,
) {
  let sourceURL = rawDoc.metadata?.pdf?.info?.Subject;
  const title = rawDoc.metadata?.pdf?.info?.Title || 'Untitled';

  if (!sourceURL) {
    // temporarily set soure url to env var value if set
    sourceURL = process.env.SOURCE_URL;
    if (!sourceURL) {
      console.error(
        'ERROR: No source URL found in metadata for document:',
        rawDoc,
      );
      console.error('Skipping it...');
      return;
    }
  }

  // Set the source URL and title for all pages of the document
  rawDoc.metadata.source = sourceURL;
  rawDoc.metadata.title = title;

  // Only print debug information for the first page
  if (rawDoc.metadata.loc.pageNumber === 1) {
    console.log('Processing document with source URL:', sourceURL);
    console.log('Document title:', title);
    console.log(
      'First 100 characters of document content:',
      rawDoc.pageContent.substring(0, 100),
    );
    console.log('Updated metadata:', rawDoc.metadata);
  }

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 500,
  });
  const docs = await textSplitter.splitDocuments([rawDoc]);

  const validDocs = docs.filter((doc) => {
    if (typeof doc.pageContent !== 'string') {
      console.error(
        `Document missing 'pageContent' property: ${JSON.stringify(doc)}`,
      );
      return false;
    }
    return true;
  });

  // Process in smaller batches
  // 9/4/24 MO: trying to avoid an error from too large a message length but beware
  // this increases API costs
  const batchSize = 10;
  for (let i = 0; i < validDocs.length; i += batchSize) {
    const batch = validDocs.slice(i, i + batchSize);

    await pMap(
      batch,
      async (doc, j) => {
        const title = doc.metadata.pdf?.info?.Title || 'Untitled';
        const sanitizedTitle = title
          .replace(/\s+/g, '_')
          .replace(/[^a-zA-Z0-9_]/g, '')
          .substring(0, 40);

        const contentHash = crypto
          .createHash('md5')
          .update(doc.pageContent)
          .digest('hex')
          .substring(0, 8);
        const id = `text||${libraryName}||${sanitizedTitle}||${contentHash}||chunk${
          i + j + 1
        }`;

        try {
          // Minimize metadata
          const minimalMetadata = {
            id: id,
            library: libraryName,
            type: 'text',
            author: doc.metadata.pdf?.info?.Author || 'Unknown',
            source: doc.metadata.source,
            title: doc.metadata.title,
            text: doc.pageContent,
          };

          await vectorStore.addDocuments(
            [
              new Document({
                pageContent: doc.pageContent,
                metadata: minimalMetadata,
              }),
            ],
            [id],
          );
        } catch (error) {
          console.error(`Error processing chunk ${i + j + 1}: ${error}`);
          console.error(`Chunk size: ${JSON.stringify(doc).length} bytes`);
          throw error;
        }
      },
      { concurrency: 2 },
    );
  }
}

let isExiting = false;

process.on('SIGINT', async () => {
  if (isExiting) {
    console.log('\nForced exit. Data may be inconsistent.');
    process.exit(1);
  } else {
    console.log(
      '\nGraceful shutdown initiated. Press Ctrl+C again to force exit.',
    );
    isExiting = true;
  }
});

async function createPineconeIndexIfNotExists(
  pinecone: Pinecone,
  indexName: string,
) {
  try {
    await pinecone.describeIndex(indexName);
    console.log(`Index ${indexName} already exists.`);
  } catch (error: unknown) {
    if (
      (error instanceof Error && error.name === 'PineconeNotFoundError') ||
      (typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        error.status === 404)
    ) {
      console.log(`Index ${indexName} does not exist. Creating...`);
      try {
        await pinecone.createIndex({
          name: indexName,
          dimension: 1536,
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1', // or your preferred region
            },
          },
        });
        console.log(`Index ${indexName} created successfully.`);
      } catch (createError) {
        console.error('Error creating Pinecone index:', createError);
        process.exit(1);
      }
    } else {
      console.error('Error checking Pinecone index:', error);
      process.exit(1);
    }
  }
}

export const run = async (keepData: boolean, libraryName: string) => {
  console.log(`\nProcessing documents from ${filePath}`);

  // Print count of PDF files in the directory
  try {
    const files = await fsPromises.readdir(filePath);
    const pdfFiles = files.filter((file: string) =>
      file.toLowerCase().endsWith('.pdf'),
    );
    console.log(`Found ${pdfFiles.length} PDF files.`);
  } catch (err) {
    console.error('Unable to scan directory:', err);
    process.exit(1);
  }

  console.log('PINECONE_API_KEY:', process.env.PINECONE_API_KEY);
  console.log('PINECONE_ENVIRONMENT:', process.env.PINECONE_ENVIRONMENT);

  let pinecone: Pinecone;
  try {
    pinecone = await getPineconeClient();
    console.log('Pinecone client initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Pinecone:', error);
    return;
  }

  const indexName = getPineconeIngestIndexName();
  console.log('Attempting to create/check index:', indexName);
  await createPineconeIndexIfNotExists(pinecone, indexName);

  let pineconeIndex: Index;
  try {
    pineconeIndex = pinecone.Index(indexName);
  } catch (error) {
    console.error('Error getting pinecone index:', error);
    process.exit(1);
  }

  if (!keepData) {
    const prefix = `text||${libraryName}||`;
    const vectorIds: string[] = [];
    let paginationToken: string | undefined;

    console.log(`Attempting to list vectors with prefix: "${prefix}"`);

    try {
      do {
        if (isExiting) {
          console.log('Graceful shutdown: stopping vector count.');
          break;
        }

        const response = await pineconeIndex.listPaginated({
          prefix,
          paginationToken,
        });

        if (response.vectors) {
          const pageVectorIds = response.vectors
            .map((vector) => vector.id)
            .filter((id) => id !== undefined) as string[];
          console.log(`Found ${pageVectorIds.length} vectors on this page`);
          vectorIds.push(...pageVectorIds);
        } else {
          console.log('No vectors found in this response');
        }

        paginationToken = response.pagination?.next;
      } while (paginationToken && !isExiting);
    } catch (error) {
      console.error('Error listing records:', error);
      process.exit(1);
    }

    if (isExiting) {
      console.log('Vector counting interrupted. Exiting...');
      process.exit(0);
    }

    console.log(`Total vectors found: ${vectorIds.length}`);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    await new Promise<void>((resolve) => {
      if (vectorIds.length === 0) {
        console.log(
          'The index contains 0 vectors. Proceeding with adding more.',
        );
        rl.close();
        resolve();
      } else {
        rl.question(
          `The index contains ${vectorIds.length} vectors. Do you want to proceed with deleting and then adding more? (y/N) `,
          async (answer) => {
            if (answer.toLowerCase().charAt(0) !== 'y') {
              console.log('Ingestion process aborted.');
              process.exit(0);
            }
            rl.close();
            await clearAnandaLibraryTextVectors(pineconeIndex, libraryName);
            resolve();
          },
        );
      }
    });
  } else {
    console.log('Keeping existing data. Proceeding with adding more vectors.');
  }

  let rawDocs: Document[];
  try {
    console.log(`Searching for PDFs in: ${filePath}`);
    const directoryLoader = new DirectoryLoader(
      filePath,
      {
        '.pdf': (path: string) => {
          return new PDFLoader(path);
        },
      },
      true,
    );
    rawDocs = await directoryLoader.load();
    console.log('Number of items in rawDocs:', rawDocs.length);
  } catch (error) {
    console.error('Failed to load documents:', error);
    return;
  }

  try {
    const vectorStore = await PineconeStore.fromExistingIndex(
      new OpenAIEmbeddings(),
      {
        pineconeIndex,
        textKey: 'text',
      },
    );
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
        console.log(
          'Folder contents have changed. Starting from the beginning.',
        );
      }
    }

    for (let i = startIndex; i < rawDocs.length; i++) {
      if (isExiting) {
        console.log('Graceful shutdown: saving progress...');
        await saveCheckpoint(i, currentFolderSignature);
        console.log(
          `Progress saved. Resumed from document ${i + 1} next time.`,
        );
        process.exit(0);
      }

      try {
        await processDocument(rawDocs[i], vectorStore, i, libraryName);
        await saveCheckpoint(i + 1, currentFolderSignature);
        console.log(
          `Processed document ${i + 1} of ${rawDocs.length} (${Math.floor(
            ((i + 1) / rawDocs.length) * 100,
          )}% done)`,
        );
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          (error.message.includes('InsufficientQuotaError') ||
            error.message.includes('429'))
        ) {
          console.error('OpenAI API quota exceeded.');
          process.exit(1);
        } else {
          throw error; // Re-throw if it's not the quota error
        }
      }
    }

    console.log(`Ingestion complete. ${rawDocs.length} documents processed.`);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to ingest documents';
    console.error('Failed to ingest documents:', errorMessage);
    process.exit(1);
  }
};

function loadEnv(site: string) {
  const envFile = path.join(process.cwd(), `.env.${site}`);
  config({ path: envFile });
  console.log(`Loaded environment from: ${envFile}`);
}

const { values } = parseArgs({
  options: {
    'file-path': { type: 'string' },
    site: { type: 'string' },
    'library-name': { type: 'string' },
    'keep-data': { type: 'boolean', short: 'k' },
  },
});

const site = values['site'];
if (!site) {
  console.error(
    'Error: No site specified. Please provide a site using the --site option.',
  );
  process.exit(1);
}
loadEnv(site);
console.log('PINECONE_API_KEY:', process.env.PINECONE_API_KEY);

if (!values['file-path']) {
  console.error(
    'Error: No file path specified. Please provide a file path using the --file-path option.',
  );
  process.exit(1);
}
const filePath = path.resolve(values['file-path']);
console.log(`Using file path: ${filePath}`);

const theLibraryName = values['library-name'] || 'Default Library';

const keepData = values['keep-data'] || false;

(async () => {
  await run(keepData, theLibraryName);
})();
