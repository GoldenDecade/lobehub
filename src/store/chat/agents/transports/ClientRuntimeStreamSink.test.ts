import { describe, expect, it, vi } from 'vitest';

import { ClientRuntimeStreamSink } from './ClientRuntimeStreamSink';

describe('ClientRuntimeStreamSink', () => {
  it('stores provider and errorStatus from stream_retry and clears streamRetry on stream_end', async () => {
    const updateOperationMetadata = vi.fn();
    const sink = new ClientRuntimeStreamSink(
      () => ({ operations: {}, updateOperationMetadata }) as any,
      'op-1',
      {},
    );

    await sink.publishEvent({
      data: {
        attempt: 3,
        delayMs: 4000,
        errorStatus: 500,
        errorType: 'SERVER_ERROR',
        maxAttempts: 6,
        provider: 'supergrok',
      },
      stepIndex: 0,
      type: 'stream_retry',
    });

    expect(updateOperationMetadata).toHaveBeenCalledWith('op-1', {
      streamRetry: {
        attempt: 3,
        delayMs: 4000,
        error: 'SERVER_ERROR',
        errorStatus: 500,
        maxAttempts: 6,
        provider: 'supergrok',
      },
    });

    await sink.publishEvent({
      data: {},
      stepIndex: 0,
      type: 'stream_end',
    });

    expect(updateOperationMetadata).toHaveBeenLastCalledWith('op-1', {
      streamRetry: undefined,
    });
  });
});
