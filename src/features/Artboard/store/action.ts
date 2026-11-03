import type { AcceptanceFlowReview } from '@lobechat/types';
import { toast } from '@lobehub/ui';
import { t } from 'i18next';

import type { StoreSetter } from '@/store/types';
import { setNamespace } from '@/utils/storeDebug';

import {
  type BoardToolCall,
  openBoardPanel,
  postAgentMessage,
  postUserMessage,
  startAgentReply,
} from '../Conversation/messages';
import { BUILD_RUN, checkByNode, nodeState, reviewNode } from '../fixture/acceptanceFlow';
import { ALL_ITEM_IDS, frameById, JOURNEY_GROUP, noteById, PENDING_NOTES } from '../fixture/board';
import {
  ACCEPTANCE_CARD,
  AGENT_LINES,
  AGENT_REPLIES,
  BOARD_CARD,
  OPENING_USER,
  REVIEW_LINES,
  USER_LINES,
} from '../fixture/conversation';
import { targetName } from '../targetName';
import type { BoardMode, BoardPreviewState, CameraTarget, VerifyView } from '../types';
import { type ArtboardState, initialState } from './initialState';
import { useArtboardStore } from './store';

const n = setNamespace('artboard');

type Setter = StoreSetter<ArtboardState>;
type CameraRequest = { kind: 'all' } | { id: string; kind: 'frame' | 'group' };

export class ArtboardActionImpl {
  readonly #get: () => ArtboardState;
  readonly #set: Setter;
  #cameraSeq = 0;
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

  #user = (text: string, quote?: string | null) => {
    if (quote)
      this.#set(
        (s) => ({ comments: { ...s.comments, [quote]: (s.comments[quote] ?? 0) + 1 } }),
        false,
        n('comment'),
      );
    const re = quote
      ? `> ${t('artboard.chat.quote', { ns: 'project', target: targetName(quote) })}\n\n`
      : '';
    postUserMessage(`${re}${text}`);
  };

  #agent = (text: string, card?: BoardToolCall) => {
    const toolMessageId = postAgentMessage(text, card);
    if (toolMessageId) openBoardPanel(toolMessageId);
  };

  #reply = (ms: number, fn: () => string) => {
    const finish = startAgentReply();
    this.#set({ typing: true }, false, n('replyStart'));
    this.#later(ms, () => {
      this.#set({ typing: false }, false, n('replyDone'));
      finish(fn());
    });
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
      narrow ? { outlineOpen: false, verifyOpen: false } : { verifyOpen: true },
      false,
      n('narrow'),
    );
  };

  setVerifyOpen = (verifyOpen: boolean) => this.#set({ verifyOpen }, false, n('setVerifyOpen'));

  setOutlineOpen = (outlineOpen: boolean) => this.#set({ outlineOpen }, false, n('outline'));

  setShowReal = (showReal: boolean) => this.#set({ showReal }, false, n('setShowReal'));

  setVerifyView = (verifyView: VerifyView) => {
    this.#set({ verifyView }, false, n('setVerifyView'));
    if (verifyView === 'board') this.focus({ id: JOURNEY_GROUP, kind: 'group' });
  };

  setPreviewState = (previewState: BoardPreviewState) => {
    this.#set({ previewState, selected: null }, false, n('setPreviewState'));
    if (previewState === 'generating') this.focus({ id: 'g2', kind: 'group' });
  };

  select = (id: string | null) => {
    this.#set({ selected: id }, false, n('select'));
    if (id && this.#get().mode === 'verify' && checkByNode[id]) this.setVerifyOpen(true);
  };

  openSticky = (id: string) => this.#set({ selected: id }, false, n('openSticky'));

  resolve = (id: string, text: string) => {
    const resolved = { ...this.#get().resolved, [id]: text };
    const left = PENDING_NOTES.filter((note) => !resolved[note.id]).length;
    this.#set({ resolved }, false, n('resolve'));
    this.#user(t('artboard.chat.decided', { ns: 'project', text }), id);
    this.#agent(AGENT_REPLIES.resolved(noteById[id].text, left));
  };

  send = (text: string) => {
    const { phase, resolved, revs, selected: quote } = this.#get();
    const finalized = phase === 'finalized';
    this.#user(text, quote);
    const note = quote ? noteById[quote] : undefined;
    const frame = quote ? frameById[quote] : undefined;

    if (note?.pending && !resolved[note.id]) {
      this.#reply(1000, () => {
        this.#set((s) => ({ resolved: { ...s.resolved, [note.id]: text } }), false, n('resolve'));
        return AGENT_REPLIES.decidedInChat(text);
      });
      return;
    }
    if (frame && finalized && frame.group === JOURNEY_GROUP) {
      this.#reply(1200, () => AGENT_REPLIES.lockedChange(frame.id));
      return;
    }
    if (frame) {
      const next = (revs[frame.id] ?? 1) + 1;
      this.#set((s) => ({ busy: [...s.busy, frame.id] }), false, n('busy'));
      this.#reply(2600, () => {
        this.#set(
          (s) => ({
            busy: s.busy.filter((x) => x !== frame.id),
            flash: frame.id,
            revs: { ...s.revs, [frame.id]: next },
          }),
          false,
          n('revise'),
        );
        this.focus({ id: frame.id, kind: 'frame' });
        this.#later(1700, () => this.#set({ flash: null }, false, n('flashDone')));
        return AGENT_REPLIES.revised(frame.id, next);
      });
      return;
    }
    this.#reply(1200, () => AGENT_LINES.generic);
  };

  replay = () => {
    this.#clearTimers();
    this.#set(
      {
        ...initialState,
        outlineOpen: this.#get().outlineOpen,
        verifyOpen: false,
        visible: [],
      },
      false,
      n('replay'),
    );
    this.#user(OPENING_USER);
    const opening = startAgentReply();
    this.#later(1000, () => {
      const toolMessageId = opening(AGENT_LINES.boardOpen, BOARD_CARD);
      if (toolMessageId) openBoardPanel(toolMessageId);
      this.#show(['n-title', 'n-goal']);
      this.focus({ kind: 'all' });
    });
    this.#later(1500, () => this.focus({ id: JOURNEY_GROUP, kind: 'group' }));
    ['j-1', 'j-2', 'j-3', 'j-4', 'j-5'].forEach((id, i) => this.#draw(id, 1800 + i * 650));
    this.#later(5300, () => this.focus({ id: 'g2', kind: 'group' }));
    ['o-a', 'o-b', 'o-c'].forEach((id, i) => this.#draw(id, 5800 + i * 650));
    this.#later(7900, () => this.#show(['s-1']));
    this.#later(8600, () => this.#user(USER_LINES.refs));
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
      this.#set({ agentAt: null, visible: ALL_ITEM_IDS }, false, n('replayDone'));
      this.#agent(AGENT_LINES.boardDone);
      this.focus({ kind: 'all' });
    });
  };

  finalize = () => {
    this.#set({ phase: 'finalized', run: null, selected: null }, false, n('finalize'));
    this.#user(USER_LINES.finalize);
    this.#agent(AGENT_LINES.finalized, ACCEPTANCE_CARD);
    toast.success(t('artboard.finalize.success', { ns: 'project' }));
    this.focus({ id: JOURNEY_GROUP, kind: 'group' });
  };

  setMode = (mode: BoardMode) => {
    this.#set({ mode, selected: null }, false, n('setMode'));
    if (mode === 'verify') {
      this.#set({ outlineOpen: false, verifyOpen: !this.#narrow }, false, n('verifyEnter'));
      this.focus({ id: JOURNEY_GROUP, kind: 'group' });
    } else {
      this.focus({ kind: 'all' });
    }
  };

  fillResults = () => {
    this.#user(USER_LINES.buildDone);
    this.#reply(1600, () => {
      this.#set({ run: BUILD_RUN, showReal: true }, false, n('fillDone'));
      this.focus({ id: JOURNEY_GROUP, kind: 'group' });
      return AGENT_LINES.filled;
    });
  };

  review = (frameId: string, review: AcceptanceFlowReview) => {
    const check = checkByNode[frameId];
    this.#set(
      (s) => (s.run ? { run: reviewNode(s.run, frameId, review) } : {}),
      false,
      n('review'),
    );
    if (review === 'accepted') {
      toast.success(t('artboard.verify.accepted', { id: check.id, ns: 'project' }));
      return;
    }
    const failed = nodeState(this.#get().run, frameId) === 'failed';
    this.#user(failed ? REVIEW_LINES.rejectFailed : REVIEW_LINES.recheck, frameId);
    this.#agent(AGENT_REPLIES.rejected(check.id));
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
