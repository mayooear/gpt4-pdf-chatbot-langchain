import { Chroma } from 'langchain/vectorstores';
import { CHROMA_NAME_SPACE } from '@/config/chroma';

export const loadChroma = async (embeddings) => {
    return await Chroma.fromExistingCollection(
        embeddings,
        {
            collectionName: CHROMA_NAME_SPACE,
        }
    );
}