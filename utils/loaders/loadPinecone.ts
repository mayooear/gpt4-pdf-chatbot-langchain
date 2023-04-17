import { PineconeStore } from 'langchain/vectorstores';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';
import { pinecone } from '../pinecone-client';

export const loadPinecone = async (embeddings) => {
    const index = pinecone.Index(PINECONE_INDEX_NAME);
    return await PineconeStore.fromExistingIndex(
        embeddings,
        {
            pineconeIndex: index,
            textKey: 'text',
            namespace: PINECONE_NAME_SPACE, //namespace comes from your config folder
        },
    );
};