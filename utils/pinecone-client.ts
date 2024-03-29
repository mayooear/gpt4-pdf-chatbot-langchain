import { Pinecone } from '@pinecone-database/pinecone';

export const pineconeConfig = {
  'master_swami': process.env.PINECONE_API_KEY_MASTER_SWAMI,
  'whole_library': process.env.PINECONE_API_KEY_WHOLE_LIBRARY,
};

export type PineconeConfigKey = keyof typeof pineconeConfig;

if (!process.env.PINECONE_ENVIRONMENT || !process.env.PINECONE_API_KEY_MASTER_SWAMI ||
    !process.env.PINECONE_API_KEY_WHOLE_LIBRARY) {
  throw new Error('Pinecone environment or api key vars missing');
}

async function initPinecone(apiKey: string) {
  try {
    const pinecone = new Pinecone({
      environment: process.env.PINECONE_ENVIRONMENT ?? '', //this is in the dashboard
      apiKey: apiKey,
    });

    return pinecone;
    
  } catch (error) {
    console.log('error', error);
    throw new Error('Failed to initialize Pinecone Client');
  }
}

export const usePinecone = async (context: PineconeConfigKey) => {
  const apiKey = pineconeConfig[context];
  if (!apiKey) {
    throw new Error('Invalid context provided: ' + context);
  }
  return await initPinecone(apiKey);
};
