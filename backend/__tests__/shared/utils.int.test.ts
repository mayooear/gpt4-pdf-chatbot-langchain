import dotenv from 'dotenv';
dotenv.config();

import { loadChatModel } from '../../src/shared/utils.js';
import { HumanMessage } from '@langchain/core/messages';

/**
 * Integration tests for loadChatModel with real API calls.
 *
 * These tests require actual API keys:
 *   MINIMAX_API_KEY  — for MiniMax tests
 *   OPENAI_API_KEY   — for OpenAI tests
 *
 * Run with: yarn test:int
 */

describe('loadChatModel integration', () => {
  describe('MiniMax provider', () => {
    const shouldRun = () => {
      if (!process.env.MINIMAX_API_KEY) {
        console.warn('Skipping MiniMax integration tests — MINIMAX_API_KEY not set');
        return false;
      }
      return true;
    };

    it('should invoke MiniMax-M2.5 and receive a response', async () => {
      if (!shouldRun()) return;

      const model = await loadChatModel('minimax/MiniMax-M2.5');
      const response = await model.invoke([
        new HumanMessage('Reply with exactly: hello'),
      ]);

      expect(response.content).toBeTruthy();
      expect(typeof response.content).toBe('string');
      expect((response.content as string).toLowerCase()).toContain('hello');
    }, 30000);

    it('should support structured output with MiniMax', async () => {
      if (!shouldRun()) return;

      const { z } = await import('zod');
      const schema = z.object({
        answer: z.string(),
      });

      const model = await loadChatModel('minimax/MiniMax-M2.5');
      const structured = model.withStructuredOutput(schema);
      const response = await structured.invoke(
        'What is 2+2? Respond with the answer field.',
      );

      expect(response.answer).toBeTruthy();
    }, 30000);
  });

  describe('OpenAI provider', () => {
    const shouldRun = () => {
      if (!process.env.OPENAI_API_KEY) {
        console.warn('Skipping OpenAI integration tests — OPENAI_API_KEY not set');
        return false;
      }
      return true;
    };

    it('should invoke OpenAI and receive a response', async () => {
      if (!shouldRun()) return;

      const model = await loadChatModel('openai/gpt-4o-mini');
      const response = await model.invoke([
        new HumanMessage('Reply with exactly: hello'),
      ]);

      expect(response.content).toBeTruthy();
      expect(typeof response.content).toBe('string');
    }, 30000);
  });
});
