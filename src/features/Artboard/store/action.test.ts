import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BOARD_CARD, OPENING_USER } from '../fixture/conversation';
import { artboardActions } from './action';
import { useArtboardStore } from './store';

const conversation = vi.hoisted(() => {
  const finish = vi.fn((_content: string, tool?: unknown) => (tool ? 'tool-msg' : undefined));
  return {
    finish,
    openBoardPanel: vi.fn(),
    postAgentMessage: vi.fn((content: string, tool?: unknown) => finish(content, tool)),
    postUserMessage: vi.fn(),
    startAgentReply: vi.fn(() => finish),
  };
});

vi.mock('../Conversation/messages', () => conversation);

describe('artboardActions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    artboardActions.reset();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('closes the side panels again when a narrow board is revisited', () => {
    artboardActions.setNarrow(true);
    artboardActions.reset();
    expect(useArtboardStore.getState().verifyOpen).toBe(true);

    artboardActions.setNarrow(true);

    expect(useArtboardStore.getState()).toMatchObject({ outlineOpen: false, verifyOpen: false });
  });

  it('plays the opening into the conversation and opens the board from its card', () => {
    artboardActions.replay();

    expect(conversation.postUserMessage).toHaveBeenCalledWith(OPENING_USER);
    expect(conversation.startAgentReply).toHaveBeenCalledTimes(1);
    expect(conversation.finish).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);

    expect(conversation.finish).toHaveBeenCalledWith(expect.any(String), BOARD_CARD);
    expect(conversation.openBoardPanel).toHaveBeenCalledWith('tool-msg');
  });

  it('posts a frame comment with its quote and revises the frame when the reply lands', () => {
    artboardActions.select('j-3');

    artboardActions.send('读取要多久？');

    expect(conversation.postUserMessage).toHaveBeenCalledWith(
      expect.stringMatching(/^> .+\n\n读取要多久？$/),
    );
    expect(useArtboardStore.getState()).toMatchObject({
      busy: ['j-3'],
      comments: { 'j-3': 1 },
      typing: true,
    });

    vi.advanceTimersByTime(2600);

    expect(conversation.finish).toHaveBeenCalledWith(expect.stringContaining('j-3'));
    expect(useArtboardStore.getState()).toMatchObject({
      busy: [],
      revs: { 'j-3': 2 },
      typing: false,
    });
  });

  it('opens the acceptance panel beside a wide board on Accept', () => {
    artboardActions.setNarrow(false);
    artboardActions.setVerifyOpen(false);

    artboardActions.setMode('verify');

    expect(useArtboardStore.getState()).toMatchObject({ mode: 'verify', verifyOpen: true });
  });

  it('keeps the acceptance sheet closed on a narrow board so the flow stays visible', () => {
    artboardActions.setNarrow(true);

    artboardActions.setMode('verify');

    expect(useArtboardStore.getState()).toMatchObject({ mode: 'verify', verifyOpen: false });
  });
});
