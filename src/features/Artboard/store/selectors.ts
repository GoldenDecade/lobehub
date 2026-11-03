import { checkByNode, JOURNEY_FLOW, nodeReview, nodeState } from '../fixture/acceptanceFlow';
import { frameById, JOURNEY_GROUP, PENDING_NOTES } from '../fixture/board';
import type { ArtboardState } from './initialState';

const pendingLeft = (s: ArtboardState) => PENDING_NOTES.filter((n) => !s.resolved[n.id]).length;

const resultCounts = (s: ArtboardState) => {
  const counts = { blocked: 0, failed: 0, passed: 0, pending: 0 };
  for (const node of JOURNEY_FLOW.nodes) {
    const state = nodeState(s.run, node.id);
    if (state === 'passed' || state === 'failed') counts[state] += 1;
    else if (state) counts.blocked += 1;
    else counts.pending += 1;
  }
  return counts;
};

const stateOf = (id: string) => (s: ArtboardState) =>
  checkByNode[id] ? nodeState(s.run, id) : undefined;

const reviewOf = (id: string) => (s: ArtboardState) => nodeReview(s.run, id);

const isQuoteLocked = (s: ArtboardState) =>
  s.phase === 'finalized' && !!s.selected && frameById[s.selected]?.group === JOURNEY_GROUP;

const selectedCheckFrame = (s: ArtboardState) =>
  s.selected && checkByNode[s.selected] ? s.selected : null;

export const artboardSelectors = {
  isQuoteLocked,
  pendingLeft,
  resultCounts,
  reviewOf,
  selectedCheckFrame,
  stateOf,
};
