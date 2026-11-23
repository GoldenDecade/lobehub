import { HETEROGENEOUS_TYPE_LABELS } from '@lobechat/heterogeneous-agents';

import type { OperationType, StreamRetryMetadata } from '@/store/chat/slices/operation/types';

export type StreamRetryTranslationKey =
  | 'operation.execAgentRuntime'
  | 'operation.heterogeneousAgentFallback'
  | 'operation.streamRetry'
  | 'operation.streamRetry.unknownStatus'
  | 'operation.streamRetry.withAttempt';

export type StreamRetryTranslate = (
  key: StreamRetryTranslationKey,
  options?: Record<string, unknown>,
) => string;

export interface ResolveStreamRetryInput {
  heterogeneousType?: string;
  operationType?: OperationType;
  retry: StreamRetryMetadata;
  t: StreamRetryTranslate;
}

export const resolveStreamRetryName = ({
  heterogeneousType: operationHeterogeneousType,
  operationType,
  retry,
  t,
}: ResolveStreamRetryInput): string => {
  const heterogeneousType = retry.agentType ?? operationHeterogeneousType;
  if (heterogeneousType) {
    return HETEROGENEOUS_TYPE_LABELS[heterogeneousType] ?? heterogeneousType;
  }

  if (retry.provider) return retry.provider;

  return operationType === 'execHeterogeneousAgent'
    ? t('operation.heterogeneousAgentFallback')
    : t('operation.execAgentRuntime');
};

export const resolveStreamRetryStatusText = (
  retry: StreamRetryMetadata,
  t: StreamRetryTranslate,
): string => {
  const parts = [
    typeof retry.errorStatus === 'number' ? String(retry.errorStatus) : undefined,
    retry.error,
  ].filter(Boolean);
  return parts.join(' ') || t('operation.streamRetry.unknownStatus');
};

export const resolveStreamRetryLabel = ({
  heterogeneousType,
  operationType,
  retry,
  t,
}: ResolveStreamRetryInput): string => {
  const name = resolveStreamRetryName({ heterogeneousType, operationType, retry, t });
  const status = resolveStreamRetryStatusText(retry, t);

  if (
    typeof retry.attempt === 'number' &&
    Number.isFinite(retry.attempt) &&
    typeof retry.maxAttempts === 'number' &&
    Number.isFinite(retry.maxAttempts)
  ) {
    return t('operation.streamRetry.withAttempt', {
      attempt: retry.attempt,
      maxAttempts: retry.maxAttempts,
      name,
      status,
    });
  }

  return t('operation.streamRetry', { name, status });
};
