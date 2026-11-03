export const ARTBOARD_TOOL = 'lobe-artboard';

export const BoardToolApiName = {
  acceptance: 'createAcceptance',
  board: 'openBoard',
} as const;

export type BoardToolApi = (typeof BoardToolApiName)[keyof typeof BoardToolApiName];

export interface BoardCardArgs {
  desc: string;
  title: string;
}
