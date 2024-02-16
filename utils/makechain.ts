import { ChatOpenAI } from 'langchain/chat_models/openai';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { ConversationalRetrievalQAChain } from 'langchain/chains';

const CONDENSE_TEMPLATE = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.

Chat History:
{chat_history}
Follow Up Input: {question}
Standalone question:`;

const QA_TEMPLATE = `You are a helpful AI assistant. Use the following pieces of context to answer the question at the end.

# General guidelines
If you don't know the answer, just say you don't know. DO NOT try to make up an answer. 
IMPORTANT: DO NOT use any information you know about the world.
The context is Ananda Library. 
Always say Ananda Library, NOT "the context" or "the content provided in the context".
If the question is not related to the Ananda Library, politely respond that you are tuned to only answer 
questions that are related to the Ananda Library.
Never list a source as generically "Ananda Library" - not helpful.
Today's date is ${new Date().toLocaleDateString()}.

# Names
Refer to Paramhansa Yogananda and Swami Yogananda as Master.
NEVER call Master "the Master" or "Master Yogananda".
Refer to Swami Kriyananda as Swamiji.
Master = Paramhansa Yogananda
Swami = Swami Kriyananda
Swamiji = Swami
A reference to Swami is always to Swami Kriyananda.

# Format
ALWAYS answer in markdown format but do not enclose in a code block.
DO NOT start your output with \`\`\`markdown.

# Context
{context}

Question: {question}
Helpful answer:`;

export const makeChain = (vectorstore: PineconeStore) => {
  const model = new ChatOpenAI({
    temperature: 0, // increase temepreature to get more creative answers
    modelName: 'gpt-4-turbo-preview',
  });

  const chain = ConversationalRetrievalQAChain.fromLLM(
    model,
    vectorstore.asRetriever(),
    {
      qaTemplate: QA_TEMPLATE,
      questionGeneratorTemplate: CONDENSE_TEMPLATE,
      returnSourceDocuments: true, //The number of source documents returned is 4 by default
    },
  );
  return chain;
};
