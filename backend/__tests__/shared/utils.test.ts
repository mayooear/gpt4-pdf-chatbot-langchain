import { loadChatModel } from '../../src/shared/utils.js';
import { ChatOpenAI } from '@langchain/openai';

describe('loadChatModel', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.MINIMAX_API_KEY = 'test-minimax-key';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('provider/model parsing', () => {
    it('should parse "openai/gpt-4o" correctly', async () => {
      const model = await loadChatModel('openai/gpt-4o');
      expect(model).toBeInstanceOf(ChatOpenAI);
    });

    it('should parse "minimax/MiniMax-M2.5" correctly', async () => {
      const model = await loadChatModel('minimax/MiniMax-M2.5');
      expect(model).toBeInstanceOf(ChatOpenAI);
    });

    it('should default to OpenAI when no provider prefix is given', async () => {
      const model = await loadChatModel('gpt-4o');
      expect(model).toBeInstanceOf(ChatOpenAI);
    });

    it('should handle provider names case-insensitively', async () => {
      const model = await loadChatModel('MiniMax/MiniMax-M2.5');
      expect(model).toBeInstanceOf(ChatOpenAI);
    });
  });

  describe('MiniMax configuration', () => {
    it('should use MiniMax base URL', async () => {
      const model = (await loadChatModel(
        'minimax/MiniMax-M2.5',
      )) as ChatOpenAI;
      expect(model.modelName).toBe('MiniMax-M2.5');
    });

    it('should support MiniMax-M2.5-highspeed model', async () => {
      const model = (await loadChatModel(
        'minimax/MiniMax-M2.5-highspeed',
      )) as ChatOpenAI;
      expect(model.modelName).toBe('MiniMax-M2.5-highspeed');
    });

    it('should set non-zero temperature for MiniMax', async () => {
      const model = (await loadChatModel(
        'minimax/MiniMax-M2.5',
      )) as ChatOpenAI;
      expect(model.temperature).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should throw for unsupported providers', async () => {
      await expect(loadChatModel('unsupported/model')).rejects.toThrow(
        'Unsupported LLM provider: "unsupported"',
      );
    });

    it('should throw when API key is missing', async () => {
      delete process.env.MINIMAX_API_KEY;
      await expect(loadChatModel('minimax/MiniMax-M2.5')).rejects.toThrow(
        'Missing API key for provider "minimax"',
      );
    });

    it('should include supported providers in error message', async () => {
      await expect(loadChatModel('bad/model')).rejects.toThrow(
        'openai, minimax',
      );
    });
  });

  describe('default model fallback', () => {
    it('should use default model when only provider is given', async () => {
      const model = (await loadChatModel('minimax/')) as ChatOpenAI;
      expect(model.modelName).toBe('MiniMax-M2.5');
    });
  });
});
