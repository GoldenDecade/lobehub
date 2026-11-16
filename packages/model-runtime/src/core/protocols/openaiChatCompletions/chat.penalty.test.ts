// @vitest-environment node
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as getModelPricingModule from '../../../utils/getModelPricing';
import type { LobeOpenAICompatibleRuntime } from '../../BaseAI';
import { createOpenAICompatibleRuntime } from '../../openaiCompatible';

vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(getModelPricingModule, 'getModelPricing').mockResolvedValue(undefined);
vi.mock('@lobechat/business-model-bank/model-config', () => ({
  loadModels: vi.fn().mockResolvedValue([]),
}));

const LobeMockProvider = createOpenAICompatibleRuntime({
  baseURL: 'http://127.0.0.1:3425/v1',
  provider: 'magpie',
});

describe('chatViaChatCompletions Google frequency_penalty guard', () => {
  let instance: LobeOpenAICompatibleRuntime;

  beforeEach(() => {
    instance = new LobeMockProvider({ apiKey: 'magpie' });
    vi.spyOn(instance['client'].chat.completions, 'create').mockResolvedValue(
      new ReadableStream() as any,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each(['gemini-2.5-pro', 'google/models/gemini-4-hydrogen'])(
    'omits frequency_penalty (even when non-zero) for %s',
    async (model) => {
      await instance.chat({
        frequency_penalty: 0.5,
        messages: [{ content: 'Hello', role: 'user' }],
        model,
        presence_penalty: 0.2,
        temperature: 0.7,
      });

      const createCall = (instance['client'].chat.completions.create as Mock).mock.calls[0][0];
      expect(createCall.model).toBe(model);
      expect(createCall.frequency_penalty).toBeUndefined();
      expect(createCall.presence_penalty).toBe(0.2);
    },
  );

  it('keeps non-zero frequency_penalty for non-Google models', async () => {
    await instance.chat({
      frequency_penalty: 0.5,
      messages: [{ content: 'Hello', role: 'user' }],
      model: 'gpt-4o',
      presence_penalty: 0.2,
      temperature: 0.7,
    });

    const createCall = (instance['client'].chat.completions.create as Mock).mock.calls[0][0];
    expect(createCall.model).toBe('gpt-4o');
    expect(createCall.frequency_penalty).toBe(0.5);
    expect(createCall.presence_penalty).toBe(0.2);
  });
});
