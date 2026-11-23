import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

import type { AgentStreamEvent } from '@lobechat/agent-gateway-client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AcpRpcResponseError } from './acpStdioClient';
import {
  AntigravityAcpSession,
  type AntigravityAcpSessionOptions,
  buildAntigravityAcpArgs,
  buildAntigravityAcpPrompt,
  isAntigravityAcpSessionNotFoundError,
} from './antigravityAcpSession';

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, spawn: spawnMock };
});

interface RpcMessage {
  error?: unknown;
  id?: number | string;
  jsonrpc?: string;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
}

type Send = (message: Record<string, unknown>) => void;

const createAcpProcess = (options?: {
  initializeResult?: Record<string, unknown>;
  onMessage?: (message: RpcMessage, context: { child: ChildProcess; send: Send }) => boolean | void;
}) => {
  const child = new EventEmitter() as ChildProcess;
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const requests: RpcMessage[] = [];
  const send: Send = (message) => stdout.write(`${JSON.stringify(message)}\n`);

  Object.assign(child, {
    kill: vi.fn(() => true),
    killed: false,
    pid: 42_001,
    stderr,
    stdin: {
      end: vi.fn(),
      once: vi.fn(),
      write: vi.fn((chunk: string) => {
        const message = JSON.parse(chunk.trim()) as RpcMessage;
        requests.push(message);
        queueMicrotask(() => {
          if (options?.onMessage?.(message, { child, send })) return;
          switch (message.method) {
            case 'initialize': {
              send({
                id: message.id,
                result: options?.initializeResult ?? {
                  agentCapabilities: {
                    loadSession: true,
                    promptCapabilities: { embeddedContext: true, image: true },
                    sessionCapabilities: { close: {}, load: {}, resume: {} },
                  },
                  protocolVersion: 1,
                },
              });
              return;
            }
            case 'session/new':
            case 'session/resume':
            case 'session/load': {
              send({
                id: message.id,
                result: {
                  configOptions: [
                    {
                      category: 'model',
                      currentValue: 'gemini-4-carbon',
                      id: 'model',
                      options: [
                        { name: 'Gemini 4 Carbon', value: 'gemini-4-carbon' },
                        { name: 'Gemini 3.8 Flash', value: 'gemini-3.8-flash' },
                      ],
                      type: 'select',
                    },
                    {
                      category: 'thought_level',
                      currentValue: 'medium',
                      id: 'thought_level',
                      options: [
                        { name: 'Low', value: 'low' },
                        { name: 'Medium', value: 'medium' },
                        { name: 'High', value: 'high' },
                      ],
                      type: 'select',
                    },
                  ],
                  models: {
                    availableModels: [
                      { modelId: 'gemini-4-carbon-medium', name: 'Gemini 4 Carbon (Medium)' },
                      { modelId: 'gemini-4-carbon-high', name: 'Gemini 4 Carbon (High)' },
                      { modelId: 'gemini-3.8-flash-low', name: 'Gemini 3.8 Flash (Low)' },
                      { modelId: 'gemini-3.8-flash-high', name: 'Gemini 3.8 Flash (High)' },
                    ],
                    currentModelId: 'gemini-4-carbon-medium',
                  },
                  sessionId:
                    (message.params?.sessionId as string | undefined) ?? 'agy-acp-session-1',
                },
              });
              return;
            }
            case 'session/set_model':
            case 'session/set_mode':
            case 'session/close': {
              send({ id: message.id, result: {} });
              return;
            }
            case 'session/set_config_option': {
              send({
                id: message.id,
                result: {
                  configOptions: [
                    { category: 'model', currentValue: 'gemini-3.8-flash', id: 'model' },
                    {
                      category: 'thought_level',
                      currentValue: message.params?.value,
                      id: 'thought_level',
                    },
                  ],
                },
              });
              return;
            }
            case 'session/prompt': {
              send({
                method: 'session/update',
                params: {
                  sessionId: message.params?.sessionId,
                  update: {
                    content: { text: 'Image looks sharp.', type: 'text' },
                    sessionUpdate: 'agent_message_chunk',
                  },
                },
              });
              send({
                id: message.id,
                result: {
                  stopReason: 'end_turn',
                  usage: {
                    cachedReadTokens: 100,
                    inputTokens: 50,
                    outputTokens: 10,
                    thoughtTokens: 4,
                    totalTokens: 160,
                  },
                },
              });
            }
          }
        });
        return true;
      }),
    },
    stdout,
  });

  return { child, requests, send, stderr, stdout };
};

const createSessionOptions = (
  overrides: Partial<AntigravityAcpSessionOptions> = {},
): AntigravityAcpSessionOptions => ({
  args: [],
  clientVersion: '2.0.0',
  commandPath: 'agy',
  cwd: '/workspace',
  env: process.env,
  onEvents: vi.fn(),
  onRawMessage: vi.fn(),
  onRuntimeStatus: vi.fn(),
  onSessionId: vi.fn(),
  onStderr: vi.fn(),
  operationId: 'op-agy-1',
  prompt: 'hello',
  sessionId: 'sess-1',
  ...overrides,
});

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('AntigravityAcpSession', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    spawnMock.mockReset();
  });

  it('extracts RPC-managed selector flags while forwarding valid agy acp flags', () => {
    expect(
      buildAntigravityAcpArgs([
        '--model',
        'gemini-4-carbon-high',
        '--effort=high',
        '--mode',
        'accept-edits',
        '--add-dir',
        '/extra',
        '--sandbox',
      ]),
    ).toEqual(['acp', '--dangerously-skip-permissions', '--add-dir', '/extra', '--sandbox']);
  });

  it.each([
    '--output-format=json',
    '--input-format',
    '--prompt-interactive=hello',
    '--remote-control',
    '-i',
    '-p',
    '--continue',
    '--conversation=other',
    '--',
  ])('rejects %s that conflicts with LobeHub ACP session ownership', (flag) => {
    expect(() => buildAntigravityAcpArgs([flag])).toThrow('LobeHub manages');
  });

  it('sends text + base64 image blocks over ACP, applies model/effort/mode, and closes cleanly', async () => {
    const proc = createAcpProcess();
    spawnMock.mockReturnValue(proc.child);

    const streamed: AgentStreamEvent[] = [];
    const onModel = vi.fn();
    const onSessionId = vi.fn();
    const prompt = await buildAntigravityAcpPrompt([
      { text: 'Check this screenshot', type: 'text' },
      {
        source: { data: TINY_PNG_BASE64, mediaType: 'image/png', type: 'base64' },
        type: 'image',
      },
    ]);

    const session = new AntigravityAcpSession(
      createSessionOptions({
        args: ['--effort', 'high', '--mode', 'auto', '--add-dir', '/shared'],
        initialModel: 'gemini-3.8-flash-low',
        onEvents: (events) => {
          streamed.push(...events);
        },
        onModel,
        onSessionId,
        prompt,
      }),
    );

    await session.run();

    expect(spawnMock).toHaveBeenCalledWith(
      'agy',
      ['acp', '--dangerously-skip-permissions', '--add-dir', '/shared'],
      expect.objectContaining({ cwd: '/workspace' }),
    );
    expect(proc.requests.map((r) => r.method)).toEqual([
      'initialize',
      'session/new',
      'session/set_model',
      'session/set_config_option',
      'session/set_mode',
      'session/prompt',
      'session/close',
    ]);
    expect(proc.requests.find((r) => r.method === 'session/set_model')?.params).toEqual({
      modelId: 'gemini-3.8-flash-low',
      sessionId: 'agy-acp-session-1',
    });
    expect(proc.requests.find((r) => r.method === 'session/set_config_option')?.params).toEqual({
      configId: 'thought_level',
      sessionId: 'agy-acp-session-1',
      value: 'high',
    });
    expect(proc.requests.find((r) => r.method === 'session/set_mode')?.params).toEqual({
      modeId: 'auto',
      sessionId: 'agy-acp-session-1',
    });
    expect(proc.requests.find((r) => r.method === 'session/prompt')?.params).toEqual({
      prompt: [
        { text: 'Check this screenshot', type: 'text' },
        { data: TINY_PNG_BASE64, mimeType: 'image/png', type: 'image' },
      ],
      sessionId: 'agy-acp-session-1',
    });
    expect(onSessionId).toHaveBeenCalledWith('agy-acp-session-1');
    expect(onModel).toHaveBeenCalledWith('gemini-3.8-flash-high');
    expect(streamed).toContainEqual(
      expect.objectContaining({
        data: { chunkType: 'text', content: 'Image looks sharp.' },
        type: 'stream_chunk',
      }),
    );
  });

  it('prefers session/resume over session/load and detects missing sessions', async () => {
    const proc = createAcpProcess();
    spawnMock.mockReturnValue(proc.child);

    const session = new AntigravityAcpSession(
      createSessionOptions({ resumeSessionId: 'existing-conv-1' }),
    );
    await session.run();

    expect(proc.requests.map((r) => r.method)).toContain('session/resume');
    expect(proc.requests.map((r) => r.method)).not.toContain('session/load');

    expect(
      isAntigravityAcpSessionNotFoundError(
        new AcpRpcResponseError('session/resume', {
          code: -32_603,
          message: 'Failed to read session missing-conv; retry, or load it with session/load',
        }),
      ),
    ).toBe(true);
    expect(
      isAntigravityAcpSessionNotFoundError(
        new AcpRpcResponseError('session/prompt', {
          code: -32_603,
          message: 'Quota exhausted',
        }),
      ),
    ).toBe(false);
  });

  it('strips inherited SSH session variables under Connect service mode without mutating input env', async () => {
    const proc = createAcpProcess();
    spawnMock.mockReturnValue(proc.child);
    const inputEnv = {
      DBUS_SESSION_BUS_ADDRESS: 'unix:path=/run/user/1000/bus',
      LOBEHUB_CONNECT_SERVICE: '1',
      SSH_AUTH_SOCK: '/tmp/ssh-agent.sock',
      SSH_CLIENT: 'test-client',
      SSH_CONNECTION: 'test-connection',
      SSH_TTY: '/dev/pts/1',
    };

    const session = new AntigravityAcpSession(createSessionOptions({ env: inputEnv }));
    await session.run();

    const spawnEnv = spawnMock.mock.calls[0]?.[2]?.env as NodeJS.ProcessEnv;
    expect(spawnEnv.DBUS_SESSION_BUS_ADDRESS).toBe(inputEnv.DBUS_SESSION_BUS_ADDRESS);
    expect(spawnEnv.SSH_AUTH_SOCK).toBe(inputEnv.SSH_AUTH_SOCK);
    expect(spawnEnv.SSH_CLIENT).toBeUndefined();
    expect(spawnEnv.SSH_CONNECTION).toBeUndefined();
    expect(spawnEnv.SSH_TTY).toBeUndefined();
    expect(inputEnv.SSH_CLIENT).toBe('test-client');
    expect(inputEnv.SSH_CONNECTION).toBe('test-connection');
    expect(inputEnv.SSH_TTY).toBe('/dev/pts/1');
  });
});
