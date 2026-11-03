import { checkByFrame, frameById, JOURNEY_GROUP, PENDING_NOTES } from '../fixture/board';
import type { ArtboardState } from './initialState';

const commentCounts = (s: ArtboardState) => {
  const counts: Record<string, number> = {};
  for (const m of s.messages) {
    if (m.role === 'user' && m.quote) counts[m.quote] = (counts[m.quote] ?? 0) + 1;
  }
  return counts;
};

const pendingLeft = (s: ArtboardState) => PENDING_NOTES.filter((n) => !s.resolved[n.id]).length;

const resultCounts = (s: ArtboardState) => {
  const counts = { failed: 0, passed: 0, pending: 0 };
  for (const r of Object.values(s.results)) counts[r.status] += 1;
  return counts;
};

const isQuoteLocked = (s: ArtboardState) =>
  s.phase === 'finalized' && !!s.selected && frameById[s.selected]?.group === JOURNEY_GROUP;

const selectedCheckFrame = (s: ArtboardState) =>
  s.selected && checkByFrame[s.selected] ? s.selected : null;

export const artboardSelectors = {
  commentCounts,
  isQuoteLocked,
  pendingLeft,
  resultCounts,
  selectedCheckFrame,
};
