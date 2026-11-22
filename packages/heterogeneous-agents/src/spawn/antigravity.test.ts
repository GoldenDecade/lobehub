import { describe, expect, it } from 'vitest';

import { buildAntigravityArgs } from './antigravity';
import { buildAntigravityAcpPrompt } from './antigravityAcpSession';

describe('Antigravity process input', () => {
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
    expect(buildAntigravityArgs({})).toContain('--dangerously-skip-permissions');
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
  ])('rejects custom %s that breaks protocol or session ownership', (flag) => {
    expect(() => buildAntigravityArgs({ extraArgs: [flag] })).toThrow('LobeHub manages');
  });
});
