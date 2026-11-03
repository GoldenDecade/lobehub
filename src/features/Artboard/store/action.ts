import { toast } from '@lobehub/ui';
import { t } from 'i18next';

import type { StoreSetter } from '@/store/types';
import { setNamespace } from '@/utils/storeDebug';

import {
  ALL_ITEM_IDS,
  checkByFrame,
  frameById,
  JOURNEY_GROUP,
  noteById,
  PENDING_NOTES,
} from '../fixture/board';
import {
  ACCEPTANCE_CARD,
  AGENT_LINES,
  AGENT_REPLIES,
  BOARD_CARD,
  FILLED_RESULTS,
  OPENING_USER,
  PENDING_RESULTS,
  REVIEW_LINES,
} from '../fixture/conversation';
import type {
  BoardMode,
  BoardPreviewState,
  CameraTarget,
  ChatMessage,
  ReviewVerdict,
} from '../types';
import { type ArtboardState, initialState } from './initialState';
import { useArtboardStore } from './store';

const n = setNamespace('artboard');

type Setter = StoreSetter<ArtboardState>;
type CameraRequest = { kind: 'all' } | { id: string; kind: 'frame' | 'group' };

export class ArtboardActionImpl {
  readonly #get: () => ArtboardState;
  readonly #set: Setter;
  #cameraSeq = 0;
  #messageSeq = 0;
  #narrow = false;
  #timers: ReturnType<typeof setTimeout>[] = [];

  constructor(set: Setter, get: () => ArtboardState) {
    this.#set = set;
    this.#get = get;
  }

  #later = (ms: number, fn: () => void) => {
    this.#timers.push(setTimeout(fn, ms));
  };

  #clearTimers = () => {
    this.#timers.forEach(clearTimeout);
    this.#timers = [];
  };

  #push = (message: Omit<ChatMessage, 'id'>) => {
    this.#messageSeq += 1;
    const id = `m-${this.#messageSeq}`;
    this.#set((s) => ({ messages: [...s.messages, { ...message, id }] }), false, n('push'));
  };

  #show = (ids: string[]) => {
    this.#set((s) => ({ visible: [...new Set([...s.visible, ...ids])] }), false, n('show'));
  };

  #draw = (id: string, at: number) => {
    this.#later(at, () => {
      this.#show([id]);
      this.#set((s) => ({ agentAt: id, drawing: [...s.drawing, id] }), false, n('draw'));
    });
    this.#later(at + 650, () =>
      this.#set((s) => ({ drawing: s.drawing.filter((x) => x !== id) }), false, n('drawDone')),
    );
  };

  focus = (request: CameraRequest) => {
    this.#cameraSeq += 1;
    this.#set({ camera: { ...request, seq: this.#cameraSeq } as CameraTarget }, false, n('focus'));
  };

  focusItem = (id: string) => {
    this.#set({ selected: id }, false, n('focusItem'));
    this.focus({ id, kind: 'frame' });
  };

  setNarrow = (narrow: boolean) => {
    if (narrow === this.#narrow) return;
    this.#narrow = narrow;
    this.#set(
      narrow
        ? { chatOpen: false, outlineOpen: false, verifyOpen: false }
        : { chatOpen: true, verifyOpen: true },
      false,
      n('narrow'),
    );
  };

  setChatOpen = (open: boolean) => {
    this.#set(
      open && this.#narrow ? { chatOpen: true, verifyOpen: false } : { chatOpen: open },
      false,
      n('setChatOpen'),
    );
  };

  setVerifyOpen = (open: boolean) => {
    this.#set(
      open && this.#narrow ? { chatOpen: false, verifyOpen: true } : { verifyOpen: open },
      false,
      n('setVerifyOpen'),
    );
  };

  setOutlineOpen = (outlineOpen: boolean) => this.#set({ outlineOpen }, false, n('outline'));

  setShowReal = (showReal: boolean) => this.#set({ showReal }, false, n('setShowReal'));

  setPreviewState = (previewState: BoardPreviewState) => {
    this.#set({ previewState, selected: null }, false, n('setPreviewState'));
    if (previewState === 'generating') this.focus({ id: 'g2', kind: 'group' });
  };

  select = (id: string | null) => {
    this.#set({ selected: id }, false, n('select'));
    if (id && this.#get().mode === 'verify' && checkByFrame[id]) this.setVerifyOpen(true);
  };

  openSticky = (id: string) => this.#set({ selected: id }, false, n('openSticky'));

  resolve = (id: string, text: string) => {
    const resolved = { ...this.#get().resolved, [id]: text };
    const left = PENDING_NOTES.filter((note) => !resolved[note.id]).length;
    this.#set({ resolved }, false, n('resolve'));
    this.#push({
      quote: id,
      role: 'user',
      text: t('artboard.chat.decided', { ns: 'project', text }),
    });
    this.#push({ role: 'agent', text: AGENT_REPLIES.resolved(noteById[id].text, left) });
  };

  send = (text: string) => {
    const { phase, resolved, revs, selected: quote } = this.#get();
    const finalized = phase === 'finalized';
    this.#push({ quote, role: 'user', text });
    this.#set({ typing: true }, false, n('sendStart'));
    const done = (reply: string) => {
      this.#set({ typing: false }, false, n('sendDone'));
      this.#push({ role: 'agent', text: reply });
    };
    const note = quote ? noteById[quote] : undefined;
    const frame = quote ? frameById[quote] : undefined;

    if (note?.pending && !resolved[note.id]) {
      this.#later(1000, () => {
        this.#set((s) => ({ resolved: { ...s.resolved, [note.id]: text } }), false, n('resolve'));
        done(AGENT_REPLIES.decidedInChat(text));
      });
      return;
    }
    if (frame && finalized && frame.group === JOURNEY_GROUP) {
      this.#later(1200, () => done(AGENT_REPLIES.lockedChange(frame.id)));
      return;
    }
    if (frame) {
      const next = (revs[frame.id] ?? 1) + 1;
      this.#set((s) => ({ busy: [...s.busy, frame.id] }), false, n('busy'));
      this.#later(2600, () => {
        this.#set(
          (s) => ({
            busy: s.busy.filter((x) => x !== frame.id),
            flash: frame.id,
            revs: { ...s.revs, [frame.id]: next },
          }),
          false,
          n('revise'),
        );
        done(AGENT_REPLIES.revised(frame.id, next));
        this.focus({ id: frame.id, kind: 'frame' });
        this.#later(1700, () => this.#set({ flash: null }, false, n('flashDone')));
      });
      return;
    }
    this.#later(1200, () => done(AGENT_LINES.generic));
  };

  replay = () => {
    this.#clearTimers();
    this.#set(
      {
        ...initialState,
        chatOpen: !this.#narrow,
        messages: [{ ...OPENING_USER, id: 'opening' }],
        outlineOpen: this.#get().outlineOpen,
        replayed: true,
        revs: {},
        typing: true,
        verifyOpen: false,
        visible: [],
      },
      false,
      n('replay'),
    );
    this.#later(1000, () => {
      this.#push({ role: 'agent', text: AGENT_LINES.boardOpen });
      this.#show(['n-title', 'n-goal']);
      this.focus({ kind: 'all' });
    });
    this.#later(1500, () => this.focus({ id: JOURNEY_GROUP, kind: 'group' }));
    ['j-1', 'j-2', 'j-3', 'j-4', 'j-5'].forEach((id, i) => this.#draw(id, 1800 + i * 650));
    this.#later(5300, () => {
      this.#push({ role: 'agent', text: AGENT_LINES.options });
      this.focus({ id: 'g2', kind: 'group' });
    });
    ['o-a', 'o-b', 'o-c'].forEach((id, i) => this.#draw(id, 5800 + i * 650));
    this.#later(7900, () => this.#show(['s-1']));
    this.#later(8600, () => this.#push({ role: 'user', text: AGENT_LINES.userRefs }));
    this.#later(9200, () => this.focus({ id: 'g3', kind: 'group' }));
    ['r-1', 'r-2'].forEach((id, i) =>
      this.#later(9500 + i * 400, () => {
        this.#show([id]);
        this.#set({ agentAt: id }, false, n('cursor'));
      }),
    );
    this.#later(10_500, () => {
      this.#show(['s-2', 's-3']);
      this.#set({ agentAt: 's-2' }, false, n('cursor'));
    });
    this.#later(11_400, () => {
      this.#set({ agentAt: null, typing: false, visible: ALL_ITEM_IDS }, false, n('replayDone'));
      this.#push({ card: BOARD_CARD, role: 'agent', text: AGENT_LINES.boardDone });
      this.focus({ kind: 'all' });
    });
  };

  finalize = () => {
    this.#set(
      { phase: 'finalized', results: PENDING_RESULTS, selected: null },
      false,
      n('finalize'),
    );
    this.#push({ card: ACCEPTANCE_CARD, role: 'agent', text: AGENT_LINES.finalized });
    toast.success(t('artboard.finalize.success', { ns: 'project' }));
    this.focus({ id: JOURNEY_GROUP, kind: 'group' });
  };

  setMode = (mode: BoardMode) => {
    this.#set({ mode, selected: null }, false, n('setMode'));
    if (mode === 'verify') {
      this.#set({ outlineOpen: false }, false, n('verifyEnter'));
      this.setVerifyOpen(true);
      this.focus({ id: JOURNEY_GROUP, kind: 'group' });
    } else this.focus({ kind: 'all' });
  };

  fillResults = () => {
    this.#set({ typing: true }, false, n('fillStart'));
    this.#later(1600, () => {
      this.#set(
        { filled: true, results: FILLED_RESULTS, showReal: true, typing: false },
        false,
        n('fillDone'),
      );
      this.#push({ role: 'agent', text: AGENT_LINES.filled });
      this.focus({ id: JOURNEY_GROUP, kind: 'group' });
    });
  };

  review = (frameId: string, verdict: ReviewVerdict) => {
    const check = checkByFrame[frameId];
    this.#set((s) => ({ reviews: { ...s.reviews, [frameId]: verdict } }), false, n('review'));
    if (verdict === 'accept') {
      toast.success(t('artboard.verify.accepted', { id: check.id, ns: 'project' }));
      return;
    }
    const failed = this.#get().results[frameId]?.status === 'failed';
    this.#push({
      quote: frameId,
      role: 'user',
      text: failed ? REVIEW_LINES.rejectFailed : REVIEW_LINES.recheck,
    });
    this.#push({ role: 'agent', text: AGENT_REPLIES.rejected(check.id) });
    toast.info(t('artboard.verify.rejected', { id: check.id, ns: 'project' }));
  };

  openPlay = (frame: string, mode: 'play' | 'view') =>
    this.#set({ play: { frame, mode, nonce: 0 } }, false, n('openPlay'));

  stepPlay = (frame: string) =>
    this.#set(
      (s) => (s.play ? { play: { ...s.play, frame, nonce: s.play.nonce + 1 } } : {}),
      false,
      n('stepPlay'),
    );

  closePlay = () => {
    const last = this.#get().play?.frame;
    this.#set({ play: null }, false, n('closePlay'));
    if (last) this.focusItem(last);
  };

  reset = () => {
    this.#clearTimers();
    this.#narrow = false;
    this.#set({ ...initialState }, false, n('reset'));
  };
}

const { getState, setState } = useArtboardStore;

export const artboardActions = new ArtboardActionImpl(setState, getState);
