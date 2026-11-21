import { describe, expect, it } from 'vitest';

import { buildAntigravityArgs } from './antigravity';
import { buildAntigravityAcpPrompt } from './antigravityAcpSession';
import { buildAgentInput } from './input/buildAgentInput';

describe('Antigravity process input', () => {
  it('directs callers away from legacy buildAgentInput to the native ACP session', async () => {
    await expect(buildAgentInput('antigravity', 'hello')).rejects.toThrow(
      'antigravity runs over the ACP transport only',
    );
  });

  it('normalizes multimodal prompts into ACP text + base64 image blocks', async () => {
    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const blocks = await buildAntigravityAcpPrompt([
      { text: '你看下这个对话的内容', type: 'text' },
      { source: { data: pngBase64, mediaType: 'image/png', type: 'base64' }, type: 'image' },
    ]);
    expect(blocks).toEqual([
      { text: '你看下这个对话的内容', type: 'text' },
      { data: pngBase64, mimeType: 'image/png', type: 'image' },
    ]);
  });

  it('retains legacy stream-json arg builder helper for backward compatibility', () => {
    expect(
      buildAntigravityArgs({
        extraArgs: ['--model', 'custom-model', '--effort', 'high'],
        resumeSessionId: 'conv-1',
      }),
    ).toEqual([
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--dangerously-skip-permissions',
      '--settings',
      '{"agentMode":"","allowNonWorkspaceAccess":true,"enableTerminalSandbox":false}',
      '--conversation',
      'conv-1',
      '--model',
      'custom-model',
      '--effort',
      'high',
    ]);
  });
});
