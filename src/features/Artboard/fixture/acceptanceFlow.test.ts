import { describe, expect, it } from 'vitest';

import { buildFlowGraph } from '@/features/Acceptance/Viewer/Flow/flowGraph';

import {
  BUILD_RUN,
  JOURNEY_FLOW,
  JOURNEY_VERSION,
  nodeReview,
  nodeState,
  reviewNode,
} from './acceptanceFlow';
import { ARROWS } from './board';

describe('journey acceptance flow', () => {
  it('turns every journey arrow into an edge triggered by its label', () => {
    expect(JOURNEY_FLOW.entryNodeId).toBe('j-1');
    expect(
      JOURNEY_FLOW.edges.map((edge) => [edge.sourceNodeId, edge.targetNodeId, edge.trigger]),
    ).toEqual(ARROWS.map((arrow) => [arrow.from, arrow.to, arrow.label]));
  });

  it('plans one check item for the entry and one per incoming path', () => {
    const items = Object.fromEntries(
      JOURNEY_VERSION.nodes.map((node) => [node.id, node.checkItemIds.length]),
    );
    expect(items).toEqual({ 'j-1': 1, 'j-2': 2, 'j-3': 1, 'j-4': 2, 'j-5': 1 });
    expect(BUILD_RUN.attempts).toHaveLength(7);
  });

  it('colours the flow graph with the simulated build verdicts', () => {
    const graph = buildFlowGraph(
      [{ id: 'journey', run: BUILD_RUN, version: JOURNEY_VERSION }],
      new Set(),
      undefined,
      () => {},
      () => {},
    );
    const states = Object.fromEntries(
      graph.nodes.filter((node) => node.type === 'state').map((node) => [node.id, node.data.state]),
    );
    expect(states).toEqual({
      'journey/j-1': 'passed',
      'journey/j-2': 'failed',
      'journey/j-3': 'passed',
      'journey/j-4': 'blocked',
      'journey/j-5': 'passed',
    });
  });

  it('leaves every node pending before the build reports back', () => {
    expect(JOURNEY_FLOW.nodes.map((node) => nodeState(null, node.id))).toEqual(
      JOURNEY_FLOW.nodes.map(() => undefined),
    );
  });

  it('records a review on every path into the node', () => {
    const run = reviewNode(BUILD_RUN, 'j-2', 'rejected');
    expect(nodeReview(run, 'j-2')).toBe('rejected');
    expect(
      run.attempts.filter((a) => a.nodeId === 'j-2').every((a) => a.review === 'rejected'),
    ).toBe(true);
    expect(nodeReview(run, 'j-1')).toBeUndefined();
  });
});
