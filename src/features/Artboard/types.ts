export type ScreenKey =
  | 'OptionCards'
  | 'OptionChat'
  | 'OptionWizard'
  | 'RefCurrent'
  | 'RefSketch'
  | 'ScreenDone'
  | 'ScreenEmpty'
  | 'ScreenFailed'
  | 'ScreenReading'
  | 'ScreenSources';

export type ScreenAction = 'fail' | 'next' | 'retry' | 'skip';

export interface ScreenProps {
  onAction?: (action: ScreenAction) => void;
  playing?: boolean;
  real?: boolean;
  rev?: number;
}

export interface BoardFrame {
  group: string;
  id: string;
  image?: boolean;
  interactive?: boolean;
  recommended?: boolean;
  screen: ScreenKey;
  title: string;
  x: number;
  y: number;
}

export interface BoardGroup {
  desc: string;
  id: string;
  title: string;
}

export interface BoardArrow {
  d: string;
  from: string;
  label: string;
  lx: number;
  ly: number;
  to: string;
}

export interface BoardNote {
  id: string;
  kind: 'sticky' | 'subtitle' | 'title';
  pending?: boolean;
  suggest?: string;
  text: string;
  tone?: 'good';
  w?: number;
  x: number;
  y: number;
}

export type BoardPhase = 'discuss' | 'finalized';
export type BoardMode = 'discuss' | 'verify';
export type VerifyView = 'board' | 'flow';
export type BoardPreviewState = 'empty' | 'error' | 'generating' | 'normal';

export type CameraTarget =
  { kind: 'all'; seq: number } | { id: string; kind: 'frame' | 'group'; seq: number };

export interface PlayState {
  frame: string;
  mode: 'play' | 'view';
  nonce: number;
}
