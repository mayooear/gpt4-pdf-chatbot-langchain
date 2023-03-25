import 'dotenv'
import type { NextApiRequest, NextApiResponse } from 'next';
import { OpenAIEmbeddings } from 'langchain/embeddings';
import { PineconeStore } from 'langchain/vectorstores';
import { pinecone } from '@/utils/pinecone-client';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { getRawData } from '@/utils/getRawData';


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { propertyQuery } = req.query;

  console.log('propertyQuery init for ',{
    "propertyQuery": propertyQuery
  })
  if (!propertyQuery) {
    return res.status(400).json({ message: 'No propertyQuery in the request' });
  }
  // OpenAI recommends replacing newlines with spaces for best results

// TODO: use propertyQuery
  const rawDocs = await getRawData();
  console.log('Docs:', {
    "rawDocs": rawDocs
  });

  /* Split text into chunks */
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const docs = await textSplitter.splitDocuments(rawDocs);
  console.log('split docs', docs);

  console.log('creating vector store...');
  /*create and store the embeddings in the vectorStore*/
  const embeddings = new OpenAIEmbeddings();
  
  
  // TOTHINK: New index per-property thread?
  const index = pinecone.Index(PINECONE_INDEX_NAME); //change to your own index name

  try {

    /* Pinecone recommends a limit of 100 vectors per upsert request to avoid errors*/
    const chunkSize = 50;
    for (let i = 0; i < docs.length; i += chunkSize) {
      const chunk = docs.slice(i, i + chunkSize);
      console.log('chunk', i, chunk);
      if(process.env.DRY_RUN === 'false'){
        await PineconeStore.fromDocuments(
          index,
          chunk,
          embeddings,
          'text',
          PINECONE_NAME_SPACE,
        );
      }else{
        console.log('DRY_RUN is true - not uploading')

        res.send({ success: true, dryRun: true})
      }
    }

    res.send({ success: true})

  } catch (error) {
    console.log('error', error);
    res.send({error: error})
  } finally {
    res.send({ success: true})
    res.end();
  }
}
