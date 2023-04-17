import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { Chroma } from 'langchain/vectorstores';
import { DirectoryLoader } from 'langchain/document_loaders/fs/directory';
import { CustomPDFLoader } from '@/utils/customPDFLoader';
import { CHROMA_NAME_SPACE } from '@/config/chroma';

/* Name of directory to retrieve your files from */
const filePath = 'docs';

export const run = async () => {
    try {
        /*load raw docs from the all files in the directory */
        const directoryLoader = new DirectoryLoader(filePath, {
            '.pdf': (path) => new CustomPDFLoader(path),
        });

        // const loader = new PDFLoader(filePath);
        const rawDocs = await directoryLoader.load();

        /* Split text into chunks */
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });

        const docs = await textSplitter.splitDocuments(rawDocs);
        console.log('split docs', docs);

        console.log('creating vector store...');
        /*create and store the embeddings in the vectorStore*/
        const embeddings = new OpenAIEmbeddings();

        //embed the PDF documents
        const vectorStore = await Chroma.fromDocuments(docs, embeddings, {
            collectionName: CHROMA_NAME_SPACE,
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
