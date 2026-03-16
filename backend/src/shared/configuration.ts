/**
 * Define the configurable parameters for the agent.
 */

import { Annotation } from '@langchain/langgraph';
import { RunnableConfig } from '@langchain/core/runnables';

/**
 * typeof ConfigurationAnnotation.State class for indexing and retrieval operations.
 *
 * This annotation defines the parameters needed for configuring the indexing and
 * retrieval processes, including user identification, embedding model selection,
 * retriever provider choice, and search parameters.
 */
export const BaseConfigurationAnnotation = Annotation.Root({
  /**
   * The vector store provider to use for retrieval.
   * Options are 'supabase', but you can add more providers here and create their own retriever functions
   */
  retrieverProvider: Annotation<'supabase'>({
    default: () => 'supabase',
  }),

  /**
   * Additional keyword arguments to pass to the search function of the retriever for filtering.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filterKwargs: Annotation<Record<string, any>>({
    default: () => ({}),
  }),

  /**
   * The number of documents to retrieve.
   */
  k: Annotation<number>({
    default: () => 5,
  }),
});

/**
 * Create an typeof BaseConfigurationAnnotation.State instance from a RunnableConfig object.
 *
 * @param config - The configuration object to use.
 * @returns An instance of typeof BaseConfigurationAnnotation.State with the specified configuration.
 */
export function ensureBaseConfiguration(
  config: RunnableConfig,
): typeof BaseConfigurationAnnotation.State {
  const configurable = (config?.configurable || {}) as Partial<
    typeof BaseConfigurationAnnotation.State
  >;
  return {
    retrieverProvider: configurable.retrieverProvider || 'supabase',
    filterKwargs: configurable.filterKwargs || {},
    k: configurable.k || 5,
  };
}
