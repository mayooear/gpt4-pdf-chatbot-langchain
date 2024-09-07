import { Pinecone } from '@pinecone-database/pinecone';

let pineconeInstance: Pinecone | null = null;

async function initPinecone() {
  if (!process.env.PINECONE_API_KEY) {
    throw new Error('Pinecone API key missing');
  }
  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });

    return pinecone;
  } catch (error) {
    console.error('Error initializing Pinecone:', error);
    throw new Error('Failed to initialize Pinecone Client');
  }
}

export const getPineconeClient = async () => {
  if (!pineconeInstance) {
    try {
      pineconeInstance = await initPinecone();
    } catch (error) {
      console.error('Pinecone error:', error);
      throw new Error('Pinecone error');
    }
  }
  return pineconeInstance;
};
