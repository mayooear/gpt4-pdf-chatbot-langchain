import { Pinecone } from '@pinecone-database/pinecone';
import { PineconeAuthorizationError } from '@pinecone-database/pinecone/dist/errors/http';

export const pineconeConfig = {
  'master_swami': {
    apiKey: process.env.PINECONE_API_KEY_MASTER_SWAMI,
    environment: process.env.PINECONE_ENVIRONMENT_MASTER_SWAMI,
  },
  'whole_library': {
    apiKey: process.env.PINECONE_API_KEY_WHOLE_LIBRARY,
    environment: process.env.PINECONE_ENVIRONMENT_WHOLE_LIBRARY,
  },
  'master_swami_ingest': {
    apiKey: process.env.PINECONE_API_KEY_MASTER_SWAMI_INGEST,
    environment: process.env.PINECONE_ENVIRONMENT_MASTER_SWAMI_INGEST,
  },
  'whole_library_ingest': {
    apiKey: process.env.PINECONE_API_KEY_WHOLE_LIBRARY_INGEST,
    environment: process.env.PINECONE_ENVIRONMENT_WHOLE_LIBRARY_INGEST,
  },
};

export type PineconeConfigKey = keyof typeof pineconeConfig;

if (!process.env.PINECONE_ENVIRONMENT || !process.env.PINECONE_API_KEY_MASTER_SWAMI ||
    !process.env.PINECONE_API_KEY_WHOLE_LIBRARY) {
  throw new Error('Pinecone environment or api key vars missing');
}

async function initPinecone(apiKey: string, environment: string) {
  try {
    const pinecone = new Pinecone({
      environment: environment,
      apiKey: apiKey,
    });

    return pinecone;
  } catch (error) {
    console.log('error', error);
    throw new Error('Failed to initialize Pinecone Client');
  }
}

export const getPineconeClient = async (context: PineconeConfigKey, operation: 'ingest' | 'web' = 'web') => {
  let config;
  if (operation === 'ingest') {
    config = context.endsWith('_ingest') ? pineconeConfig[context] : pineconeConfig[`${context}_ingest` as PineconeConfigKey];
  } else {
    config = pineconeConfig[context];
  }
  console.log("API key", config.apiKey);
  console.log("environment", config.environment)

  if (!config.apiKey || !config.environment) {
    throw new Error('Invalid context or operation type provided: ' + context + ', ' + operation);
  }
  try {
    return await initPinecone(config.apiKey, config.environment);
  } catch (error) {
    if (error instanceof PineconeAuthorizationError) {
      console.error('Pinecone authorization failed:', error);
      throw new Error('Pinecone authorization failed');
    }
    throw error;
  }
}
