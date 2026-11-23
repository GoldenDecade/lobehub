import { describe, expect, it } from 'vitest';

import { resolveStreamRetryLabel, type StreamRetryTranslate } from './streamRetryLabel';

const t: StreamRetryTranslate = (key, params) => {
  switch (key) {
    case 'operation.execAgentRuntime': {
      return 'Preparing response';
    }
    case 'operation.heterogeneousAgentFallback': {
      return 'External agent';
    }
    case 'operation.streamRetry.unknownStatus': {
      return 'unknown status';
    }
    case 'operation.streamRetry': {
      return `${params?.name} upstream is busy (${params?.status}), retrying`;
    }
    case 'operation.streamRetry.withAttempt': {
      return `${params?.name} upstream is busy (${params?.status}), retrying ${params?.attempt}/${params?.maxAttempts}`;
    }
  }
};

describe('resolveStreamRetryLabel', () => {
  it('shows provider and HTTP status instead of External agent for native LLM retries', () => {
    expect(
      resolveStreamRetryLabel({
        operationType: 'callLLM',
        retry: {
          attempt: 3,
          errorStatus: 500,
          maxAttempts: 6,
          provider: 'supergrok',
        },
        t,
      }),
    ).toBe('supergrok upstream is busy (500), retrying 3/6');
  });

  it('falls back to Preparing response when native LLM retry has no provider', () => {
    expect(
      resolveStreamRetryLabel({
        operationType: 'callLLM',
        retry: {
          attempt: 2,
          maxAttempts: 6,
        },
        t,
      }),
    ).toBe('Preparing response upstream is busy (unknown status), retrying 2/6');
  });

  it('keeps the heterogeneous agent name when retrying an external agent run', () => {
    expect(
      resolveStreamRetryLabel({
        heterogeneousType: 'claude-code',
        operationType: 'execHeterogeneousAgent',
        retry: {
          attempt: 2,
          errorStatus: 529,
          maxAttempts: 4,
        },
        t,
      }),
    ).toBe('Claude Code upstream is busy (529), retrying 2/4');
  });
});
