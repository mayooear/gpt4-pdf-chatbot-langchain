import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { pineconeConfig, PineconeConfigKey, usePinecone } from '@/utils/pinecone-client';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import { PINECONE_INDEX_NAME } from '@/config/pinecone';
import { DirectoryLoader } from 'langchain/document_loaders/fs/directory';

/* Name of directory to retrieve your files from 
   Make sure to add your PDF files inside the 'docs' folder
*/
const filePath = 'docs';

export const run = async (collection: PineconeConfigKey) => {
  if (!collection) {
    console.error('Error: No collection provided. Please provide a valid PineconeConfigKey as an argument.');
    process.exit(1); 
  }

  let pinecone;
  try {
    pinecone = await usePinecone(collection);
  } catch (error) {
    console.error('Failed to initialize Pinecone:', error);
    return;
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
    const index = pinecone.Index(PINECONE_INDEX_NAME);
    await PineconeStore.fromDocuments(docs, embeddings, {
      pineconeIndex: index,
      // NOT SURE which of these to use. Original was text and chatGPT suggested pageContent
      // after we got a runtime error: TypeError: Cannot read properties of undefined (reading 'text')
      // textKey: 'pageContent',
      textKey: 'text',
    });
    console.log('Ingestion complete');
  } catch (error) {
    console.error('Failed to embed documents or store in Pinecone:', error);
  }
};

// arg is master_swami or whole_library or other options as shown in pinecone-client.ts
const collection = process.argv[2] as PineconeConfigKey;

(async () => {
  await run(collection);
})();
