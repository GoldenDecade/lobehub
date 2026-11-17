import { isRecord, pickString, toRecord, type UnknownRecord } from '@lobechat/utils/object';

import { classifyCliMessageError } from '../errors/classifyCliMessageError';
import type {
  AgentEventAdapter,
  HeterogeneousAgentEvent,
  ToolCallPayload,
  UsageData,
} from '../types';

const IDENTIFIER = 'antigravity';
const TERMINAL_STEP_STATES = new Set(['CANCELED', 'CANCELLED', 'DONE', 'ERROR']);

interface PendingTool {
  payload: ToolCallPayload;
  rawStepIndex: number;
  started?: boolean;
  stepIndex: number;
}

const tokenCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

const extractUsage = (raw: unknown): UsageData | undefined => {
  if (!isRecord(raw)) return;
  const inputCacheMissTokens = tokenCount(raw.input_tokens);
  const inputCachedTokens = tokenCount(raw.cache_read_tokens);
  const totalOutputTokens = tokenCount(raw.output_tokens);
  const outputReasoningTokens = Math.min(tokenCount(raw.thinking_tokens), totalOutputTokens);
  // agy's input_tokens/total_tokens exclude cache reads (see the second turn
  // in its headless stream-input example). Our totals include cached input.
  const totalInputTokens = inputCacheMissTokens + inputCachedTokens;
  return {
    inputCachedTokens,
    inputCacheMissTokens,
    outputReasoningTokens,
    outputTextTokens: totalOutputTokens - outputReasoningTokens,
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
  };
};

const stringifyOutput = (value: unknown): string =>
  typeof value === 'string' ? value : value === undefined ? '' : JSON.stringify(value);

/**
 * Native agy NDJSON protocol, not the Gemini/Claude stream-json protocol.
 * https://antigravity.google/docs/cli/headless/
 * LobeHub uses one process per turn and --conversation to resume. The native
 * protocol also supports multiple turns while stdin remains open.
 */
export class AntigravityAdapter implements AgentEventAdapter {
  sessionId?: string;

  private completedSteps = new Set<number>();
  private flushed = false;
  private hasResponseText = false;
  private latestNonCheckpointStep?: number;
  private model?: string;
  private pendingTools = new Map<number, PendingTool>();
  private resultReceived = false;
  private completionValidated = false;
  private responseStep?: number;
  private responseStepErrored = false;
  private stepIndex = 0;
  private stepTools: ToolCallPayload[] = [];
  private streamOpen = false;
  private toolSinceResponse = false;
  private usageByStep = new Map<number, UsageData>();

  adapt(raw: unknown): HeterogeneousAgentEvent[] {
    if (this.flushed || this.resultReceived || !isRecord(raw)) return [];
    if (raw.event === 'init') {
      this.sessionId = pickString(raw.conversation_id);
      this.model = pickString(toRecord(raw.init)?.model);
      return this.openStream();
    }
    if (raw.event === 'result' && isRecord(raw.result)) return this.handleResult(raw.result);
    if (raw.event !== 'step_update' || !isRecord(raw.step_update)) return [];

    const step = raw.step_update;
    const index = step.step_index;
    if (typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0) return [];
    // Child conversations must never leak into the parent's assistant bubble.
    const conversationId = pickString(step.conversation_id);
    if (this.sessionId && conversationId && conversationId !== this.sessionId) return [];
    this.sessionId ??= conversationId;
    if (this.completedSteps.has(index)) return [];
    if (step.step_type !== 'checkpoint') {
      this.latestNonCheckpointStep = Math.max(this.latestNonCheckpointStep ?? -1, index);
    }

    const events: HeterogeneousAgentEvent[] = [];
    if (step.step_type === 'agent_response') {
      if (
        this.toolSinceResponse ||
        (this.responseStep !== undefined && this.responseStep !== index)
      ) {
        events.push(...this.closeStream());
        this.stepIndex += 1;
        this.stepTools = [];
        this.hasResponseText = false;
        this.responseStepErrored = false;
      }
      events.push(...this.openStream());
      this.toolSinceResponse = false;
      this.responseStep = index;
      if (step.error != null || step.state === 'ERROR') {
        this.responseStepErrored = true;
      }
      if (typeof step.text_delta === 'string' && step.text_delta) {
        this.hasResponseText = true;
        events.push(this.event('stream_chunk', { chunkType: 'text', content: step.text_delta }));
      }
    } else if (step.step_type === 'tool' || isRecord(step.subagent_info)) {
      events.push(...this.handleTool(index, step));
    }

    if (TERMINAL_STEP_STATES.has(String(step.state))) {
      this.completedSteps.add(index);
      const usage = extractUsage(step.usage);
      if (usage) this.usageByStep.set(index, usage);
    }
    return events;
  }

  flush(): HeterogeneousAgentEvent[] {
    if (this.flushed) return [];
    this.flushed = true;
    return [
      ...this.settlePendingTools('Antigravity ended before this tool returned a result.'),
      ...this.closeStream(),
    ];
  }

  validateCompletion(): HeterogeneousAgentEvent[] {
    if (this.resultReceived || this.completionValidated) return [];
    this.completionValidated = true;
    return [
      this.event('error', {
        agentType: IDENTIFIER,
        code: 'incomplete_response',
        message: 'Antigravity exited without a final result. Update agy and retry.',
      }),
    ];
  }

  private openStream(): HeterogeneousAgentEvent[] {
    if (this.streamOpen) return [];
    this.streamOpen = true;
    return [
      this.event('stream_start', {
        model: this.model,
        newStep: this.stepIndex > 0,
        provider: IDENTIFIER,
        sessionId: this.sessionId,
      }),
    ];
  }

  private closeStream(): HeterogeneousAgentEvent[] {
    const events: HeterogeneousAgentEvent[] = [];
    if (this.usageByStep.size) {
      const usage = [...this.usageByStep.values()].reduce((total, next) => ({
        inputCachedTokens: (total.inputCachedTokens ?? 0) + (next.inputCachedTokens ?? 0),
        inputCacheMissTokens: total.inputCacheMissTokens + next.inputCacheMissTokens,
        outputReasoningTokens:
          (total.outputReasoningTokens ?? 0) + (next.outputReasoningTokens ?? 0),
        outputTextTokens: (total.outputTextTokens ?? 0) + (next.outputTextTokens ?? 0),
        totalInputTokens: total.totalInputTokens + next.totalInputTokens,
        totalOutputTokens: total.totalOutputTokens + next.totalOutputTokens,
        totalTokens: total.totalTokens + next.totalTokens,
      }));
      events.push(
        this.event('step_complete', {
          model: this.model,
          phase: 'turn_metadata',
          provider: IDENTIFIER,
          usage,
        }),
      );
      this.usageByStep.clear();
    }
    if (this.streamOpen) {
      events.push(this.event('stream_end', {}));
      this.streamOpen = false;
    }
    return events;
  }

  private handleTool(index: number, step: UnknownRecord): HeterogeneousAgentEvent[] {
    const info = toRecord(step.tool_info);
    const subagents = toRecord(step.subagent_info);
    const name = pickString(info?.name) ?? pickString(step.tool_name);
    if (!name && !subagents) return [];
    const events = this.openStream();
    this.toolSinceResponse = true;
    let pending = this.pendingTools.get(index);
    const args = JSON.stringify(info?.parameters ?? subagents ?? {});
    if (!pending) {
      const payload: ToolCallPayload = {
        apiName: name ?? 'subagents',
        arguments: args,
        id: `agy_${this.sessionId ?? 'session'}_${index}`,
        identifier: IDENTIFIER,
        type: 'default',
      };
      pending = { payload, rawStepIndex: index, stepIndex: this.stepIndex };
      this.pendingTools.set(index, pending);
    } else if (info?.parameters !== undefined) {
      pending.payload.arguments = args;
    }
    const isTerminal = TERMINAL_STEP_STATES.has(String(step.state));
    // Persistence snapshots tools_calling, while trace recorders snapshot tool_start.
    // Neither may publish a name-only ACTIVE update with placeholder arguments.
    if (info?.parameters !== undefined || isTerminal) events.push(...this.startTool(pending));
    if (isTerminal) {
      const error = toRecord(info?.error) ?? toRecord(step.error);
      const output = stringifyOutput(info?.output ?? subagents);
      const errorText =
        pickString(error?.message) ??
        pickString(info?.error) ??
        pickString(step.error) ??
        stringifyOutput(info?.error ?? step.error);
      const isError = step.state !== 'DONE' || info?.error != null || step.error != null;
      const content =
        [output, errorText].filter(Boolean).join('\n') ||
        (isError ? `Tool ended with state ${String(step.state)}.` : '');
      events.push(...this.toolResult(pending, content, isError));
      this.pendingTools.delete(index);
    }
    return events;
  }

  private startTool(tool: PendingTool): HeterogeneousAgentEvent[] {
    if (tool.started) return [];
    tool.started = true;
    this.stepTools.push(tool.payload);
    return [
      this.event(
        'stream_chunk',
        {
          chunkType: 'tools_calling',
          toolsCalling: this.stepTools.map((payload) => ({ ...payload })),
        },
        tool.stepIndex,
      ),
      this.event(
        'tool_start',
        { toolCalling: { ...tool.payload }, toolCallId: tool.payload.id },
        tool.stepIndex,
      ),
    ];
  }

  private toolResult(
    tool: PendingTool,
    content: string,
    isError: boolean,
  ): HeterogeneousAgentEvent[] {
    return [
      ...this.startTool(tool),
      this.event('tool_result', { content, isError, toolCallId: tool.payload.id }, tool.stepIndex),
      this.event(
        'tool_end',
        {
          isSuccess: !isError,
          payload: { toolCalling: tool.payload },
          result: { content, success: !isError },
          toolCallId: tool.payload.id,
        },
        tool.stepIndex,
      ),
    ];
  }

  private settlePendingTools(message: string): HeterogeneousAgentEvent[] {
    const events = [...this.pendingTools.values()].flatMap((tool) =>
      this.toolResult(tool, message, true),
    );
    this.pendingTools.clear();
    return events;
  }

  private settleResultPendingTools(): {
    events: HeterogeneousAgentEvent[];
    hasUnsettledTools: boolean;
  } {
    const canDetachBackgroundTools =
      !this.toolSinceResponse &&
      !this.responseStepErrored &&
      this.responseStep !== undefined &&
      this.completedSteps.has(this.responseStep) &&
      this.hasResponseText;
    let hasUnsettledTools = false;
    const events = [...this.pendingTools.values()].flatMap((tool) => {
      if (canDetachBackgroundTools && tool.rawStepIndex < this.responseStep!) {
        return this.toolResult(tool, 'Running in background.', false);
      }
      hasUnsettledTools = true;
      return this.toolResult(tool, 'Antigravity ended before this tool returned a result.', true);
    });
    this.pendingTools.clear();
    return { events, hasUnsettledTools };
  }

  /**
   * Like `result.usage`, agy's terminal `result.status` / `result.error` scans
   * the whole conversation trajectory rather than just the active turn. A single
   * historical or auto-retried `ERROR_MESSAGE` step (such as a transient stream
   * interruption that agy already recovered from) permanently stamps
   * `status: "ERROR"` onto that turn and every later `--conversation` turn.
   * Trust the per-turn `step_update` stream when this turn finished cleanly on a
   * `DONE` `agent_response` with non-empty text.
   */
  private hasCompletedTurnResponse(result: UnknownRecord, hasUnsettledTools: boolean): boolean {
    if (result.status !== 'ERROR' || hasUnsettledTools || this.toolSinceResponse) return false;
    if (isRecord(result.json_schema) && result.structured_output === undefined) return false;
    return (
      !this.responseStepErrored &&
      this.responseStep !== undefined &&
      this.completedSteps.has(this.responseStep) &&
      this.latestNonCheckpointStep === this.responseStep &&
      this.hasResponseText &&
      Boolean(pickString(result.response)?.trim())
    );
  }

  private handleResult(result: UnknownRecord): HeterogeneousAgentEvent[] {
    this.resultReceived = true;
    this.sessionId ??= pickString(result.conversation_id);
    // Materialize unfinished tools in their owning turn before a fallback response opens a new one.
    const { events, hasUnsettledTools } = this.settleResultPendingTools();
    if (result.status === 'SUCCESS' || this.hasCompletedTurnResponse(result, hasUnsettledTools)) {
      // result.response repeats the streamed answer. Use it only when no final
      // response was streamed, never as another delta after agent_response.
      if (
        (!this.hasResponseText || this.toolSinceResponse) &&
        typeof result.response === 'string' &&
        result.response
      ) {
        if (this.toolSinceResponse) {
          events.push(...this.closeStream());
          this.stepIndex += 1;
        }
        events.push(
          ...this.openStream(),
          this.event('stream_chunk', { chunkType: 'text', content: result.response }),
        );
      }
      if (hasUnsettledTools) {
        events.push(
          this.event('error', {
            agentType: IDENTIFIER,
            code: 'incomplete_tool_result',
            message: 'Antigravity completed without returning all tool results.',
          }),
        );
      }
    } else {
      const detail =
        pickString(result.error) ||
        `Antigravity ended with status ${String(result.status ?? 'unknown')}.`;
      events.push(
        this.event(
          'error',
          classifyCliMessageError({ agentType: IDENTIFIER, detail }) ?? {
            agentType: IDENTIFIER,
            code: 'antigravity_run_error',
            message: detail,
          },
        ),
      );
    }
    events.push(...this.closeStream());
    // Result counters are cumulative across a resumed conversation, so they are
    // not emitted as `result_usage`: trace recorders treat that phase as the
    // run total. Step_update usage (turn_metadata) is the only per-run source.
    return events;
  }

  private event(
    type: HeterogeneousAgentEvent['type'],
    data: unknown,
    stepIndex = this.stepIndex,
  ): HeterogeneousAgentEvent {
    return { data, stepIndex, timestamp: Date.now(), type };
  }
}
