import { describe, expect, it } from 'vitest';

import { lobeHubCliGuide, lobeHubCliGuideBlock } from './lobeHubCliGuide';
import { buildHeterogeneousPrompt, HeterogeneousPromptEngine } from './promptEngine';

describe('HeterogeneousPromptEngine', () => {
  it('orders system context, provider context, user prompt, and images', () => {
    expect(
      buildHeterogeneousPrompt({
        imageList: [{ id: 'image-1', url: 'https://example.com/image.png' }],
        prompt: '<refer_topic name="Previous" id="topic-ref" />\nSummarize it',
        systemContext: 'Workspace context',
      }),
    ).toEqual([
      { text: 'Workspace context', type: 'text' },
      {
        text: expect.stringContaining('`lh topic view <topic-id>`'),
        type: 'text',
      },
      {
        text: '<refer_topic name="Previous" id="topic-ref" />\nSummarize it',
        type: 'text',
      },
      {
        source: { id: 'image-1', type: 'url', url: 'https://example.com/image.png' },
        type: 'image',
      },
    ]);
  });

  it('does not add topic guidance to unrelated prompts', () => {
    expect(new HeterogeneousPromptEngine({ prompt: 'Hello' }).process()).toEqual([
      { text: 'Hello', type: 'text' },
    ]);
  });

  it('introduces the LobeHub CLI once, when the session is new', () => {
    const blocks = buildHeterogeneousPrompt({
      isNewSession: true,
      prompt: 'Draft a doc',
      systemContext: 'Workspace context',
    });

    expect(blocks).toEqual([
      { text: 'Workspace context', type: 'text' },
      lobeHubCliGuideBlock,
      { text: 'Draft a doc', type: 'text' },
    ]);
  });

  it('omits the LobeHub CLI introduction on a resumed session', () => {
    expect(buildHeterogeneousPrompt({ isNewSession: false, prompt: 'Draft a doc' })).toEqual([
      { text: 'Draft a doc', type: 'text' },
    ]);
  });

  it('tells a new session both how to reach the platform and how to read a referenced topic', () => {
    const blocks = buildHeterogeneousPrompt({
      isNewSession: true,
      prompt: '<refer_topic name="Previous" id="topic-ref" />\nSummarize it',
    });

    expect(blocks.map((block) => block.type === 'text' && block.text)).toEqual([
      lobeHubCliGuide,
      expect.stringContaining('`lh topic view <topic-id>`'),
      '<refer_topic name="Previous" id="topic-ref" />\nSummarize it',
    ]);
  });

  it('keeps a leading slash invocation ahead of the session guide', () => {
    const blocks = buildHeterogeneousPrompt({
      isNewSession: true,
      prompt: '/swarm split the work and report back',
      systemContext: 'Workspace context',
    });

    expect(blocks.map((block) => block.type === 'text' && block.text)).toEqual([
      '/swarm',
      'Workspace context',
      lobeHubCliGuide,
      'split the work and report back',
    ]);
  });

  it('hoists colon-namespaced plugin slash invocations ahead of session context', () => {
    const blocks = buildHeterogeneousPrompt({
      isNewSession: true,
      prompt: '/frontend-design:frontend-design build landing page',
      systemContext: 'Workspace context',
    });

    expect(blocks.map((block) => block.type === 'text' && block.text)).toEqual([
      '/frontend-design:frontend-design',
      'Workspace context',
      lobeHubCliGuide,
      'build landing page',
    ]);
  });

  it('leaves a slash that is not the first token where it is', () => {
    expect(
      buildHeterogeneousPrompt({ isNewSession: true, prompt: 'please /swarm this' }).at(-1),
    ).toEqual({ text: 'please /swarm this', type: 'text' });
  });

  it('recognizes markdown-escaped topic tags', () => {
    const blocks = buildHeterogeneousPrompt({
      prompt: '\\<refer\\_topic name="Previous" id="topic-ref" />',
    });

    expect(blocks[0]).toEqual({
      text: expect.stringContaining('`lh topic view <topic-id>`'),
      type: 'text',
    });
  });
});
