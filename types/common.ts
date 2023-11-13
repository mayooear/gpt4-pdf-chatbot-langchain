
import { AzureOpenAIInput, OpenAIChatInput } from "langchain/chat_models/openai";
import { BaseChatModelParams } from "langchain/dist/chat_models/base";
import { OpenAIEmbeddingsParams } from "langchain/embeddings/openai";

export type OpenAIEmbeddingsType = Partial<OpenAIEmbeddingsParams> & Partial<AzureOpenAIInput> & {
    verbose?: boolean;
    openAIApiKey?: string;
}

export type ChatOpenAIType = Partial<OpenAIChatInput> & Partial<AzureOpenAIInput> & BaseChatModelParams & {
    // configuration?: ConfigurationParameters;
}