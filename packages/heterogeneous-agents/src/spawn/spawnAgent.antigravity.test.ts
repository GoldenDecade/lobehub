import type * as childProcess from 'node:child_process';
import { EventEmitter } from 'node:events';
import type * as os from 'node:os';
import { PassThrough } from 'node:stream';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as resolveCliCommand from './resolveCliCommand';

const spawnCalls: Array<{ args: string[]; command: string; options: any }> = [];
let nextFakeProc: any = null;

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof childProcess>('node:child_process');
  return {
    ...actual,
    spawn: vi.fn((command: string, args: string[], options: any) => {
      spawnCalls.push({ args, command, options });
      return nextFakeProc;
    }),
  };
});

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof os>('node:os');
  return { ...actual, platform: vi.fn(() => 'linux') };
});

vi.mock('./resolveCliCommand', async () => {
  const actual = await vi.importActual<typeof resolveCliCommand>('./resolveCliCommand');
  return { ...actual, detectHeterogeneousCliCommand: vi.fn() };
});

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** A child speaking Antigravity ACP over stdio. */
const createFakeAcpProc = () => {
  const proc = new EventEmitter() as any;
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const rpcRequests: Array<Record<string, any>> = [];
  const send = (payload: Record<string, unknown>) => stdout.write(`${JSON.stringify(payload)}\n`);

  proc.stdout = stdout;
  proc.stderr = stderr;
  proc.stdin = {
    end: vi.fn(() => {
      queueMicrotask(() => {
        stdout.end();
        stderr.end();
        proc.emit('exit', 0, null);
      });
    }),
    once: vi.fn(),
    write: vi.fn((chunk: string, cb?: () => void) => {
      const msg = JSON.parse(chunk.trim());
      rpcRequests.push(msg);
      queueMicrotask(() => {
        if (msg.method === 'initialize') {
          send({
            id: msg.id,
            result: {
              agentCapabilities: {
                loadSession: true,
                promptCapabilities: { image: true },
                sessionCapabilities: { close: {}, resume: {} },
              },
              protocolVersion: 1,
            },
          });
        } else if (msg.method === 'session/resume') {
          send({
            id: msg.id,
            result: {
              models: { availableModels: [], currentModelId: 'gemini-4-carbon-high' },
              sessionId: msg.params.sessionId,
            },
          });
        } else if (msg.method === 'session/prompt') {
          send({
            method: 'session/update',
            params: {
              sessionId: msg.params.sessionId,
              update: {
                content: { text: 'continued with image', type: 'text' },
                sessionUpdate: 'agent_message_chunk',
              },
            },
          });
          send({ id: msg.id, result: { stopReason: 'end_turn' } });
        } else if (msg.method === 'session/close') {
          send({ id: msg.id, result: {} });
        }
      });
      cb?.();
      return true;
    }),
  };
  proc.kill = vi.fn(() => {
    proc.killed = true;
    proc.emit('exit', 0, null);
    return true;
  });
  proc.killed = false;
  proc.pid = 12_345;

  return { proc, rpcRequests };
};

describe('spawnAgent — Antigravity', () => {
  beforeEach(() => {
    spawnCalls.length = 0;
    nextFakeProc = null;
    vi.mocked(resolveCliCommand.detectHeterogeneousCliCommand).mockResolvedValue({
      available: true,
      path: 'agy',
    });
  });

  it('spawns Antigravity over native ACP, attaches images and resumes the conversation', async () => {
    const fake = createFakeAcpProc();
    nextFakeProc = fake.proc;
    const { spawnAgent } = await import('./spawnAgent');
    const handle = await spawnAgent({
      agentType: 'antigravity',
      operationId: 'op-agy',
      prompt: [
        { text: 'continue', type: 'text' },
        {
          source: { data: TINY_PNG_BASE64, mediaType: 'image/png', type: 'base64' },
          type: 'image',
        },
      ],
      resumeSessionId: 'agy-session',
    });

    const events = [];
    for await (const event of handle.events) events.push(event);
    await handle.exit;

    expect(spawnCalls[0].command).toBe('agy');
    expect(spawnCalls[0].options.shell).not.toBe(true);
    expect(spawnCalls[0].args).toEqual(['acp', '--dangerously-skip-permissions']);
    expect(fake.rpcRequests.map((r) => r.method)).toEqual([
      'initialize',
      'session/resume',
      'session/prompt',
      'session/close',
    ]);
    expect(fake.rpcRequests[2].params).toEqual({
      prompt: [
        { text: 'continue', type: 'text' },
        { data: TINY_PNG_BASE64, mimeType: 'image/png', type: 'image' },
      ],
      sessionId: 'agy-session',
    });
    expect(handle.sessionId).toBe('agy-session');
    expect(
      events.filter((event) => event.type === 'stream_chunk' && event.data.chunkType === 'text'),
    ).toHaveLength(1);
    expect(events.some((event) => event.type === 'error')).toBe(false);
  });
});
