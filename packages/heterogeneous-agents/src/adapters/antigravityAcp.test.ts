import { describe, expect, it } from 'vitest';

import { AntigravityAcpAdapter } from './antigravityAcp';

describe('AntigravityAcpAdapter', () => {
  it('adapts ACP thoughts, run_command tool hooks, step boundaries and Antigravity usage math', () => {
    const adapter = new AntigravityAcpAdapter();

    expect(
      adapter.adapt({
        model: 'gemini-4-carbon-high',
        sessionId: 'agy-acp-1',
        type: 'antigravity_session',
      }),
    ).toEqual([]);
    expect(adapter.sessionId).toBe('agy-acp-1');

    const thoughtEvents = adapter.adapt({
      content: { text: 'Inspecting image and workspace...', type: 'text' },
      sessionUpdate: 'agent_thought_chunk',
    });
    expect(thoughtEvents).toMatchObject([
      {
        data: {
          model: 'gemini-4-carbon-high',
          provider: 'antigravity',
          sessionId: 'agy-acp-1',
        },
        stepIndex: 0,
        type: 'stream_start',
      },
      {
        data: { chunkType: 'reasoning', reasoning: 'Inspecting image and workspace...' },
        stepIndex: 0,
        type: 'stream_chunk',
      },
    ]);

    const toolStartEvents = adapter.adapt({
      args: { CommandLine: 'git switch -c feat/acp-images', WaitMsBeforeAsync: 5000 },
      kind: 'execute',
      name: 'run_command',
      sessionUpdate: 'tool_call',
      status: 'in_progress',
      title: 'git switch -c feat/acp-images',
      toolCallId: 'call_1',
    });
    expect(toolStartEvents).toMatchObject([
      {
        data: {
          chunkType: 'tools_calling',
          toolsCalling: [
            {
              apiName: 'run_command',
              arguments: '{"CommandLine":"git switch -c feat/acp-images","WaitMsBeforeAsync":5000}',
              id: 'call_1',
              identifier: 'antigravity',
            },
          ],
        },
        stepIndex: 0,
        type: 'stream_chunk',
      },
      {
        data: {
          toolCallId: 'call_1',
          toolCalling: {
            apiName: 'run_command',
            identifier: 'antigravity',
          },
        },
        stepIndex: 0,
        type: 'tool_start',
      },
    ]);

    const toolEndEvents = adapter.adapt({
      content: [
        {
          content: { text: 'Switched to a new branch feat/acp-images', type: 'text' },
          type: 'content',
        },
      ],
      name: 'run_command',
      sessionUpdate: 'tool_call_update',
      status: 'completed',
      toolCallId: 'call_1',
    });
    expect(toolEndEvents).toMatchObject([
      {
        data: {
          content: 'Switched to a new branch feat/acp-images',
          isError: false,
          toolCallId: 'call_1',
        },
        stepIndex: 0,
        type: 'tool_result',
      },
      {
        data: {
          isSuccess: true,
          payload: {
            toolCalling: {
              apiName: 'run_command',
              arguments: '{"CommandLine":"git switch -c feat/acp-images","WaitMsBeforeAsync":5000}',
              id: 'call_1',
              identifier: 'antigravity',
            },
          },
          result: {
            content: 'Switched to a new branch feat/acp-images',
            success: true,
          },
          toolCallId: 'call_1',
        },
        stepIndex: 0,
        type: 'tool_end',
      },
    ]);

    const replyEvents = adapter.adapt({
      content: { text: 'Done.', type: 'text' },
      sessionUpdate: 'agent_message_chunk',
    });
    expect(replyEvents).toMatchObject([
      { stepIndex: 0, type: 'stream_end' },
      {
        data: {
          model: 'gemini-4-carbon-high',
          newStep: true,
          provider: 'antigravity',
          sessionId: 'agy-acp-1',
        },
        stepIndex: 1,
        type: 'stream_start',
      },
      {
        data: { chunkType: 'text', content: 'Done.' },
        stepIndex: 1,
        type: 'stream_chunk',
      },
    ]);

    const completedEvents = adapter.adapt({
      stopReason: 'end_turn',
      type: 'antigravity_prompt_completed',
      usage: {
        cachedReadTokens: 48_927,
        cachedWriteTokens: 0,
        inputTokens: 35_722,
        outputTokens: 218,
        thoughtTokens: 56,
        totalTokens: 84_867,
      },
    });

    expect(completedEvents).toContainEqual(
      expect.objectContaining({
        data: {
          model: 'gemini-4-carbon-high',
          phase: 'turn_metadata',
          provider: 'antigravity',
          usage: {
            inputCachedTokens: 48_927,
            inputCacheMissTokens: 35_722,
            inputWriteCacheTokens: undefined,
            outputReasoningTokens: 56,
            outputTextTokens: 162,
            totalInputTokens: 84_649,
            totalOutputTokens: 218,
            totalTokens: 84_867,
          },
        },
        type: 'step_complete',
      }),
    );
    expect(completedEvents.at(-1)).toMatchObject({
      data: { stopReason: 'end_turn' },
      type: 'agent_runtime_end',
    });
  });

  it('classifies Antigravity ACP authentication errors into structured status-guide errors', () => {
    const adapter = new AntigravityAcpAdapter();
    const events = adapter.adapt({
      message: 'Authentication required: please run `agy` and sign in.',
      type: 'antigravity_error',
    });

    expect(events.at(-1)).toMatchObject({
      data: {
        agentType: 'antigravity',
        code: 'auth_required',
        command: 'agy',
      },
      type: 'error',
    });
  });
});
