/**
import { PINECONE_NAME_SPACE } from '@/config/pinecone';
 * Change the namespace to the namespace on Pinecone you'd like to store your embeddings.
 */

if (!process.env.PINECONE_INDEX_NAME) {
  throw new Error('Missing Pinecone index name in .env file');
}

const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME ?? '';

const PINECONE_NAME_SPACE_MORSE_FEDERICK = 'morse-frederick'; //namespace is optional for your vectors
const PINECONE_NAME_SPACE_TSLA_2020 = 'TSLA_2020'; //namespace is optional for your vectors
const PINECONE_NAME_SPACE_TSLA_2021 = 'TSLA_2021'; //namespace is optional for your vectors
const PINECONE_NAME_SPACE_TSLA_2022 = 'TSLA_2022'; //namespace is optional for your vectors
const PINECONE_NAME_SPACE_PINECONE_DOCS_CRAWLED = 'pinecone-docs-crawled'; //namespace is optional for your vectors

export {
  PINECONE_INDEX_NAME,
  PINECONE_NAME_SPACE_MORSE_FEDERICK,
  PINECONE_NAME_SPACE_TSLA_2020,
  PINECONE_NAME_SPACE_TSLA_2021,
  PINECONE_NAME_SPACE_TSLA_2022,
  PINECONE_NAME_SPACE_PINECONE_DOCS_CRAWLED,
};
