import type { FlowRun } from '../fixture/acceptanceFlow';
import { ALL_ITEM_IDS } from '../fixture/board';
import type {
  BoardMode,
  BoardPhase,
  BoardPreviewState,
  CameraTarget,
  PlayState,
  VerifyView,
} from '../types';

export interface ArtboardState {
  agentAt: string | null;
  busy: string[];
  camera: CameraTarget | null;
  comments: Record<string, number>;
  drawing: string[];
  flash: string | null;
  mode: BoardMode;
  outlineOpen: boolean;
  phase: BoardPhase;
  play: PlayState | null;
  previewState: BoardPreviewState;
  resolved: Record<string, string>;
  revs: Record<string, number>;
  run: FlowRun | null;
  selected: string | null;
  showReal: boolean;
  typing: boolean;
  verifyOpen: boolean;
  verifyView: VerifyView;
  visible: string[];
}

export const initialState: ArtboardState = {
  agentAt: null,
  busy: [],
  camera: null,
  comments: {},
  drawing: [],
  flash: null,
  mode: 'discuss',
  outlineOpen: false,
  phase: 'discuss',
  play: null,
  previewState: 'normal',
  resolved: {},
  revs: {},
  run: null,
  selected: null,
  showReal: false,
  typing: false,
  verifyOpen: true,
  verifyView: 'flow',
  visible: ALL_ITEM_IDS,
};
