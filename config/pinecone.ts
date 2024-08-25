/**
 * Change the namespace to the namespace on Pinecone you'd like to store your embeddings.
 */

import dotenv from 'dotenv';
import path from 'path';

function loadEnvVariables() {
  const site = process.env.SITE_ID || 'default';
  const envFile = path.join(process.cwd(), `.env.${site}`);
  dotenv.config({ path: envFile });

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
