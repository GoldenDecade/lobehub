import { ALL_ITEM_IDS } from '../fixture/board';
import { PENDING_RESULTS, SEED_MESSAGES, SEED_REVS } from '../fixture/conversation';
import type {
  BoardMode,
  BoardPhase,
  BoardPreviewState,
  CameraTarget,
  ChatMessage,
  CheckResult,
  PlayState,
  ReviewVerdict,
} from '../types';

export interface ArtboardState {
  agentAt: string | null;
  busy: string[];
  camera: CameraTarget | null;
  chatOpen: boolean;
  drawing: string[];
  filled: boolean;
  flash: string | null;
  messages: ChatMessage[];
  mode: BoardMode;
  outlineOpen: boolean;
  phase: BoardPhase;
  play: PlayState | null;
  previewState: BoardPreviewState;
  replayed: boolean;
  resolved: Record<string, string>;
  results: Record<string, CheckResult>;
  reviews: Record<string, ReviewVerdict>;
  revs: Record<string, number>;
  selected: string | null;
  showReal: boolean;
  typing: boolean;
  verifyOpen: boolean;
  visible: string[];
}

export const initialState: ArtboardState = {
  agentAt: null,
  busy: [],
  camera: null,
  chatOpen: true,
  drawing: [],
  filled: false,
  flash: null,
  messages: SEED_MESSAGES,
  mode: 'discuss',
  outlineOpen: false,
  phase: 'discuss',
  play: null,
  previewState: 'normal',
  replayed: false,
  resolved: {},
  results: PENDING_RESULTS,
  revs: SEED_REVS,
  reviews: {},
  selected: null,
  showReal: false,
  typing: false,
  verifyOpen: true,
  visible: ALL_ITEM_IDS,
};
