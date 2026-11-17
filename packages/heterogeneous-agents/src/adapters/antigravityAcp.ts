import { isRecord } from '@lobechat/utils/object';

import { classifyCliMessageError } from '../errors/classifyCliMessageError';
import type { HeterogeneousAgentEvent, ToolCallPayload, UsageData } from '../types';
import { TraeAcpAdapter } from './traeAcp';

const IDENTIFIER = 'antigravity';

const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

/**
 * Maps Antigravity CLI's ACP server (`agy acp`) `session/update` notifications
 * and synthetic lifecycle events (`antigravity_session`,
 * `antigravity_prompt_completed`, `antigravity_error`) into the shared event
 * contract.
 */
export class AntigravityAcpAdapter extends TraeAcpAdapter {
  private readonly toolCallingById = new Map<string, ToolCallPayload>();
  private readonly toolResultContentById = new Map<string, string>();

  constructor() {
    super({ eventPrefix: IDENTIFIER, provider: IDENTIFIER });
  }

  override adapt(value: unknown): HeterogeneousAgentEvent[] {
    const normalized =
      isRecord(value) &&
      (value.sessionUpdate === 'tool_call' || value.sessionUpdate === 'tool_call_update') &&
      value.rawInput === undefined &&
      value.args !== undefined
        ? { ...value, rawInput: value.args }
        : value;

    return this.enrichEvents(super.adapt(normalized));
  }

  override flush(): HeterogeneousAgentEvent[] {
    return this.enrichEvents(super.flush());
  }

  protected override toUsageData(usage: unknown): UsageData | undefined {
    if (!isRecord(usage)) return undefined;

    const input = toFiniteNumber(usage.inputTokens) ?? toFiniteNumber(usage.input_tokens);
    const output = toFiniteNumber(usage.outputTokens) ?? toFiniteNumber(usage.output_tokens);
    if (typeof input !== 'number' || typeof output !== 'number' || input < 0 || output < 0) {
      return undefined;
    }

    const cachedRead = Math.max(
      0,
      toFiniteNumber(usage.cachedReadTokens) ??
        toFiniteNumber(usage.cached_read_tokens) ??
        toFiniteNumber(usage.cacheReadTokens) ??
        toFiniteNumber(usage.cache_read_tokens) ??
        0,
    );
    const cachedWrite = Math.max(
      0,
      toFiniteNumber(usage.cachedWriteTokens) ??
        toFiniteNumber(usage.cached_write_tokens) ??
        toFiniteNumber(usage.cacheWriteTokens) ??
        toFiniteNumber(usage.cache_write_tokens) ??
        0,
    );
    const thought = Math.min(
      output,
      Math.max(
        0,
        toFiniteNumber(usage.thoughtTokens) ??
          toFiniteNumber(usage.thought_tokens) ??
          toFiniteNumber(usage.reasoningTokens) ??
          toFiniteNumber(usage.reasoning_tokens) ??
          0,
      ),
    );

    // `agy acp` reports cache-miss input in `inputTokens` (`inputTokens + cachedReadTokens + outputTokens === totalTokens`),
    // while `outputTokens` already includes `thoughtTokens`.
    const totalInputTokens = input + cachedRead + cachedWrite;
    const totalTokens =
      toFiniteNumber(usage.totalTokens) ??
      toFiniteNumber(usage.total_tokens) ??
      totalInputTokens + output;

    return {
      inputCachedTokens: cachedRead || undefined,
      inputCacheMissTokens: input,
      inputWriteCacheTokens: cachedWrite || undefined,
      outputReasoningTokens: thought || undefined,
      outputTextTokens: output - thought,
      totalInputTokens,
      totalOutputTokens: output,
      totalTokens,
    };
  }

  private enrichEvents(events: HeterogeneousAgentEvent[]): HeterogeneousAgentEvent[] {
    return events.map((event) => {
      if (event.type === 'tool_start' && isRecord(event.data)) {
        const toolCallId = event.data.toolCallId;
        const toolCalling = event.data.toolCalling;
        if (typeof toolCallId === 'string' && isRecord(toolCalling)) {
          this.toolCallingById.set(toolCallId, toolCalling as unknown as ToolCallPayload);
        }
        return event;
      }

      if (event.type === 'tool_result' && isRecord(event.data)) {
        const { content, toolCallId } = event.data;
        if (typeof toolCallId === 'string' && typeof content === 'string') {
          this.toolResultContentById.set(toolCallId, content);
        }
        return event;
      }

      if (event.type === 'tool_end' && isRecord(event.data)) {
        const toolCallId = event.data.toolCallId;
        if (typeof toolCallId !== 'string') return event;
        const toolCalling = this.toolCallingById.get(toolCallId);
        const content = this.toolResultContentById.get(toolCallId) ?? '';
        const isSuccess = event.data.isSuccess === true;
        this.toolCallingById.delete(toolCallId);
        this.toolResultContentById.delete(toolCallId);
        if (!toolCalling) return event;
        return {
          ...event,
          data: {
            ...event.data,
            payload: { toolCalling },
            result: { content, success: isSuccess },
          },
        };
      }

      if (
        event.type === 'error' &&
        isRecord(event.data) &&
        typeof event.data.message === 'string'
      ) {
        const classified = classifyCliMessageError({
          agentType: IDENTIFIER,
          detail: event.data.message,
        });
        if (classified) return { ...event, data: classified };
      }

      return event;
    });
  }
}
