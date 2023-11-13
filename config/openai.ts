import { ChatOpenAIType, OpenAIEmbeddingsType } from "@/types/common";

const OPENAI_BASE = process.env.OPENAI_BASE || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';


const CHAT_MODEL_NAME = process.env.CHAT_MODEL_NAME;
const EMBEDDING_MODEL_NAME = process.env.EMBEDDING_MODEL_NAME
const EMBEDDING_BATCHSIZE = process.env.EMBEDDING_BATCHSIZE


const embeddingBaseCfg: OpenAIEmbeddingsType = {
    modelName: EMBEDDING_MODEL_NAME,
}
if (EMBEDDING_BATCHSIZE) {
    embeddingBaseCfg.batchSize = parseInt(EMBEDDING_BATCHSIZE, 10)
}

const chatBaseCfg: ChatOpenAIType = {
    modelName: CHAT_MODEL_NAME,
    temperature: 0,
}

const extraCfg = {
    apiKey: OPENAI_API_KEY,
    basePath: OPENAI_BASE,
}

export {
    OPENAI_BASE, OPENAI_API_KEY,
    CHAT_MODEL_NAME, EMBEDDING_MODEL_NAME, EMBEDDING_BATCHSIZE,
    chatBaseCfg, embeddingBaseCfg, extraCfg
};
