import { ChatOpenAI } from '@langchain/openai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

/**
 * Supported LLM providers and their configurations.
 */
const PROVIDER_CONFIGS: Record<
  string,
  { baseURL?: string; apiKeyEnv: string; defaultModel: string }
> = {
  openai: {
    apiKeyEnv: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o',
  },
  minimax: {
    baseURL: 'https://api.minimax.io/v1',
    apiKeyEnv: 'MINIMAX_API_KEY',
    defaultModel: 'MiniMax-M2.5',
  },
};

/**
 * Load a chat model based on a "provider/model-name" string.
 *
 * @param modelString - A string in the form "provider/model-name"
 *   (e.g. "openai/gpt-4o", "minimax/MiniMax-M2.5").
 *   If only a model name is given (no slash), defaults to OpenAI.
 * @returns A BaseChatModel instance for the specified provider.
 *
 * @example
 * ```ts
 * const model = await loadChatModel('openai/gpt-4o');
 * const minimax = await loadChatModel('minimax/MiniMax-M2.5');
 * ```
 */
export async function loadChatModel(modelString: string): Promise<BaseChatModel> {
  const slashIndex = modelString.indexOf('/');

  let provider: string;
  let modelName: string;

  if (slashIndex === -1) {
    // No provider prefix — default to OpenAI
    provider = 'openai';
    modelName = modelString;
  } else {
    provider = modelString.slice(0, slashIndex).toLowerCase();
    modelName = modelString.slice(slashIndex + 1);
  }

  const config = PROVIDER_CONFIGS[provider];
  if (!config) {
    throw new Error(
      `Unsupported LLM provider: "${provider}". ` +
        `Supported providers: ${Object.keys(PROVIDER_CONFIGS).join(', ')}`,
    );
  }

  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) {
    throw new Error(
      `Missing API key for provider "${provider}". ` +
        `Set the ${config.apiKeyEnv} environment variable.`,
    );
  }

  const resolvedModel = modelName || config.defaultModel;

  // MiniMax requires temperature in (0.0, 1.0] — avoid sending 0
  const temperature = provider === 'minimax' ? 0.1 : undefined;

  return new ChatOpenAI({
    modelName: resolvedModel,
    openAIApiKey: apiKey,
    temperature,
    configuration: config.baseURL ? { baseURL: config.baseURL } : undefined,
  });
}
