import { describe, expect, it } from 'vitest';

import { createAdapter } from '../registry';
import type { HeterogeneousAgentEvent } from '../types';
import { AntigravityAdapter } from './antigravity';

const init = { conversation_id: 'conv-1', event: 'init', init: { model: 'gemini-test' } };
const step = (index: number, fields: Record<string, unknown> = {}) => ({
  event: 'step_update',
  step_update: {
    conversation_id: 'conv-1',
    state: 'DONE',
    step_index: index,
    step_type: 'agent_response',
    ...fields,
  },
});
const result = (fields: Record<string, unknown> = {}) => ({
  event: 'result',
  result: { conversation_id: 'conv-1', response: 'hello\n', status: 'SUCCESS', ...fields },
});
const text = (events: HeterogeneousAgentEvent[]) =>
  events
    .filter((e) => e.type === 'stream_chunk' && e.data.chunkType === 'text')
    .map((e) => e.data.content)
    .join('');
const tool = (index: number, fields: Record<string, unknown> = {}) =>
  step(index, {
    step_type: 'tool',
    tool_info: {
      name: 'run_command',
      parameters: { CommandLine: 'echo hello' },
      output: 'hello\n',
    },
    ...fields,
  });

describe('AntigravityAdapter', () => {
  it('registers native agy and captures its conversation/model', () => {
    const adapter = createAdapter('antigravity');
    expect(adapter).toBeInstanceOf(AntigravityAdapter);
    expect(adapter.adapt(init)[0]).toMatchObject({
      data: { model: 'gemini-test', provider: 'antigravity', sessionId: 'conv-1' },
      type: 'stream_start',
    });
    expect(adapter.sessionId).toBe('conv-1');
  });

  it('concatenates ACTIVE and DONE deltas without echoing result.response', () => {
    const adapter = new AntigravityAdapter();
    const events = [
      init,
      step(2, { state: 'ACTIVE', text_delta: 'hel' }),
      step(2, { text_delta: 'lo\n' }),
      result(),
    ].flatMap((raw) => adapter.adapt(raw));
    expect(text(events)).toBe('hello\n');
    expect(events.filter((e) => e.type === 'stream_end')).toHaveLength(1);
    expect(adapter.flush()).toEqual([]);
    expect(adapter.validateCompletion()).toEqual([]);
  });

  it('keeps repeated text fragments and ignores a duplicate DONE step', () => {
    const adapter = new AntigravityAdapter();
    const events = [
      init,
      step(2, { state: 'ACTIVE', text_delta: 'ha' }),
      step(2, { text_delta: 'ha' }),
      step(2, { text_delta: 'ha' }),
    ].flatMap((raw) => adapter.adapt(raw));
    expect(text(events)).toBe('haha');
  });

  it('creates a completed-only tool before its result and starts the next assistant separately', () => {
    const adapter = new AntigravityAdapter();
    const events = [
      init,
      step(1, { text_delta: 'Checking.' }),
      tool(3),
      tool(4),
      step(6, { text_delta: 'hello\n' }),
      result(),
    ].flatMap((raw) => adapter.adapt(raw));
    const calls = events.filter(
      (e) => e.type === 'stream_chunk' && e.data.chunkType === 'tools_calling',
    );
    expect(calls[1].data.toolsCalling).toHaveLength(2);
    const toolResults = events.filter((e) => e.type === 'tool_result');
    expect(toolResults.map((e) => e.data.toolCallId)).toEqual(['agy_conv-1_3', 'agy_conv-1_4']);
    expect(toolResults.every((e) => e.stepIndex === 0)).toBe(true);
    expect(events.indexOf(calls[0])).toBeLessThan(events.indexOf(toolResults[0]));
    expect(events.filter((e) => e.type === 'stream_start')[1]).toMatchObject({
      data: { newStep: true },
      stepIndex: 1,
    });
    expect(text(events)).toBe('Checking.hello\n');
  });

  it('starts each tool once with its final arguments so trace recorders keep the tool step', () => {
    const adapter = new AntigravityAdapter();
    // Clone like the IPC/stdout bridge, so later payload mutation cannot hide stale args.
    const adapt = (raw: unknown) => structuredClone(adapter.adapt(raw));
    const events: HeterogeneousAgentEvent[] = [
      init,
      tool(3, { state: 'ACTIVE', tool_info: { name: 'run_command' } }),
      tool(3),
    ].flatMap(adapt);
    const calls = events.filter(
      (e) => e.type === 'stream_chunk' && e.data.chunkType === 'tools_calling',
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].data.toolsCalling[0].arguments).toBe('{"CommandLine":"echo hello"}');
    const starts = events.filter((e) => e.type === 'tool_start');
    expect(starts).toHaveLength(1);
    expect(events.indexOf(calls[0])).toBeLessThan(events.indexOf(starts[0]));
    expect(starts[0].data).toEqual({
      toolCallId: 'agy_conv-1_3',
      toolCalling: {
        apiName: 'run_command',
        arguments: '{"CommandLine":"echo hello"}',
        id: 'agy_conv-1_3',
        identifier: 'antigravity',
        type: 'default',
      },
    });
    expect(events.indexOf(starts[0])).toBeLessThan(
      events.findIndex((e) => e.type === 'tool_result'),
    );
  });

  it('publishes explicitly empty parameters without waiting for completion', () => {
    const adapter = new AntigravityAdapter();
    adapter.adapt(init);
    const events = adapter.adapt(
      tool(3, { state: 'ACTIVE', tool_info: { name: 'list_resources', parameters: {} } }),
    );
    expect(events.map((e) => e.type)).toEqual(['stream_chunk', 'tool_start']);
    expect(events[0].data.toolsCalling[0].arguments).toBe('{}');
  });

  it('starts an interrupted tool before settling it', () => {
    const adapter = new AntigravityAdapter();
    adapter.adapt(init);
    adapter.adapt(tool(3, { state: 'ACTIVE', tool_info: { name: 'run_command' } }));
    expect(adapter.flush().map((e) => e.type)).toEqual([
      'stream_chunk',
      'tool_start',
      'tool_result',
      'tool_end',
      'stream_end',
    ]);
  });

  it('updates a running tool with its final arguments and error exactly once', () => {
    const adapter = new AntigravityAdapter();
    adapter.adapt(init);
    adapter.adapt(tool(3, { state: 'ACTIVE', tool_info: { name: 'write_to_file' } }));
    const completed = tool(3, {
      tool_info: {
        name: 'write_to_file',
        parameters: { path: 'test.txt' },
        error: { type: 'DENIED', message: 'Permission denied' },
      },
    });
    const events = adapter.adapt(completed);
    expect(events[0].data.toolsCalling[0].arguments).toBe('{"path":"test.txt"}');
    expect(events.find((e) => e.type === 'tool_result')?.data).toMatchObject({
      content: 'Permission denied',
      isError: true,
      toolCallId: 'agy_conv-1_3',
    });
    expect(events.find((e) => e.type === 'tool_end')?.data.isSuccess).toBe(false);
    expect(adapter.adapt(completed)).toEqual([]);
  });

  it('settles real agy ERROR tool steps and detached background tools without failing a completed turn', () => {
    const adapter = new AntigravityAdapter();
    const events = [
      init,
      // Backgrounded run_command detaches and stays ACTIVE while the model continues.
      tool(2, {
        state: 'ACTIVE',
        tool_info: { name: 'run_command', parameters: { CommandLine: 'sleep 15' } },
      }),
      // Failed read_file ends with state: ERROR in real agy, not state: DONE.
      tool(3, {
        state: 'ACTIVE',
        tool_info: { name: 'read_file', parameters: { Path: '/tmp/missing.txt' } },
      }),
      tool(3, {
        state: 'ERROR',
        tool_info: {
          error: { message: 'file does not exist', type: 'TOOL_ERROR' },
          name: 'read_file',
          parameters: { Path: '/tmp/missing.txt' },
        },
      }),
      step(5, { state: 'DONE', text_delta: 'Handled missing file and finished.\n' }),
      result({
        error: 'The stream was interrupted. Please continue the task you were working on.',
        response: 'Handled missing file and finished.\n',
        status: 'ERROR',
      }),
    ].flatMap((raw) => adapter.adapt(raw));

    expect(events.filter((e) => e.type === 'error')).toEqual([]);
    const toolResults = events.filter((e) => e.type === 'tool_result');
    expect(toolResults).toEqual([
      expect.objectContaining({
        data: {
          content: 'file does not exist',
          isError: true,
          toolCallId: 'agy_conv-1_3',
        },
        stepIndex: 0,
      }),
      expect.objectContaining({
        data: {
          content: 'Running in background.',
          isError: false,
          toolCallId: 'agy_conv-1_2',
        },
        stepIndex: 0,
      }),
    ]);
    expect(text(events)).toBe('Handled missing file and finished.\n');
  });

  it('still emits incomplete_tool_result when a trailing ACTIVE tool never settles before SUCCESS result', () => {
    const adapter = new AntigravityAdapter();
    const events = [
      init,
      step(1, { state: 'DONE', text_delta: 'Checking.' }),
      tool(2, {
        state: 'ACTIVE',
        tool_info: { name: 'run_command', parameters: { CommandLine: 'echo hi' } },
      }),
      result({ response: '', status: 'SUCCESS' }),
    ].flatMap((raw) => adapter.adapt(raw));

    expect(events).toContainEqual(
      expect.objectContaining({
        data: expect.objectContaining({ code: 'incomplete_tool_result' }),
        type: 'error',
      }),
    );
    expect(events.find((e) => e.type === 'tool_result')?.data).toMatchObject({
      isError: true,
      toolCallId: 'agy_conv-1_2',
    });
  });

  it('settles unfinished tools on interruption and detects missing terminal results', () => {
    const adapter = new AntigravityAdapter();
    adapter.adapt(init);
    adapter.adapt(tool(3, { state: 'ACTIVE' }));
    expect(adapter.flush().find((e) => e.type === 'tool_result')?.data).toMatchObject({
      isError: true,
      toolCallId: 'agy_conv-1_3',
    });
    expect(adapter.validateCompletion()[0]).toMatchObject({
      type: 'error',
      data: { code: 'incomplete_response' },
    });
    expect(adapter.flush()).toEqual([]);
    expect(adapter.validateCompletion()).toEqual([]);
  });

  it('classifies missing login using the Antigravity sign-in guide', () => {
    const adapter = new AntigravityAdapter();
    expect(
      adapter.adapt(result({ status: 'ERROR', error: 'authentication required', response: '' })),
    ).toContainEqual(
      expect.objectContaining({
        type: 'error',
        data: expect.objectContaining({
          agentType: 'antigravity',
          code: 'auth_required',
          command: 'agy',
        }),
      }),
    );
  });

  it('preserves quota guidance when the terminal error also mentions authentication', () => {
    const adapter = new AntigravityAdapter();
    const detail = "Authentication required: You've hit your weekly limit. Resets tomorrow.";
    expect(adapter.adapt(result({ status: 'ERROR', error: detail }))).toContainEqual(
      expect.objectContaining({
        type: 'error',
        data: expect.objectContaining({
          agentType: 'antigravity',
          code: 'rate_limit',
          details: { kind: 'usage_limit' },
          message: detail,
          rateLimitInfo: { rateLimitType: 'seven_day', status: 'rejected' },
        }),
      }),
    );
  });

  it.each(['ERROR', 'CANCELED', 'INTERRUPTED', 'INVALID', 'WAITING', 'RUNNING'])(
    'does not treat terminal %s as success',
    (status) => {
      const adapter = new AntigravityAdapter();
      expect(adapter.adapt(result({ status })).some((e) => e.type === 'error')).toBe(true);
      expect(adapter.validateCompletion()).toEqual([]);
    },
  );

  it('ignores sticky trajectory ERROR status when this turn completed a final agent_response', () => {
    const adapter = new AntigravityAdapter();
    const events = [
      init,
      step(267, { step_type: 'user_input' }),
      tool(270),
      step(277, { state: 'ACTIVE', text_delta: 'All 8 checks ' }),
      step(277, {
        state: 'DONE',
        text_delta: 'passed.\n',
        usage: { input_tokens: 100, output_tokens: 20 },
      }),
      step(278, {
        state: 'DONE',
        step_type: 'checkpoint',
        usage: { input_tokens: 5, output_tokens: 1 },
      }),
      result({
        error: 'The stream was interrupted. Please continue the task you were working on.',
        response: 'All 8 checks passed.\n',
        status: 'ERROR',
      }),
    ].flatMap((raw) => adapter.adapt(raw));

    expect(events.filter((e) => e.type === 'error')).toEqual([]);
    expect(text(events)).toBe('All 8 checks passed.\n');
    expect(adapter.validateCompletion()).toEqual([]);
  });

  it('ignores sticky ERROR status after an in-turn stream interruption auto-retries and completes', () => {
    const adapter = new AntigravityAdapter();
    const events = [
      init,
      step(179, { state: 'DONE', text_delta: '' }),
      step(180, { state: 'DONE', step_type: 'system_message' }),
      step(181, { state: 'DONE', text_delta: 'Recovered full reply.\n' }),
      result({
        error: 'The stream was interrupted. Please continue the task you were working on.',
        response: 'Recovered full reply.\n',
        status: 'ERROR',
      }),
    ].flatMap((raw) => adapter.adapt(raw));

    expect(events.filter((e) => e.type === 'error')).toEqual([]);
    expect(text(events)).toBe('Recovered full reply.\n');
  });

  it('still emits terminal error when an interrupted turn did not finish with a clean agent_response', () => {
    const detail = 'The stream was interrupted. Please continue the task you were working on.';

    // 1. agent_response stayed ACTIVE (cutoff mid-stream, never reached DONE)
    const activeCutoff = new AntigravityAdapter();
    const activeEvents = [
      init,
      step(10, { state: 'ACTIVE', text_delta: 'Partial answer' }),
      result({ error: detail, response: 'Partial answer', status: 'ERROR' }),
    ].flatMap((raw) => activeCutoff.adapt(raw));
    expect(activeEvents).toContainEqual(
      expect.objectContaining({
        data: expect.objectContaining({ code: 'antigravity_run_error', message: detail }),
        type: 'error',
      }),
    );

    // 2. An error/system step occurred after the last agent_response without a later recovery step
    const unrecoveredStep = new AntigravityAdapter();
    const unrecoveredEvents = [
      init,
      step(10, { state: 'DONE', text_delta: 'Partial answer' }),
      step(11, { state: 'DONE', step_type: 'system_message' }),
      result({ error: detail, response: 'Partial answer', status: 'ERROR' }),
    ].flatMap((raw) => unrecoveredStep.adapt(raw));
    expect(unrecoveredEvents).toContainEqual(
      expect.objectContaining({
        data: expect.objectContaining({ code: 'antigravity_run_error', message: detail }),
        type: 'error',
      }),
    );

    // 3. Explicit cancellation/interruption statuses are never suppressed
    for (const status of ['CANCELED', 'INTERRUPTED']) {
      const canceled = new AntigravityAdapter();
      const canceledEvents = [
        init,
        step(10, { state: 'DONE', text_delta: 'Done text' }),
        result({ response: 'Done text', status }),
      ].flatMap((raw) => canceled.adapt(raw));
      expect(canceledEvents.some((e) => e.type === 'error')).toBe(true);
    }

    // 4. --json-schema validation failure after a completed agent_response still surfaces
    const schemaFailure = new AntigravityAdapter();
    const schemaEvents = [
      init,
      step(10, { state: 'DONE', text_delta: 'not valid json' }),
      result({
        error: 'failed to validate structured output',
        json_schema: { type: 'object' },
        response: 'not valid json',
        status: 'ERROR',
      }),
    ].flatMap((raw) => schemaFailure.adapt(raw));
    expect(schemaEvents).toContainEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'antigravity_run_error',
          message: 'failed to validate structured output',
        }),
        type: 'error',
      }),
    );
  });

  it('uses result-only text as a fallback, including after tool work', () => {
    const adapter = new AntigravityAdapter();
    const events = [init, step(1, { text_delta: 'Checking.' }), tool(3), result()].flatMap((raw) =>
      adapter.adapt(raw),
    );
    expect(text(events)).toBe('Checking.hello\n');
    expect(events.filter((e) => e.type === 'stream_start')[1].stepIndex).toBe(1);
  });

  it('keeps resumed cumulative usage separate from this turn', () => {
    const adapter = new AntigravityAdapter();
    const events = [
      init,
      step(20, {
        text_delta: 'hello\n',
        usage: {
          input_tokens: 278,
          cache_read_tokens: 30214,
          output_tokens: 4,
          thinking_tokens: 1,
        },
      }),
      result({ usage: { input_tokens: 30662, cache_read_tokens: 30214, output_tokens: 8 } }),
    ].flatMap((raw) => adapter.adapt(raw));
    const metadata = events.filter(
      (e) => e.type === 'step_complete' && e.data.phase === 'turn_metadata',
    );
    expect(metadata).toHaveLength(1);
    expect(metadata[0].data.usage).toMatchObject({
      inputCacheMissTokens: 278,
      totalInputTokens: 30492,
      totalOutputTokens: 4,
      outputReasoningTokens: 1,
    });
    // The cumulative result total must not reach recorders as the run total.
    expect(events.some((e) => e.type === 'step_complete' && e.data.phase === 'result_usage')).toBe(
      false,
    );
  });

  it('ignores malformed, unknown, and child-conversation events', () => {
    const adapter = new AntigravityAdapter();
    adapter.adapt(init);
    for (const raw of [
      null,
      [],
      {},
      { event: 'future' },
      step(-1),
      step(1, { conversation_id: 'child', text_delta: 'hidden' }),
    ]) {
      expect(adapter.adapt(raw)).toEqual([]);
    }
  });

  it('adapts multi-turn liveInput streams and emits user_message replay for steered turns', () => {
    const steerQueue = ['steer-uuid-1'];
    const adapter = new AntigravityAdapter({
      runtimeEndStrategy: 'on-transport-close',
      takeNextSteerUuid: () => steerQueue.shift(),
    });
    const events = [
      init,
      step(0, { state: 'DONE', step_type: 'user_input' }),
      step(1, { state: 'DONE', step_type: 'agent_response', text_delta: 'turn1' }),
      result({ num_turns: 1, response: 'turn1' }),
      step(2, { state: 'DONE', step_type: 'user_input' }),
      step(3, { state: 'DONE', step_type: 'agent_response', text_delta: 'turn2' }),
      result({ num_turns: 2, response: 'turn2' }),
    ].flatMap((raw) => adapter.adapt(raw));

    expect(text(events)).toBe('turn1turn2');
    const replays = events.filter(
      (e) => e.type === 'step_complete' && e.data.phase === 'user_message',
    );
    expect(replays).toHaveLength(1);
    expect(replays[0].data).toEqual({ phase: 'user_message', uuid: 'steer-uuid-1' });
    expect(adapter.validateCompletion()).toEqual([]);
  });

  it('reports incomplete_response when a steered live turn ends without a final result', () => {
    const steerQueue = ['steer-uuid-1'];
    const adapter = new AntigravityAdapter({
      runtimeEndStrategy: 'on-transport-close',
      takeNextSteerUuid: () => steerQueue.shift(),
    });
    for (const raw of [
      init,
      step(0, { state: 'DONE', step_type: 'user_input' }),
      step(1, { state: 'DONE', step_type: 'agent_response', text_delta: 'turn1' }),
      result({ num_turns: 1, response: 'turn1' }),
      step(2, { state: 'DONE', step_type: 'user_input' }),
      step(3, { state: 'ACTIVE', step_type: 'agent_response', text_delta: 'partial' }),
    ]) {
      adapter.adapt(raw);
    }

    const validation = adapter.validateCompletion();
    expect(validation).toHaveLength(1);
    expect(validation[0]).toMatchObject({
      data: { agentType: 'antigravity', code: 'incomplete_response' },
      type: 'error',
    });
  });
});
