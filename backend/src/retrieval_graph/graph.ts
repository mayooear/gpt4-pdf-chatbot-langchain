import { StateGraph, START, END } from '@langchain/langgraph';
import { AgentStateAnnotation } from './state.js';
import { makeRetriever } from '../shared/retrieval.js';
import { formatDocs } from './utils.js';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { RESPONSE_SYSTEM_PROMPT, ROUTER_SYSTEM_PROMPT } from './prompts.js';
import { RunnableConfig } from '@langchain/core/runnables';
import {
  AgentConfigurationAnnotation,
  ensureAgentConfiguration,
} from './configuration.js';
import { loadChatModel } from '../shared/utils.js';



// IMPROVEMENT Error Handling &  Fallback
async function checkQueryType(
  state: typeof AgentStateAnnotation.State,
  config: RunnableConfig,
): Promise<{ route: 'retrieve' | 'direct' }> {
  const schema = z.object({
    route: z.enum(['retrieve', 'direct']),
    directAnswer: z.string().optional(),
  });

  try {
    const configuration = ensureAgentConfiguration(config);
    const model = await loadChatModel(configuration.queryModel);
    const routingPrompt = ROUTER_SYSTEM_PROMPT;
    const formattedPrompt = await routingPrompt.invoke({
      query: state.query,
    });

    const response = await model
      .withStructuredOutput(schema)
      .invoke(formattedPrompt.toString());

    return { route: response.route };
  } catch (error) {
    console.error('Error in checkQueryType, defaulting to retrieve:', error);
    return { route: 'retrieve' };
  }
}

async function answerQueryDirectly(
  state: typeof AgentStateAnnotation.State,
  config: RunnableConfig,
): Promise<typeof AgentStateAnnotation.Update> {
  const configuration = ensureAgentConfiguration(config);
  const model = await loadChatModel(configuration.queryModel);
  const userHumanMessage = new HumanMessage(state.query);

  const response = await model.invoke([userHumanMessage]);
  return { messages: [userHumanMessage, response] };
}

async function routeQuery(
  state: typeof AgentStateAnnotation.State,
): Promise<'retrieveDocuments' | 'directAnswer'> {
  const route = state.route;
  if (!route) {
    throw new Error('Route is not set');
  }

  if (route === 'retrieve') {
    return 'retrieveDocuments';
  } else if (route === 'direct') {
    return 'directAnswer';
  } else {
    throw new Error('Invalid route');
  }
}

// IMPROVEMENT Error Handling &  Fallback
async function retrieveDocuments(
  state: typeof AgentStateAnnotation.State,
  config: RunnableConfig,
): Promise<typeof AgentStateAnnotation.Update> {
  try {
    const retriever = await makeRetriever(config);
    const response = await retriever.invoke(state.query);

    // Validate & filter
    if (!response || response.length === 0) {
      console.warn('No documents retrieved for query:', state.query);
      return {
        documents: [],
        hasDocuments: false,
        retrievalWarning: 'No relevant documents found',
      };
    }

    // Filter by relevance score (optional improvement)
    const filtered = response.filter(
      (doc) => (doc.metadata?.score ?? 1) >= 0.7
    );

    if (filtered.length === 0) {
      return {
        documents: response, // Fallback to all documents
        hasDocuments: false,
        retrievalWarning: 'Low confidence matches found',
      };
    }

    return { documents: filtered, hasDocuments: true };
  } catch (error) {
    console.error('Error in retrieveDocuments:', error);
    return {
      documents: [],
      hasDocuments: false,
      error: 'Failed to retrieve documents',
    };
  }
}

// IMPROVEMENT Error Handling &  Fallback
async function generateResponse(
  state: typeof AgentStateAnnotation.State,
  config: RunnableConfig,
): Promise<typeof AgentStateAnnotation.Update> {
  try {
    const configuration = ensureAgentConfiguration(config);
    const context = formatDocs(state.documents);
    const model = await loadChatModel(configuration.queryModel);
    const promptTemplate = RESPONSE_SYSTEM_PROMPT;

    // Add warning if no documents
    const contextWithWarning = state.hasDocuments === false
      ? context + '\n[WARNING: No relevant documents found in knowledge base]'
      : context;

    const formattedPrompt = await promptTemplate.invoke({
      question: state.query,
      context: contextWithWarning,
    });

    const userHumanMessage = new HumanMessage(state.query);
    const formattedPromptMessage = new HumanMessage(
      formattedPrompt.toString()
    );

    const messageHistory = [...state.messages, formattedPromptMessage];

    const response = await model.invoke(messageHistory);

    return { messages: [userHumanMessage, response] };
  } catch (error) {
    console.error('Error in generateResponse:', error);
    const errorMessage = new AIMessage(
      'Sorry, I encountered an error generating a response. Please try again.'
    );
    return { messages: [new HumanMessage(state.query), errorMessage] };
  }
}

const builder = new StateGraph(
  AgentStateAnnotation,
  AgentConfigurationAnnotation,
)
  .addNode('retrieveDocuments', retrieveDocuments)
  .addNode('generateResponse', generateResponse)
  .addNode('checkQueryType', checkQueryType)
  .addNode('directAnswer', answerQueryDirectly)
  .addEdge(START, 'checkQueryType')
  .addConditionalEdges('checkQueryType', routeQuery, [
    'retrieveDocuments',
    'directAnswer',
  ])
  .addEdge('retrieveDocuments', 'generateResponse')
  .addEdge('generateResponse', END)
  .addEdge('directAnswer', END);

export const graph = builder.compile().withConfig({
  runName: 'RetrievalGraph',
});
