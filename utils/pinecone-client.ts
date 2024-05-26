import { Pinecone } from '@pinecone-database/pinecone';

export const pineconeConfig = {
  'master_swami': process.env.PINECONE_API_KEY_MASTER_SWAMI,
  'whole_library': process.env.PINECONE_API_KEY_WHOLE_LIBRARY,
  'master_swami_ingest': process.env.PINECONE_API_KEY_MASTER_SWAMI_INGEST,
  'whole_library_ingest': process.env.PINECONE_API_KEY_WHOLE_LIBRARY_INGEST,
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

export const getPineconeClient = async (context: PineconeConfigKey, operation: 'ingest' | 'web' = 'web') => {
  let apiKey;
  if (operation === 'ingest') {
    // Use ingest keys for ingestion operations
    apiKey = context.endsWith('_ingest') ? pineconeConfig[context] : pineconeConfig[`${context}_ingest` as PineconeConfigKey];
  } else {
    // Use web keys for web operations
    apiKey = pineconeConfig[context];
  }
  console.log("API key", apiKey);

  if (!apiKey) {
    throw new Error('Invalid context or operation type provided: ' + context + ', ' + operation);
  }
  return await initPinecone(apiKey);
};