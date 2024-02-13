import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { pinecone } from '@/utils/pinecone-client';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import { PINECONE_INDEX_NAME } from '@/config/pinecone';
import { DirectoryLoader } from 'langchain/document_loaders/fs/directory';

/* Name of directory to retrieve your files from 
   Make sure to add your PDF files inside the 'docs' folder
*/
const filePath = 'docs';

export const run = async () => {
  try {
    /*load raw docs from the all files in the directory */
    const directoryLoader = new DirectoryLoader(filePath, {
      '.pdf': (path) => new PDFLoader(path),
    });

    // const loader = new PDFLoader(filePath);
    let rawDocs = await directoryLoader.load();
    console.log('Number of items in rawDocs:', rawDocs.length);

    // rawDocs = rawDocs.slice(0, 20);

    let lastSourceURL: string | null = null;

    // Add source to metadata for each document
    for (const rawDoc of rawDocs) {
    	// Print the existing source if available
        let lines = rawDoc.pageContent.split('\n');
        if (lines.length > 1) {
            // Get the first 30 characters of the second line
            let preview = lines[1].substring(0, 30);
            console.log('Preview of the second line:', preview);
        } else {
            // Handle the case where there is no second line
            console.log('No second line available in pageContent.');
        }

        // Use a regex to match "SOURCE:" followed by any non-whitespace characters
        const sourceMatch = rawDoc.pageContent.match(/^SOURCE: (\S+)/m);

        // Extract the URL, which will be captured in the first group of the regex match.
        // If not, assume this is a continuation of the last source URL seen.
        const sourceURL: string | null = sourceMatch ? sourceMatch[1] : lastSourceURL;
        lastSourceURL = sourceURL;

        console.log('Extracted source URL:', sourceURL);
        console.log();

      	if (rawDoc.metadata) {
            rawDoc.metadata.source = sourceURL;
    	} else {
            rawDoc.metadata = { source: sourceURL };
	    }
    }

    /* Split text into chunks */
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const docs = await textSplitter.splitDocuments(rawDocs);
    // console.log('split docs', docs);

    console.log('creating vector store...');
    /*create and store the embeddings in the vectorStore*/
    /* possible way to specify model: 
       const embeddings = new OpenAIEmbeddings({ modelName: 'text-similarity-babbage-001' }); */
    const embeddings = new OpenAIEmbeddings();
    const index = pinecone.Index(PINECONE_INDEX_NAME); //change to your own index name

    //embed the PDF documents
    await PineconeStore.fromDocuments(docs, embeddings, {
      pineconeIndex: index,
//      namespace: PINECONE_NAME_SPACE,
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
