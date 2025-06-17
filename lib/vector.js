import { Pinecone } from '@pinecone-database/pinecone';

// Configuration constants (consider moving to a dedicated config file or using process.env directly)
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_ENVIRONMENT = process.env.PINECONE_ENVIRONMENT;

// Define a specific namespace for products, as per subtask requirements
const PINECONE_NAMESPACE_PRODUCTS = process.env.PINECONE_NAMESPACE_PRODUCTS || 'products-namespace';


let pineconeClient = null;

/**
 * Initializes and returns a Pinecone client instance.
 * Throws an error if environment variables are missing or initialization fails.
 */
async function initPineconeClient() {
  if (!PINECONE_ENVIRONMENT || !PINECONE_API_KEY || !PINECONE_INDEX_NAME) {
    throw new Error(
      'Pinecone environment, API key, or index name vars are missing. Check environment variables.'
    );
  }

  try {
    const pinecone = new Pinecone({
      apiKey: PINECONE_API_KEY,
      environment: PINECONE_ENVIRONMENT,
    });
    // Test connection or list indexes to ensure client is working (optional)
    // await pinecone.listIndexes();
    return pinecone;
  } catch (error) {
    console.error('Failed to initialize Pinecone Client:', error);
    throw new Error('Failed to initialize Pinecone Client');
  }
}

/**
 * Returns a shared instance of the Pinecone client, initializing it if necessary.
 */
export const getPineconeClient = async () => {
  if (!pineconeClient) {
    pineconeClient = await initPineconeClient();
  }
  return pineconeClient;
};

/**
 * Upserts a product vector into the Pinecone index.
 * @param {string} productId The unique ID of the product.
 * @param {number[]} embedding The embedding vector for the product.
 * @param {object} metadata Optional metadata for the vector.
 * @returns {Promise<object>} The result of the upsert operation.
 */
export const upsertProductVector = async (productId, embedding, metadata = {}) => {
  if (!productId || !embedding || embedding.length === 0) {
    throw new Error('Product ID and a non-empty embedding vector are required for upsert.');
  }

  const client = await getPineconeClient();
  const index = client.Index(PINECONE_INDEX_NAME);

  const vector = {
    id: productId,
    values: embedding,
    metadata: {
      ...metadata, // Include any other relevant metadata
      productId: productId, // Ensure productId is part of metadata for easier lookup/filtering
      lastUpdated: new Date().toISOString(),
    },
  };

  try {
    // Upsert into the defined product namespace
    const upsertResponse = await index.namespace(PINECONE_NAMESPACE_PRODUCTS).upsert([vector]);
    console.log(`Successfully upserted vector for product ${productId} into namespace ${PINECONE_NAMESPACE_PRODUCTS}.`);
    return upsertResponse;
  } catch (error) {
    console.error(`Error upserting vector for product ${productId} to Pinecone:`, error);
    throw new Error(`Failed to upsert vector to Pinecone: ${error.message}`);
  }
};

// Example of how to get the index and namespace for other operations if needed:
// export const getProductVectorIndex = async () => {
//   const client = await getPineconeClient();
//   return client.Index(PINECONE_INDEX_NAME).namespace(PINECONE_NAMESPACE_PRODUCTS);
// };

// Note: The original `pinecone-client.ts` immediately awaited `initPinecone()`.
// Here, `getPineconeClient` provides a lazy initialization, which is often better for serverless environments
// as client initialization only happens when needed.
// Ensure PINECONE_NAMESPACE_PRODUCTS is set in your environment variables if you want to override the default 'products-namespace'.
