import type { NextApiRequest, NextApiResponse } from 'next';
import { OpenAIEmbeddings } from 'langchain/embeddings';
import { PineconeStore } from 'langchain/vectorstores';
import { makeChain } from '@/utils/makechain';
import { pinecone } from '@/utils/pinecone-client';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';
import WikiJS from 'wikijs';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { lat, lng, history } = req.body;
  const questionIn = req.body.question;

  let sanitizedQuestion;
  // if we don't have history, we're string the chat, get summary info and provide it (ignore the questionIn)
  if(!history){
    const RADIUS = 1000

    const latNum = parseFloat(lat as string);
    const lngNum = parseFloat(lng as string);

    if(!latNum || !lngNum){
        res.status(400).json({ error: 'Invalid lat/lng query params'})
    }

    const result = await WikiJS().geoSearch(latNum, lngNum, RADIUS)
        .then((res) => {
            // TODO: do we need to filter to just regions here?
            return res[0];
        })
        .then((pageName) => WikiJS().page(pageName))
        .then((page) => page.summary())

    sanitizedQuestion = `Here is some context, give a summary: ${result}`
  }else{

    // OpenAI recommends replacing newlines with spaces for best results
    sanitizedQuestion = typeof questionIn === 'string' ? questionIn.trim().replaceAll('&#10;', ' ') : ''
  }

  const index = pinecone.Index(PINECONE_INDEX_NAME);

  /* create vectorstore*/
  const vectorStore = await PineconeStore.fromExistingIndex(
    index,
    new OpenAIEmbeddings({}),
    'text',
    PINECONE_NAME_SPACE, //optional
  );

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });

  const sendData = (data: string) => {
    res.write(`data: ${data}`);
  };

  sendData(JSON.stringify({ data: '' }));

  //create chain
  const chain = makeChain(vectorStore, (token: string) => {
    sendData(JSON.stringify({ data: token }));
  });

  try {
    //Ask a question
    const response = await chain.call({
      question: sanitizedQuestion,
      chat_history: history || [],
    });

    console.log('response', response);
    sendData(JSON.stringify({ sourceDocs: response.sourceDocuments }));
  } catch (error) {
    console.log('error', error);
  } finally {
    sendData('[DONE]');
    res.end();
  }
}
