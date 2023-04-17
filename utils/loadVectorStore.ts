import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { loadChroma } from "./loaders/loadChroma";
import { loadPinecone } from "./loaders/loadPinecone";

export async function loadVectorStore(vectorStoreName: string) {
    // throw new Error(`Store ${vectorStoreName} not found`);
    const loader = vectorStoreName === 'chroma' ? loadChroma : loadPinecone;
    const embeddings = new OpenAIEmbeddings();
    return loader(embeddings);
};
