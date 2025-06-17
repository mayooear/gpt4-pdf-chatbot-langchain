import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]'; // Corrected path again
import { OpenAIEmbeddings } from '@langchain/openai';
import { OpenAI } from '@langchain/openai'; // LLM for chat completions
import { getPineconeClient } from '../../lib/vector'; // Using our Pinecone client wrapper
import { supabase } from '../../lib/db'; // Direct Supabase client
import { logLead } from '../../lib/db';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE as DEFAULT_PINECONE_NAMESPACE } from '../../config/pinecone'; // Import default namespace

// Define a specific namespace for products, as per subtask requirements
const PINECONE_NAMESPACE_PRODUCTS = process.env.PINECONE_NAMESPACE_PRODUCTS || DEFAULT_PINECONE_NAMESPACE || 'products-namespace';


// Initialize OpenAI clients
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: "text-embedding-ada-002",
});

const llm = new OpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: 'gpt-3.5-turbo', // Or 'gpt-4' or your preferred model
  temperature: 0.7, // Adjust as needed
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { question, history } = req.body; // History might be useful for follow-up questions

  // Authenticate user
  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user || !session.user.id) {
    return res.status(401).json({ error: 'Unauthorized: User not logged in.' });
  }
  const userId = session.user.id; // This is the database ID from our NextAuth callbacks

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!question) {
    return res.status(400).json({ message: 'No question in the request' });
  }

  const sanitizedQuestion = question.trim().replaceAll('\n', ' ');

  try {
    // 1. Generate embedding for the question
    const questionEmbedding = await embeddings.embedQuery(sanitizedQuestion);
    if (!questionEmbedding) {
      throw new Error('Failed to generate question embedding.');
    }

    // 2. Query Pinecone for relevant product IDs
    const pineconeClient = await getPineconeClient();
    const index = pineconeClient.Index(PINECONE_INDEX_NAME);

    const queryResponse = await index.namespace(PINECONE_NAMESPACE_PRODUCTS).query({
      topK: 5, // Number of top results to fetch
      vector: questionEmbedding,
      includeMetadata: true, // Assuming product IDs are in metadata
      // includeValues: false, // Not needed for this step
    });

    const productIds = queryResponse.matches
      ?.map((match) => match.metadata?.productId as string) // Ensure 'productId' matches metadata key
      .filter((id): id is string => !!id);

    let productContext = '';
    let retrievedProducts: any[] = [];

    if (productIds && productIds.length > 0) {
      // 3. Fetch full product details from Supabase
      const { data: products, error: dbError } = await supabase
        .from('products')
        .select('*') // Select all or specific fields needed for the prompt
        .in('id', productIds);

      if (dbError) {
        console.error('Supabase error fetching products:', dbError);
        // Proceed without product context or throw error? For now, proceed.
      } else if (products && products.length > 0) {
        retrievedProducts = products; // For potential structured response
        productContext = "\n\nHere is some information about potentially relevant products:\n";
        products.forEach((product, idx) => {
          productContext += `\nProduct ${idx + 1} (ID: ${product.id}):\n`;
          productContext += `  Name: ${product.name}\n`;
          if (product.description) productContext += `  Description: ${product.description}\n`;
          if (product.claims && Array.isArray(product.claims)) { // Assuming claims is an array of strings or objects
             const claimsText = product.claims.map(c => typeof c === 'string' ? c : (c as any).text).join(', ');
             if(claimsText) productContext += `  Claims: ${claimsText}\n`;
          } else if (product.claims && typeof product.claims === 'object'){ // If claims is a single object
             productContext += `  Claims: ${(product.claims as any).text || JSON.stringify(product.claims)}\n`;
          }
          // Add other relevant fields like nutrition_info, weight, etc.
          // if (product.nutrition_info) productContext += `  Nutrition: ${JSON.stringify(product.nutrition_info)}\n`;
        });
      }
    }
    if (!productContext) {
        productContext = "\n\nNo specific product information was immediately found for this query. Please answer based on general knowledge if applicable, or state that product details are not available.";
    }


    // 4. Construct detailed prompt for LLM
    // Basic history integration (needs refinement for proper conversational flow)
    const historyText = (history || [])
        .map(([q, a]: [string, string]) => `User: ${q}\nAssistant: ${a}`)
        .join('\n\n');

    const prompt = `You are a helpful product assistant for our company. Your goal is to provide accurate and helpful information about our products to our sales team and executives.
Use the product information provided below to answer the user's question. If the information is not sufficient or not available in the provided context, say so.
Do not make up information. If you use product information, try to subtly weave it into a natural answer. You can list product details if the user asks for specifics or comparisons.
When referring to a product, mention its name.

Previous conversation:
${historyText}

Product Information Context:
${productContext}

User's Question:
${sanitizedQuestion}

Based on the above, please provide a comprehensive answer:`;

    // 5. Call OpenAI Chat Completion API
    const llmResponse = await llm.invoke(prompt);
    const answer = typeof llmResponse === 'string' ? llmResponse : JSON.stringify(llmResponse);


    // 6. Log the lead
    try {
      await logLead({
        user_id: userId,
        question: sanitizedQuestion,
        response: answer,
        source: 'seller-chat',
      });
    } catch (logError) {
      console.error('Failed to log lead:', logError);
      // Do not fail the entire request if logging fails
    }

    // 7. Return response
    // For now, returning simple text response.
    // Future: structure this to include product cards or structured data.
    // For example, the LLM could be prompted to output JSON for product details
    // or markers that the frontend can use.
    res.status(200).json({
      text: answer,
      sourceDocuments: retrievedProducts.map(p => ({
        pageContent: `Product Name: ${p.name}\nDescription: ${p.description}\nClaims: ${JSON.stringify(p.claims)}\nNutrition: ${JSON.stringify(p.nutrition_info)}`, // Example combined content
        metadata: {
          source: `ProductDB_ID_${p.id}`,
          id: p.id,
          name: p.name,
          image_url: p.image_url,
          // Add any other metadata frontend might need, like full product data for the card
          productData: p
        }
      })),
      productData: retrievedProducts, // Send back the raw product data for frontend rendering
    });

  } catch (error: any) {
    console.error('Error in /api/chat handler:', error);
    // Log the question attempt even if there's an error
    try {
      await logLead({
        user_id: userId,
        question: sanitizedQuestion,
        response: `Error: ${error.message || 'Something went wrong'}`,
        source: 'seller-chat-error',
      });
    } catch (logError) {
      console.error('Failed to log error lead:', logError);
    }
    res.status(500).json({ error: error.message || 'Something went wrong' });
  }
}
