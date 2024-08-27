import { loadEnv } from '../utils/server/loadEnv.js';

function loadEnvVariables() {
  loadEnv();

  if (!process.env.PINECONE_INDEX_NAME) {
    throw new Error('Missing Pinecone index name in .env file');
  }

  if (
    process.env.NODE_ENV === 'development' &&
    !process.env.PINECONE_INGEST_INDEX_NAME
  ) {
    throw new Error('Missing Pinecone ingest index name in .env file');
  }
}

export function getPineconeIndexName() {
  loadEnvVariables();
  return process.env.PINECONE_INDEX_NAME ?? '';
}

export function getPineconeIngestIndexName() {
  loadEnvVariables();
  return process.env.PINECONE_INGEST_INDEX_NAME ?? '';
}
