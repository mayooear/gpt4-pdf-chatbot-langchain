import { Annotation, MessagesAnnotation } from '@langchain/langgraph';
import { reduceDocs } from '../shared/state.js';
import { Document } from '@langchain/core/documents';
/**
 * Represents the state of the retrieval graph / agent.
 */

// Custom reducer
const hasDocumentsReducer = (
  previous: boolean,
  current: boolean | undefined
): boolean => {
  return current !== undefined ? current : previous;
};

// Custom reducer
const retrievalWarningReducer = (
  previous: string | null,
  current: string | null | undefined
): string | null => {
  return current !== undefined ? current : previous;
};

export const AgentStateAnnotation = Annotation.Root({
  query: Annotation<string>(),
  route: Annotation<string>(),
  ...MessagesAnnotation.spec,

  /**
   * Populated by the retriever. This is a list of documents that the agent can reference.
   * @type {Document[]}
   */
  documents: Annotation<
    Document[],
    Document[] | { [key: string]: any }[] | string[] | string | 'delete'
  >({
    default: () => [],
    // @ts-ignore
    reducer: reduceDocs,
  }),


  // Additional attributes can be added here as needed
  hasDocuments: Annotation<boolean>({
    default: () => true,
    reducer: hasDocumentsReducer,
  }),

  retrievalWarning: Annotation<string | null>({
    default: () => null,
    reducer: retrievalWarningReducer,
  }),
  error: Annotation<string | null>
});
