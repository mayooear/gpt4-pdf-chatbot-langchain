import { OpenAIChat } from 'langchain/llms';
import { LLMChain, ChatVectorDBQAChain, loadQAChain } from 'langchain/chains';
import { PineconeStore } from 'langchain/vectorstores';
import { PromptTemplate } from 'langchain/prompts';
import { CallbackManager } from 'langchain/callbacks';

const CONDENSE_PROMPT = PromptTemplate.fromTemplate(
  `You are a sales agent from www.turing.com, and please answer the questions from the client.
  Given the following chat history and a follow up question, rephrase the follow up question to be a standalone question.
  
  Chat History:
  {chat_history}
  Follow Up Input: {question}
  Standalone question:`);

  const QA_PROMPT = PromptTemplate.fromTemplate(
    `You are a sales agent from www.turing.com, and please answer the questions from the client.
    You goal is to convert the client to a customer.
    You are given the following extracted parts of a long sales playbook and a question from the client. 
    Provide a conversational and concise answer based on the context provided.
    You should only provide hyperlinks that reference the context below. Do NOT make up hyperlinks.
    If you can't find the answer in the context below, just say "Hmm, I'm not sure, and you can always talk with a Turing agent later!" Do NOT make up answers.
    If the question is not related to the context, politely respond that you are tuned to only answer questions that are related to Turing.com.
    
    Question: {question}
    =========
    {context}
    =========
    Answer in Markdown or Table:`,
    );

export const makeChain = (
  vectorstore: PineconeStore,
  onTokenStream?: (token: string) => void,
) => {
  const questionGenerator = new LLMChain({
    llm: new OpenAIChat({ temperature: 0 }),
    prompt: CONDENSE_PROMPT,
  });
  const docChain = loadQAChain(
    new OpenAIChat({
      temperature: 0,
      modelName: 'gpt-4', //change this to older versions (e.g. gpt-3.5-turbo) if you don't have access to gpt-4
      streaming: Boolean(onTokenStream),
      callbackManager: onTokenStream
        ? CallbackManager.fromHandlers({
            async handleLLMNewToken(token) {
              onTokenStream(token);
              console.log(token);
            },
          })
        : undefined,
    }),
    { prompt: QA_PROMPT },
  );

  return new ChatVectorDBQAChain({
    vectorstore,
    combineDocumentsChain: docChain,
    questionGeneratorChain: questionGenerator,
    returnSourceDocuments: true,
    k: 6, //number of source documents to return
  });
};
