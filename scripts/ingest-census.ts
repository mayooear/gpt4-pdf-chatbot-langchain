import 'dotenv'
import { OpenAIEmbeddings } from 'langchain/embeddings';
import { PineconeStore } from 'langchain/vectorstores';
import { pinecone } from '@/utils/pinecone-client';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { getRawData } from '@/utils/getRawData';
import { getCensus } from '@/utils/getCensus';

export const run = async () => {

  //const censusIndexName = ''

  // OpenAI recommends replacing newlines with spaces for best results

// TODO: use propertyQuery
  const censusDocs = await getCensus();
 // console.log('Docs:', {
 //   "censusDocs": censusDocs
 // });

  /* Split text into chunks */
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const docs = await textSplitter.splitDocuments(censusDocs);
  console.log('split docs', docs);

  console.log('creating vector store...');
  /*create and store the embeddings in the vectorStore*/
  const embeddings = new OpenAIEmbeddings();
  
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

        console.log({ success: true, dryRun: true})
      }
    }

    console.log({ success: true})

  } catch (error) {
    console.log('error', error);
    console.log({error: error})
  } finally {
    console.log('END')
  }
}
