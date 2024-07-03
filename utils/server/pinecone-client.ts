import { Pinecone } from '@pinecone-database/pinecone';

if (!process.env.PINECONE_API_KEY) {
  throw new Error('Pinecone API key missing');
}

async function initPinecone() {
  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || '',
    });

    return pinecone;
  } catch (error) {
    console.log('error', error);
    throw new Error('Failed to initialize Pinecone Client');
  }
}

export const getPineconeClient = async () => {
  try {
    return await initPinecone();
  } catch (error) {
    console.error('Pinecone error:', error);
    throw new Error('Pinecone error');
  }
};
