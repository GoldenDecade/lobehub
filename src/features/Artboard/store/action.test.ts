import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { artboardActions } from './action';
import { useArtboardStore } from './store';

describe('artboardActions narrow layout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    artboardActions.reset();
    vi.useRealTimers();
  });

  it('closes the side panels again when a narrow board is revisited', () => {
    artboardActions.setNarrow(true);
    artboardActions.reset();
    expect(useArtboardStore.getState().chatOpen).toBe(true);

    artboardActions.setNarrow(true);

    expect(useArtboardStore.getState()).toMatchObject({ chatOpen: false, verifyOpen: false });
  });

  it('keeps the chat sheet closed during a narrow replay so the board stays visible', () => {
    artboardActions.setNarrow(true);

    artboardActions.replay();

    expect(useArtboardStore.getState().chatOpen).toBe(false);
  });

  it('opens the chat panel for a wide replay', () => {
    artboardActions.setNarrow(false);
    artboardActions.setChatOpen(false);

    artboardActions.replay();

    expect(useArtboardStore.getState().chatOpen).toBe(true);
  });
});
