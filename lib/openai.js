import { OpenAIEmbeddings } from '@langchain/openai';

if (!process.env.OPENAI_API_KEY) {
  // This will only throw an error when the file is loaded,
  // which might be at build time or when an API route/page using it is first hit.
  // Consider a check within the function if you want to allow the app to run
  // without OPENAI_API_KEY if embedding generation is optional.
  console.warn("OPENAI_API_KEY is not set. Embedding generation will fail.");
}

const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: "text-embedding-ada-002", // Or your preferred model
});

/**
 * Generates an embedding for a product based on its name, description, and claims.
 * @param {object} product The product object.
 * @param {string} product.name
 * @param {string} [product.description]
 * @param {string[] | object[]} [product.claims]
 * @returns {Promise<number[] | null>} The embedding vector, or null if input is insufficient or error occurs.
 */
export const getProductEmbedding = async (product) => {
  if (!product || !product.name) {
    console.warn("Product name is required to generate embedding.");
    return null;
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error("OpenAI API key not configured. Cannot generate embeddings.");
    // Optionally, you could throw an error here to make it more explicit
    // throw new Error("OpenAI API key not configured.");
    return null;
  }

  // Concatenate relevant text fields to create a single string for embedding
  let textToEmbed = `Product Name: ${product.name}`;
  if (product.description) {
    textToEmbed += `\nDescription: ${product.description}`;
  }
  if (product.claims && product.claims.length > 0) {
    // Assuming claims is an array of strings or objects with a 'text' property
    const claimsText = product.claims
      .map(claim => (typeof claim === 'string' ? claim : claim.text))
      .filter(Boolean)
      .join(', ');
    if (claimsText) {
      textToEmbed += `\nClaims: ${claimsText}`;
    }
  }
  // Add other relevant fields like nutrition_info if they are textual and relevant for similarity
  // e.g., if (product.nutrition_info?.ingredients) textToEmbed += `\nIngredients: ${product.nutrition_info.ingredients}`;

  if (textToEmbed.length === `Product Name: ${product.name}`.length && !product.description && (!product.claims || product.claims.length === 0) ) {
    // Only product name was provided, which is fine, but just noting if other fields were expected.
    // console.log(`Generating embedding for product "${product.name}" using name only.`);
  }

  try {
    const vector = await embeddings.embedQuery(textToEmbed);
    return vector;
  } catch (error) {
    console.error(`Error generating embedding for product "${product.name}":`, error);
    // Potentially throw the error if the caller should handle retry/failure explicitly
    return null;
  }
};
