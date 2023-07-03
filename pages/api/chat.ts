import type { NextApiRequest, NextApiResponse } from 'next';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { CohereEmbeddings } from 'langchain/embeddings/cohere';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { makeChain } from '@/utils/makechain';
import {BaseChatMessage, HumanChatMessage, AIChatMessage} from 'langchain/schema';
import { pinecone } from '@/utils/pinecone-client';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';
import { EMBEDDING_TYPE} from '@/config/settings';
import axios from 'axios'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { question, history } = req.body;

  let histories: BaseChatMessage[] = [];

  history.forEach(hist => {
    if(hist['type'] === 'human')  {
      let req: BaseChatMessage = new HumanChatMessage(question);
      histories.push(req);
    } else if (hist['type'] === 'ai') {
      let respond: BaseChatMessage = new AIChatMessage(hist["data"]);
      histories.push(respond);
    }
  });

  console.log('question:', question);

  //only accept post requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!question) {
    return res.status(400).json({ message: 'No question in the request' });
  }
  var sanitizedQuestion = question.trim().replaceAll('\n', ' ');
  
  // OpenAI recommends replacing newlines with spaces for best results
 
  //sanitizedQuestion = q2.trim().replaceAll('\n', ' ');
  
  try {
    const index = pinecone.Index(PINECONE_INDEX_NAME);

    /* create vectorstore*/
    const vectorStore = await PineconeStore.fromExistingIndex(
      EMBEDDING_TYPE=="openai"?  new  OpenAIEmbeddings({}):new CohereEmbeddings({modelName:"embed-multilingual-v2.0"}),
      {
        pineconeIndex: index,
        textKey: 'text',
        namespace: PINECONE_NAME_SPACE, //namespace comes from your config folder
      },
    );

    //create chain
    const chain = makeChain(vectorStore);
    //Ask a question using chat history
    const response = await chain.call({
      question: sanitizedQuestion,
      chat_history: histories || [],
    });
    
    console.log('response', response);
    res.status(200).json(response);
  } catch (error: any) {
    console.log('error:', error);
    res.status(500).json({ error: error.message || 'Something went wrong' });
  }
}
