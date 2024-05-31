import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { pineconeConfig, PineconeConfigKey, getPineconeClient } from '@/utils/pinecone-client';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import { PINECONE_INDEX_NAME } from '@/config/pinecone';
import { DirectoryLoader } from 'langchain/document_loaders/fs/directory';
import ProgressBar from 'progress';
import readline from 'readline';
import { collectionsConfig, CollectionKey } from '@/utils/collectionsConfig';
import { Index, RecordMetadata } from '@pinecone-database/pinecone';

/* Name of directory to retrieve your files from 
   Make sure to add your PDF files inside the 'docs' folder
*/
const filePath = 'docs';

export const run = async (collection: PineconeConfigKey) => {
  if (!collection) {
    console.error('Error: No collection provided. Please provide a valid PineconeConfigKey as an argument.');
    process.exit(1); 
  }

  console.log(`Processing collection: ${collectionsConfig[collection as CollectionKey]}`);

  let pinecone;
  try {
    pinecone = await getPineconeClient(collection, 'ingest');
  } catch (error) {
    console.error('Failed to initialize Pinecone:', error);
    return;
  }

  const confirmProceed = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  const answer = await new Promise<string>((resolve) => {
    confirmProceed.question('Are you sure you want to proceed with data ingestion to that API key? (y/N) ', resolve);
  });

  if (answer.toLowerCase() === 'y') {
    confirmProceed.close();
  } else {
    console.log('Data ingestion aborted.');
    confirmProceed.close();
    process.exit(0);
  }

  let pineconeIndex: Index<RecordMetadata>;
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
  if (vectorCount && vectorCount > 0) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(`The index contains ${vectorCount} vectors. Are you sure you want to delete? (y/N) `, async (answer) => {
      if (answer.toLowerCase().charAt(0) === 'y') {
        await pineconeIndex.deleteAll();
        console.log('All vectors deleted.');
      } else {
        console.log('Deletion aborted.');
        process.exit(0);
      }
      rl.close();
    });
  }
  
  let rawDocs;
  try {
    const directoryLoader = new DirectoryLoader(filePath, {
      '.pdf': (path) => new PDFLoader(path),
    });
    rawDocs = await directoryLoader.load();
    console.log('Number of items in rawDocs:', rawDocs.length);
  } catch (error) {
    console.error('Failed to load documents:', error);
    return;
  }

  try {
    let lastSourceURL: string | null = null;
    // Add source to metadata for each document
    for (const rawDoc of rawDocs) {
        // Use a regex to match "SOURCE:" followed by any non-whitespace characters
        const sourceMatch = rawDoc.pageContent.match(/^SOURCE: (\S+)/m);

        // Extract the URL, which will be captured in the first group of the regex match.
        // If not, assume this is a continuation of the last source URL seen.
        const sourceURL: string | null = sourceMatch ? sourceMatch[1] : lastSourceURL;
        lastSourceURL = sourceURL;

      	if (rawDoc.metadata) {
            rawDoc.metadata.source = sourceURL;
    	} else {
            rawDoc.metadata = { source: sourceURL };
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
    const progressBar = new ProgressBar('Embedding and storing documents [:bar] :percent :eta', {
      total: rawDocs.length,
      width: 40,
    });

    // Process documents in batches instead of all at once so we can give progress bar
    const chunk = 40;
    for (let i = 0; i < rawDocs.length; i += chunk) {
      const docsBatch = rawDocs.slice(i, i + chunk);
      await PineconeStore.fromDocuments(docsBatch, embeddings, {
        pineconeIndex: pineconeIndex as any,
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

// arg is master_swami or whole_library or other options as shown in pinecone-client.ts
const collection = process.argv[2] as PineconeConfigKey;

(async () => {
  await run(collection);
})();
