import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { pinecone } from '@/utils/pinecone-client';
import {
  PINECONE_INDEX_NAME,
  PINECONE_NAME_SPACE_PINECONE_DOCS_CRAWLED,
} from '@/config/pinecone';
import fs from 'fs';
import { NotionLoader } from 'langchain/document_loaders/fs/notion';
import { MarkdownTextSplitter } from 'langchain/text_splitter';
import { title } from 'process';
import { url } from 'inspector';

/* Name of directory to retrieve your files from */
const directoryPath = 'docs/input/pinecone-docs';

const urlsAndTitles = [
  {
    key: 'Choosing index type and size',
    title: 'Choosing index type and size',
    URL: 'https://docs.pinecone.io/docs/choosing-index-type-and-size',
  },
  {
    key: 'Collections',
    title: 'Collections',
    URL: 'https://docs.pinecone.io/docs/collections',
  },
  {
    key: 'Creating an index',
    title: 'Creating an index',
    URL: 'https://docs.pinecone.io/docs/creating-an-index',
  },
  {
    key: 'Examples',
    title: 'Examples',
    URL: 'https://docs.pinecone.io/docs/examples',
  },
  {
    key: 'Examples',
    title: 'Examples',
    URL: 'https://docs.pinecone.io/docs/examples',
  },
  {
    key: 'Indexes',
    title: 'Indexes',
    URL: 'https://docs.pinecone.io/docs/indexes',
  },
  {
    key: 'Examples',
    title: 'Examples',
    URL: 'https://docs.pinecone.io/docs/examples',
  },
  {
    key: 'Multitenancy',
    title: 'Multitenancy',
    URL: 'https://docs.pinecone.io/docs/multitenancy',
  },
  {
    key: 'Node.js client',
    title: 'Node.js client',
    URL: 'https://docs.pinecone.io/docs/node-client',
  },
  {
    key: 'Organizations',
    title: 'Organizations',
    URL: 'https://docs.pinecone.io/docs/organizations',
  },
  {
    key: 'Overview',
    title: 'Overview',
    URL: 'https://docs.pinecone.io/docs/overview',
  },
  {
    key: 'Projects',
    title: 'Projects',
    URL: 'https://docs.pinecone.io/docs/projects',
  },
  {
    key: 'Python client',
    title: 'Python client',
    URL: 'https://docs.pinecone.io/docs/python-client',
  },
  {
    key: 'Quickstart',
    title: 'Quickstart',
    URL: 'https://docs.pinecone.io/docs/quickstart',
  },
  {
    key: 'Sparse-dense embeddings',
    title: 'Sparse-dense embeddings',
    URL: 'https://docs.pinecone.io/docs/hybrid-search',
  },
  {
    key: 'Sparse-dense embeddings',
    title: 'Sparse-dense embeddings',
    URL: 'https://docs.pinecone.io/docs/hybrid-search',
  },
  {
    key: 'Pinecone docs',
    title: 'Pinecone docs',
    URL: 'https://docs.pinecone.io/](https://docs.pinecone.io/',
  },
];

export const run = async () => {
  try {
    /*load raw docs from the all files in the directory */
    const loader = new NotionLoader(directoryPath);

    const rawDocs = await loader.load();
    // console.log('🚀 ~ file: ingest-data-markdown.ts:24 ~ run ~ docs:', rawDocs);

    // write the rawDocs to a file system
    await fs.writeFile(
      'docs/results/rawDocs-pinecone-docs.json',
      JSON.stringify(rawDocs),
      (err) => {
        console.log('RawDocs JSON data is saved.');
      },
    );

    const arrayDocs = await Promise.all(
      rawDocs.map((row) => {
        const splitter = new MarkdownTextSplitter();
        const keyMatch = /^#\s*(.*?)\s*\n/.exec(row.pageContent);
        const key = keyMatch ? keyMatch[1].trim() : '';
        console.log(
          '🚀 ~ file: ingest-data-markdown.ts:54 ~ rawDocs.map ~ key:',
          key,
        );

        const match = urlsAndTitles.find((item) => item.key === key);
        console.log(
          '🚀 ~ file: ingest-data-markdown.ts:133 ~ rawDocs.map ~ match:',
          match,
        );

        const documents = splitter.createDocuments([row.pageContent], {
          //@ts-ignore
          metadata: {
            ...row.metadata,
            title: match?.title,
            URL: match?.URL,
          },
        });

        return documents;
      }),
    );

    const docs = arrayDocs.flat();
    //write docs to file system
    await fs.writeFile(
      'docs/results/split-pinecone-docs.json',
      JSON.stringify(docs),
      (err) => {
        console.log('Docs JSON data is saved.');
      },
    );

    console.log('creating vector store...');
    /*create and store the embeddings in the vectorStore*/
    const embeddings = new OpenAIEmbeddings();
    const index = pinecone.Index(PINECONE_INDEX_NAME); //change to your own index name
    const namespace = PINECONE_NAME_SPACE_PINECONE_DOCS_CRAWLED; //change to your own namespace
    // pinecone recommends a limit of 100 vectors per upsert request
    const upsertChunkSize = 50;

    // loop through the chunks
    for (let i = 0; i < docs.length; i += upsertChunkSize) {
      // embed the chunk
      const embeddings = new OpenAIEmbeddings();
      const chunk = docs.slice(i, i + upsertChunkSize);
      // upsert the chunk
      PineconeStore.fromDocuments(chunk, embeddings, {
        namespace,
        pineconeIndex: index,
        textKey: 'text',
      });

      console.log(`Upserted ${chunk.length} vectors to ${namespace} namespace`);

      // wait for 1 second before the next upsert
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.log('🚀 ~ file: ingest-data-pdf.ts:49 ~ run ~ error:', error);
    throw new Error('Failed to ingest your data');
  }
};

(async () => {
  await run();
  console.log('ingestion complete');
})();
