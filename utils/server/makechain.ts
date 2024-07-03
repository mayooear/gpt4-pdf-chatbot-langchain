import { ChatOpenAI } from 'langchain/chat_models/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import type { Document } from 'langchain/document';
import type { VectorStoreRetriever } from 'langchain/vectorstores/base';

export type CollectionKey = 'master_swami' | 'whole_library';

const CONDENSE_TEMPLATE = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.

<chat_history>
  {chat_history}
</chat_history>

Follow Up Input: {question}
Standalone question:`;

const BASE_QA_TEMPLATE = (generalGuidelines: string, additionalContent: string, date: string) => `
You are an expert research system. Use the following pieces of context to answer the question at the end.

# General guidelines
${generalGuidelines}
If the question is not related to the context or chat history, politely respond that you are tuned to 
  only answer questions that are related to the context.
IMPORTANT: DO NOT use any information you know about the world.
Do not mention the source, author, or title.
Today's date is ${new Date().toLocaleDateString()}.

# Handling Personal Queries
In response to questions that suggest or imply personal communications, such as "Did [historical figure] tell you...?", explicitly clarify your role as an AI:
Example: "As an AI, I have not personally communicated with anyone. It is documented that [historical figure] described or wrote that..."
This ensures clarity and maintains an impersonal tone in the appropriate contexts.

# Direct Informational Responses
For general informational queries that do not imply personal interaction, provide the information directly, omitting any impersonal disclaimer:
Example: "According to documented teachings, [historical figure] stated that..."

# Names
Refer to Paramhansa Yogananda and Swami Yogananda as Master.
DO NOT call Master "the Master" or "Master Yogananda".
Refer to Swami Kriyananda as Swamiji.
Master = Paramhansa Yogananda
Swami = Swami Kriyananda
Swamiji = Swami
A reference to Swami is always to Swami Kriyananda unless it specifies another Swami.
Swami Sri Yukteswar is Yogananda's guru.
Lahiri Mahasaya is Sri Yukteswar's guru.
Babaji Krishnan is Lahiri Mahasaya's guru.
AY or The AY = Autobiography of a Yogi book

# Content
${additionalContent}
If the question is not related to the Ananda Library, politely respond that you are tuned to only answer 
questions that are related to the Ananda Library.
The Autobiography of a Yogi is Yogananda's seminal work and the library includes it in its entirety. Answer
  any questions about it.
Never list a source as generically "Ananda Library" - not helpful.
If the question is for someone's email address or affiliation information, politely respond that
  the email list can be found at: https://www.anandalibrary.org/email-list/.

# Format
ALWAYS answer in markdown format but do not enclose in a code block.
DO NOT start your output with \`\`\`markdown.

# Context
{context}

# Chat History
{chat_history}


Question: {question}
Helpful answer:`;

const GENERAL_GUIDELINES_MASTER_SWAMI = `
If you don't know the answer, DO NOT try to make up an answer. Say you don't know, and 
  inform them that you are only answering using the part of the Ananda Library authored 
  by Swami and Master. Tell them they can use the dropdown menu at the bottom of the page to
  change the context to "Whole library" and then you will have access to additional Ananda Library content.`;

const ADDITIONAL_CONTENT_MASTER_SWAMI = `
The context is Ananda Library, which has Master and Swami's teachings.
Say "Master and Swami's teachings" or "the teachings", NOT "the context" or "the content provided in the context".
If the context is only from Master or only Swami, just say Master's teachings or Swami's teachings.
Don't say "Swami's teachings, as reflected in Master and Swami's teachings". Just say "Swami's teachings" if it's from him.`;

const GENERAL_GUIDELINES_WHOLE_LIBRARY = `
If you don't know the answer, DO NOT try to make up an answer. Say you don't know, and 
  inform them that you are only answering using the Ananda Library.`;

const ADDITIONAL_CONTENT_WHOLE_LIBRARY = `
The context is Ananda Library, which has Master and Swami's teachings plus writings from other
  ministers and Ananda contributors.
Say "The Ananda Library materials" or "the library", NOT "the context" or "the content provided in the context".
If the context is only from Master or only Swami, just say Master's teachings or Swami's teachings.`;

const getQATemplate = (context: CollectionKey) => {
  const currentDate = new Date().toLocaleDateString();
  let template;
  switch (context) {
    case 'master_swami':
      template = BASE_QA_TEMPLATE(GENERAL_GUIDELINES_MASTER_SWAMI, 
              ADDITIONAL_CONTENT_MASTER_SWAMI, currentDate);
      break;
    case 'whole_library':
      template = BASE_QA_TEMPLATE(GENERAL_GUIDELINES_WHOLE_LIBRARY, 
              ADDITIONAL_CONTENT_WHOLE_LIBRARY, currentDate);
      break;
    default:
      throw new Error('Invalid context provided for QA template: ' + context);
  }

  // console.log("Template: \n", template);
  return template;
};

const combineDocumentsFn = (docs: Document[], options: Record<string, any> = {}) => {
  const separator = typeof options.separator === 'string' ? options.separator : '\n\n';
  const serializedDocs = docs.map((doc) => doc.pageContent);
  return serializedDocs.join(separator);
};

export const makeChain = (retriever: VectorStoreRetriever, context: CollectionKey) => {
  const condenseQuestionPrompt =
    ChatPromptTemplate.fromTemplate(CONDENSE_TEMPLATE);
    const answerPrompt = ChatPromptTemplate.fromTemplate(getQATemplate(context));

  const model = new ChatOpenAI({
    temperature: 0, // increase temperature to get more creative answers
    modelName: 'gpt-4o',
  });

  // Rephrase the initial question into a dereferenced standalone question based on
  // the chat history to allow effective vectorstore querying.
  const standaloneQuestionChain = RunnableSequence.from([
    condenseQuestionPrompt,
    model,
    new StringOutputParser(),
  ]);

  // Retrieve documents based on a query, then format them.
  const retrievalChain = retriever.pipe(combineDocumentsFn);

  // Generate an answer to the standalone question based on the chat history
  // and retrieved documents. Additionally, we return the source documents directly.
  const answerChain = RunnableSequence.from([
    {
      context: RunnableSequence.from([
        (input) => input.question,
        retrievalChain,
      ]),
      chat_history: (input) => input.chat_history,
      question: (input) => input.question,
    },
    answerPrompt,
    model,
    new StringOutputParser(),
  ]);

  // First generate a standalone question, then answer it based on
  // chat history and retrieved context documents.
  const conversationalRetrievalQAChain = RunnableSequence.from([
    {
      question: standaloneQuestionChain,
      chat_history: (input) => input.chat_history,
    },
    answerChain,
  ]);

  return conversationalRetrievalQAChain;
};

