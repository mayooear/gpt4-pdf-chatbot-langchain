import { NextApiRequest, NextApiResponse } from 'next';
import { makeChain } from '@/utils/server/makechain';
import { getPineconeClient } from '@/utils/server/pinecone-client';
import { PineconeStore } from '@langchain/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';
import { StreamingResponseData } from '@/types/StreamingResponseData';
import { Document } from 'langchain/document';
import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { loadSiteConfigSync } from '@/utils/server/loadSiteConfig';

// Define a type for our filter
type PineconeFilter = {
  $and: Array<{
    [key: string]: {
      $in: string[];
    };
  }>;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { query, modelA, modelB, mediaTypes, collection } = req.body;

    const pinecone = await getPineconeClient();
    const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME || '');

    const vectorStore = await PineconeStore.fromExistingIndex(
      new OpenAIEmbeddings({}),
      { pineconeIndex },
    );

    // Load site configuration
    const siteConfig = loadSiteConfigSync();
    if (!siteConfig) {
      return res
        .status(500)
        .json({ error: 'Failed to load site configuration' });
    }

    // Create a filter based on mediaTypes and collection
    const filter: PineconeFilter = {
      $and: [
        {
          type: {
            $in: Object.keys(mediaTypes).filter((key) => mediaTypes[key]),
          },
        },
      ],
    };

    // Add author filter for 'master_swami' collection if configured
    if (
      collection === 'master_swami' &&
      siteConfig.collectionConfig?.master_swami
    ) {
      filter.$and.push({
        author: { $in: ['Paramhansa Yogananda', 'Swami Kriyananda'] },
      });
    }

    // Add library filter based on site configuration
    if (siteConfig.includedLibraries) {
      filter.$and.push({ library: { $in: siteConfig.includedLibraries } });
    }

    async function setupRetrieverAndDocumentPromise() {
      let resolveWithDocuments: (value: Document[]) => void;
      const documentPromise = new Promise<Document[]>((resolve) => {
        resolveWithDocuments = resolve;
      });

      const retriever = vectorStore.asRetriever({
        filter,
        k: 4, // Adjust this value as needed
        callbacks: [
          {
            handleRetrieverEnd(docs: Document[]) {
              resolveWithDocuments(docs);
            },
          } as Partial<BaseCallbackHandler>,
        ],
      });

      return { retriever, documentPromise };
    }

    const setupA = await setupRetrieverAndDocumentPromise();
    const setupB = await setupRetrieverAndDocumentPromise();

    const chainA = await makeChain(setupA.retriever, modelA);
    const chainB = await makeChain(setupB.retriever, modelB);

    const [responseA, responseB, docsA, docsB] = await Promise.all([
      chainA.invoke({ question: query, chat_history: '' }),
      chainB.invoke({ question: query, chat_history: '' }),
      setupA.documentPromise,
      setupB.documentPromise,
    ]);

    const responseDataA: StreamingResponseData = {
      token: responseA,
      sourceDocs: docsA,
      done: true,
    };

    const responseDataB: StreamingResponseData = {
      token: responseB,
      sourceDocs: docsB,
      done: true,
    };

    res.status(200).json({
      responseA: responseDataA,
      responseB: responseDataB,
    });
  } catch (error) {
    console.error('Error in model comparison:', error);
    res
      .status(500)
      .json({ message: 'An error occurred during model comparison' });
  }
}
