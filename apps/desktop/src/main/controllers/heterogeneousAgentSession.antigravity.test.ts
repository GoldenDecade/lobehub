import { HeterogeneousAgentSessionErrorCode } from '@lobechat/electron-client-ipc';
import * as heteroSpawn from '@lobechat/heterogeneous-agents/spawn';
import { AcpRpcResponseError } from '@lobechat/heterogeneous-agents/spawn';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AcpSessionHost, AgentSession } from './heterogeneousAgentSession';
import {
  closeActiveAcpSessions,
  getAcpResumeError,
  interruptActiveAcpSession,
  sendPromptWithAcpSession,
} from './heterogeneousAgentSession';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp'),
    getVersion: vi.fn(() => '2.0.0'),
  },
}));

const DATA_URL_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const createHost = (): AcpSessionHost => ({
  appendCliTraceFile: vi.fn(),
  broadcast: vi.fn(),
  buildSessionSpawnEnv: vi.fn(() => ({ PATH: '/usr/bin' })),
  completeCancelledSessionBeforeLaunch: vi.fn(async () => {}),
  createCliTraceSession: vi.fn(async () => undefined),
  fileCacheDir: '/tmp/cache',
  flushCliTrace: vi.fn(async () => {}),
  getErrorMessage: (err) => (err instanceof Error ? err.message : String(err)),
  getSessionErrorPayload: (err, sess) =>
    getAcpResumeError(err, sess) ?? (err instanceof Error ? err.message : String(err)),
  needsSessionIntroduction: () => false,
  resolveSessionCommand: (sess) => sess.command,
  resolveSessionWorkingDirectory: (sess) => sess.cwd ?? '/workspace',
  setupAcpInterventionForOp: vi.fn() as never,
  writeCliTraceFile: vi.fn(),
  writeCliTraceJson: vi.fn(),
});

describe('heterogeneousAgentSession — Antigravity ACP', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dispatches Antigravity prompts with image attachments over AntigravityAcpSession', async () => {
    const host = createHost();
    const session: AgentSession = {
      agentSessionId: 'prev-agy-session',
      agentType: 'antigravity',
      args: ['--model', 'gemini-4-carbon-high'],
      command: 'agy',
      cwd: '/workspace',
      model: 'gemini-4-carbon-high',
      sessionId: 'desktop-sess-1',
    };

    const runSpy = vi
      .spyOn(heteroSpawn.AntigravityAcpSession.prototype, 'run')
      .mockImplementation(async function (this: any) {
        this.options.onSessionId('agy-acp-2');
        this.options.onModel?.('gemini-4-carbon-high');
        await this.options.onEvents([
          {
            data: { chunkType: 'text', content: 'Looks good' },
            operationId: 'op-1',
            stepIndex: 0,
            timestamp: 1,
            type: 'stream_chunk',
          },
        ]);
      });

    await sendPromptWithAcpSession(
      host,
      {
        imageList: [{ id: 'img-1', url: DATA_URL_PNG }],
        operationId: 'op-1',
        prompt: '你看下这个对话的内容',
        sessionId: 'desktop-sess-1',
      },
      session,
    );

    expect(runSpy).toHaveBeenCalledOnce();
    expect(host.createCliTraceSession).toHaveBeenCalledWith(
      expect.objectContaining({
        cliArgs: ['acp', '--dangerously-skip-permissions'],
        cwd: '/workspace',
      }),
    );
    expect(session.agentSessionId).toBe('agy-acp-2');
    expect(session.modelSource).toBe('antigravity-acp');
    expect(session.antigravityAcpSession).toBeUndefined();
    expect(host.broadcast).toHaveBeenCalledWith('heteroAgentSessionComplete', {
      sessionId: 'desktop-sess-1',
    });
  });

  it('maps missing Antigravity ACP sessions to ResumeThreadNotFound and manages cancellation', async () => {
    const interrupt = vi.fn();
    const close = vi.fn();
    const session: AgentSession = {
      agentType: 'antigravity',
      antigravityAcpSession: { close, interrupt } as never,
      args: [],
      command: 'agy',
      cwd: '/workspace',
      resumeSessionId: 'stale-conv',
      sessionId: 'desktop-sess-2',
    };

    const error = new AcpRpcResponseError('session/resume', {
      code: -32_603,
      message: 'Failed to read session stale-conv; retry, or load it with session/load',
    });
    expect(getAcpResumeError(error, session)).toMatchObject({
      agentType: 'antigravity',
      code: HeterogeneousAgentSessionErrorCode.ResumeThreadNotFound,
      resumeSessionId: 'stale-conv',
    });

    expect(await interruptActiveAcpSession(session)).toBe(true);
    expect(interrupt).toHaveBeenCalledOnce();

    closeActiveAcpSessions(session);
    expect(close).toHaveBeenCalledOnce();
    expect(session.cancelledByUs).toBe(true);
  });
});
