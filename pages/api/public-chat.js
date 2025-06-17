import { OpenAIEmbeddings } from '@langchain/openai';
import { OpenAI } from '@langchain/openai';
import { getPineconeClient } from '../../lib/vector'; // Using our Pinecone client wrapper
import { supabase } from '../../lib/db'; // Direct Supabase client
import { logLead } from '../../lib/db';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE as DEFAULT_PINECONE_NAMESPACE } from '../../config/pinecone';

const PINECONE_NAMESPACE_PRODUCTS = process.env.PINECONE_NAMESPACE_PRODUCTS || DEFAULT_PINECONE_NAMESPACE || 'products-namespace';

const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: "text-embedding-ada-002",
});

const llm = new OpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: 'gpt-3.5-turbo',
  temperature: 0.6, // Slightly lower temp for more factual public answers
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { question } = req.body;

  if (!question) {
    return res.status(400).json({ message: 'No question in the request' });
  }

  const sanitizedQuestion = question.trim().replaceAll('\n', ' ');

  try {
    const questionEmbedding = await embeddings.embedQuery(sanitizedQuestion);
    if (!questionEmbedding) {
      throw new Error('Failed to generate question embedding.');
    }

    const pineconeClient = await getPineconeClient();
    const index = pineconeClient.Index(PINECONE_INDEX_NAME);

    const queryResponse = await index.namespace(PINECONE_NAMESPACE_PRODUCTS).query({
      topK: 3, // Fewer results for public widget to keep context concise
      vector: questionEmbedding,
      includeMetadata: true,
    });

    const productIds = queryResponse.matches
      ?.map((match) => match.metadata?.productId)
      .filter(id => !!id);

    let productContext = '';
    let retrievedProductDetails = []; // For constructing links

    if (productIds && productIds.length > 0) {
      const { data: products, error: dbError } = await supabase
        .from('products')
        .select('id, name, description, claims') // Select fields relevant for context and links
        .in('id', productIds);

      if (dbError) {
        console.error('Supabase error fetching products for public chat:', dbError);
      } else if (products && products.length > 0) {
        retrievedProductDetails = products.map(p => ({id: p.id, name: p.name})); // Store for link generation
        productContext = "\n\nRelevant Product Information:\n";
        products.forEach((product, idx) => {
          productContext += `\nProduct ${idx + 1} (ID: ${product.id}):\n`;
          productContext += `  Name: ${product.name}\n`;
          if (product.description) productContext += `  Description: ${product.description.substring(0, 150)}...\n`; // Shorter description
          if (product.claims && Array.isArray(product.claims) && product.claims.length > 0) {
            const claimsText = product.claims.map(c => typeof c === 'string' ? c : c.text).slice(0,2).join(', '); // Fewer claims
            if(claimsText) productContext += `  Some Claims: ${claimsText}\n`;
          }
        });
      }
    }
     if (!productContext) {
        productContext = "\n\nNo specific product information was found for this query. Please answer based on general knowledge or state that product details are not available.";
    }

    // Construct product links string if products were retrieved
    let productLinksHint = '';
    if (retrievedProductDetails.length > 0) {
        productLinksHint = "If relevant, you can point the user to the following product pages for more details:\n";
        retrievedProductDetails.forEach(p => {
            // Format as markdown link: [Product Name](/products/ID)
            productLinksHint += `- [${p.name}](/products/${p.id})\n`;
        });
    }


    const prompt = `You are a public-facing product assistant for our company. Be helpful, polite, and concise.
Your primary goal is to answer questions about our products and guide users to find more information.
Use the provided product information to answer the user's question.
${productLinksHint}
If the user asks where to buy a product, you can mention that details are often on the product page or they can check with our retail partners (you don't have specific retailer information).
Do not make up information. If the context is insufficient, say that you cannot find the specific detail.

Product Information Context:
${productContext}

User's Question:
${sanitizedQuestion}

Answer:`;

    const llmResponse = await llm.invoke(prompt);
    const answer = typeof llmResponse === 'string' ? llmResponse : JSON.stringify(llmResponse);

    try {
      await logLead({
        question: sanitizedQuestion,
        response: answer,
        source: 'public-widget', // user_id will be null by default in logLead if not provided
      });
    } catch (logError) {
      console.error('Failed to log public lead:', logError);
    }

    res.status(200).json({ text: answer });

  } catch (error) {
    console.error('Error in /api/public-chat handler:', error);
    try {
      await logLead({
        question: sanitizedQuestion,
        response: `Error: ${error.message || 'Something went wrong'}`,
        source: 'public-widget-error',
      });
    } catch (logError) {
      console.error('Failed to log public error lead:', logError);
    }
    res.status(500).json({ error: error.message || 'Something went wrong' });
  }
}
