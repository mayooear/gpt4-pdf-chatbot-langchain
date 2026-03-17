import { AgentConfiguration, IndexConfiguration } from '@/types/graphTypes';

type StreamConfigurables = AgentConfiguration;
type IndexConfigurables = IndexConfiguration;

export const retrievalAssistantStreamConfig: StreamConfigurables = {
  queryModel: 'openai/gpt-4o-mini',
  retrieverProvider: 'supabase',
  k: 5,
};

/**
 * Alternative configuration using MiniMax as the LLM provider.
 * To use MiniMax, set MINIMAX_API_KEY in your backend .env file
 * and swap `retrievalAssistantStreamConfig` for this config.
 *
 * Available MiniMax models:
 *   - MiniMax-M2.5       (204K context, balanced speed & quality)
 *   - MiniMax-M2.5-highspeed  (204K context, optimized for speed)
 */
export const minimaxStreamConfig: StreamConfigurables = {
  queryModel: 'minimax/MiniMax-M2.5',
  retrieverProvider: 'supabase',
  k: 5,
};

/**
 * The configuration for the indexing/ingestion process.
 */
export const indexConfig: IndexConfigurables = {
  useSampleDocs: false,
  retrieverProvider: 'supabase',
};
