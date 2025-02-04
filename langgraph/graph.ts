import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from "@/config/pinecone";
import { makeChain } from "@/utils/makechain";
import { pinecone } from "@/utils/pinecone-client";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { StateGraph } from "@langchain/langgraph";
import type { Document } from 'langchain/document';
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { PineconeStore } from "langchain/vectorstores/pinecone";
import { InputAnnotation, OutputAnnotation } from "./state";


const assistant = async (state: typeof InputAnnotation.State) => {
  const { question, messages } = state;

  messages.push(new HumanMessage(question));

  console.log('question', question);

  console.log('history', messages);

  const index = pinecone.Index(PINECONE_INDEX_NAME);

    /* create vectorstore*/
    const vectorStore = await PineconeStore.fromExistingIndex(
      new OpenAIEmbeddings({}),
      {
        pineconeIndex: index,
        textKey: 'text',
        namespace: PINECONE_NAME_SPACE, //namespace comes from your config folder
      },
    );

    // Use a callback to get intermediate sources from the middle of the chain
    let resolveWithDocuments: (value: Document[]) => void;
    const documentPromise = new Promise<Document[]>((resolve) => {
      resolveWithDocuments = resolve;
    });
    const retriever = vectorStore.asRetriever({
      callbacks: [
        {
          handleRetrieverEnd(documents) {
            resolveWithDocuments(documents);
          },
        },
      ],
    });

    //create chain
    const chain = makeChain(retriever);

    //Ask a question using chat history
    const response = await chain.invoke({
      question,
      chat_history: JSON.stringify(messages),
    });

    const sourceDocuments = await documentPromise;

    return { messages: [...messages, new AIMessage(response)], sourceDocuments, answer: response };
};

export const route = (state: typeof InputAnnotation.State): "__end__" | "assistant" => {
  if (state.messages.length > 0) {
    return "__end__";
  }
  // Loop back
  return "assistant";
};

const builder = new StateGraph({ input: InputAnnotation, output: OutputAnnotation })
                    .addNode("assistant", assistant)
                    .addEdge("__start__", "assistant")
                    .addConditionalEdges("assistant", route);

export const graph = builder.compile();



