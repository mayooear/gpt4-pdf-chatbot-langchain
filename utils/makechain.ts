import { OpenAI } from 'langchain/llms/openai';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { ConversationalRetrievalQAChain } from 'langchain/chains';

const PROMPT: { [key: string]: { CONDENSE_PROMPT: string; QA_PROMPT: string; } } = {
  'zh_tw':{
    CONDENSE_PROMPT: `給定以下對話和後續問題，將後續問題重新表述為獨立問題。

    對話歷史:
    {chat_history}
    後續輸入: {question}
    獨立問題:`,
    QA_PROMPT:`你是一個有用的人工智能助手。使用以下上下文來回答最後的問題。
    如果你不知道答案，就説你不知道。不要試圖編造一個答案。
    如果問題與上下文無關，請禮貌地回答，您將只回答與上下文相關的問題。
    
    {context}
    
    問題: {question}
    如果有寫成 markdown 格式會很有用。`
  },
  'zh_cn':{
    CONDENSE_PROMPT: `给定以下对话和后续问题，将后续问题重新表述为独立问题。

    对话历史:
    {chat_history}
    后续输入: {question}
    独立问题:`,
    QA_PROMPT:`你是一个有用的人工智能助手。使用以下上下文来回答最后的问题。
    如果你不知道答案，就说你不知道。不要试图编造一个答案。
    如果问题与上下文无关，请礼貌地回答，您将只回答与上下文相关的问题。
    
    {context}
    
    问题: {question}
    markdown格式的有用答案:`
  },
  'en_us':{
    CONDENSE_PROMPT: `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.

    Chat History:
    {chat_history}
    Follow Up Input: {question}
    Standalone question:`,
    QA_PROMPT:`You are a helpful AI assistant. Use the following pieces of context to answer the question at the end.
    If you don't know the answer, just say you don't know. DO NOT try to make up an answer.
    If the question is not related to the context, politely respond that you are tuned to only answer questions that are related to the context.
    
    {context}
    
    Question: {question}
    Helpful answer in markdown:`
  }
};

const LANGUAGE:string = process.env['CHAT_LANGUAGE'] || 'en_us';

const { CONDENSE_PROMPT, QA_PROMPT } = PROMPT[LANGUAGE];

export const makeChain = (vectorstore: PineconeStore) => {
  const model = new OpenAI({
    temperature: 0, // increase temepreature to get more creative answers
    modelName: 'gpt-3.5-turbo', //change this to gpt-4 if you have access
  });

  const chain = ConversationalRetrievalQAChain.fromLLM(
    model,
    vectorstore.asRetriever(),
    {
      qaTemplate: QA_PROMPT,
      questionGeneratorTemplate: CONDENSE_PROMPT,
      returnSourceDocuments: true, //The number of source documents returned is 4 by default
    },
  );
  return chain;
};