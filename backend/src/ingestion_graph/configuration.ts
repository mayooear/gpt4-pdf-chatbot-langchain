import { Annotation } from '@langchain/langgraph';
import { RunnableConfig } from '@langchain/core/runnables';

// This file contains sample documents to index, based on the following LangChain and LangGraph documentation pages:
const DEFAULT_DOCS_FILE = './test_docs/docSplits.json';

/**
 * The configuration for the indexing process.
 */
export const IndexConfigurationAnnotation = Annotation.Root({
  /**
   * Path to a JSON file containing default documents to index.
   */
  docsFile: Annotation<string>,
});

/**
 * Create an typeof IndexConfigurationAnnotation.State instance from a RunnableConfig object.
 *
 * @param config - The configuration object to use.
 * @returns An instance of typeof IndexConfigurationAnnotation.State with the specified configuration.
 */
export function ensureIndexConfiguration(
  config: RunnableConfig,
): typeof IndexConfigurationAnnotation.State {
  const configurable = (config?.configurable || {}) as Partial<
    typeof IndexConfigurationAnnotation.State
  >;
  return {
    docsFile: configurable.docsFile || DEFAULT_DOCS_FILE,
  };
}
