import type {
  AcceptanceFlowDefinition,
  AcceptanceFlowReview,
  AcceptanceFlowVerdict,
} from '@lobechat/types';

import type { FlowVersion } from '@/features/Acceptance/Viewer/Flow/flowNavigation';
import { getFlowNodeState } from '@/features/Acceptance/Viewer/Flow/flowNodeState';

import type { BoardArrow } from '../types';
import { ARROWS, frameById, GROUPS, JOURNEY_GROUP } from './board';

export type FlowRun = FlowVersion['runs'][number];
export type FlowNodeState = ReturnType<typeof getFlowNodeState>;
type FlowCheck = NonNullable<AcceptanceFlowDefinition['nodes'][number]['check']>;

const CHECKS = [
  { expected: '第一次进入项目，能看到「接入资料」入口', frame: 'j-1', id: 'c-1' },
  { expected: '可以同时选择代码仓库、文档、网页三种来源', frame: 'j-2', id: 'c-2' },
  { expected: '读取中显示进度和预计时间，离开页面不会中断', frame: 'j-3', id: 'c-3' },
  { expected: '读取失败时说明原因，可以重新上传或跳过', frame: 'j-5', id: 'c-4' },
  { expected: '读取完成后看到资料摘要和推荐的第一件事', frame: 'j-4', id: 'c-5' },
];

const edgeId = (arrow: BoardArrow) => `${arrow.from}>${arrow.to}`;

// Node ids are board frame ids: that is the back-reference from a check to its board item.
export const JOURNEY_FLOW: AcceptanceFlowDefinition = {
  edges: ARROWS.map((arrow) => ({
    id: edgeId(arrow),
    required: true,
    sourceNodeId: arrow.from,
    targetNodeId: arrow.to,
    trigger: arrow.label,
  })),
  entryNodeId: CHECKS[0].frame,
  nodes: CHECKS.map((check) => ({
    check: {
      definition: { expected: check.expected },
      id: check.id,
      title: frameById[check.frame].title,
    },
    id: check.frame,
  })),
  title: GROUPS.find((group) => group.id === JOURNEY_GROUP)!.title,
};

export const JOURNEY_CHECKS: (FlowCheck & { nodeId: string })[] = JOURNEY_FLOW.nodes.map(
  (node) => ({ ...node.check!, nodeId: node.id }),
);

export const checkByNode: Record<string, FlowCheck> = Object.fromEntries(
  JOURNEY_CHECKS.map((check) => [check.nodeId, check]),
);

const PLAN = JOURNEY_CHECKS.flatMap((check) => [
  ...(check.nodeId === JOURNEY_FLOW.entryNodeId
    ? [{ id: check.id, incomingEdgeId: null, nodeId: check.nodeId }]
    : []),
  ...JOURNEY_FLOW.edges
    .filter((edge) => edge.targetNodeId === check.nodeId)
    .map((edge) => ({
      id: `${check.id}:${edge.id}`,
      incomingEdgeId: edge.id,
      nodeId: check.nodeId,
    })),
]);

export const JOURNEY_VERSION: FlowVersion = {
  edges: JOURNEY_FLOW.edges.map((edge) => ({
    ...edge,
    condition: undefined,
    edgeKey: edge.id,
    sourceNodeKey: edge.sourceNodeId,
    targetNodeKey: edge.targetNodeId,
  })),
  entryNodeKey: JOURNEY_FLOW.entryNodeId,
  flowId: 'journey',
  id: 'journey',
  nodes: JOURNEY_CHECKS.map((check) => {
    const items = PLAN.filter((item) => item.nodeId === check.nodeId).map((item) => item.id);
    return {
      checkItemIds: items,
      criterionId: undefined,
      definition: check.definition,
      entryRequired: true,
      expected: check.definition.expected ?? '',
      id: check.nodeId,
      instruction: '',
      isEntry: check.nodeId === JOURNEY_FLOW.entryNodeId,
      nodeKey: check.nodeId,
      parentNodeId: undefined,
      requiredCheckItemIds: items,
      resourceSnapshot: undefined,
      subFlowId: undefined,
      title: check.title,
    };
  }),
  runs: [],
  title: JOURNEY_FLOW.title,
  version: 1,
};

const OUTCOMES: Record<string, { observation: string; verdict: AcceptanceFlowVerdict }> = {
  'j-1': { observation: '首屏能看到「接入资料」入口，和定稿一致。', verdict: 'passed' },
  'j-2': { observation: '按钮文案是「下一步」，定稿里是「开始读取」。', verdict: 'failed' },
  'j-3': { observation: '有进度和预计时间；离开页面再回来，进度还在。', verdict: 'passed' },
  'j-4': { observation: '读取完成页还没开发，走到这一步没有页面可截。', verdict: 'blocked' },
  'j-5': { observation: '失败原因写清楚了，重新上传和跳过都走得通。', verdict: 'passed' },
};

export const BUILD_RUN: FlowRun = {
  attempts: PLAN.map((item, index) => ({
    checkItemId: item.id,
    checkResultId: item.id,
    evidence: [],
    id: item.id,
    incomingEdgeId: item.incomingEdgeId,
    nodeId: item.nodeId,
    observation: OUTCOMES[item.nodeId].observation,
    review: null,
    reviewAttachments: [],
    reviewComment: null,
    reviewDetail: null,
    sequence: index + 1,
    verdict: OUTCOMES[item.nodeId].verdict,
  })),
  id: 'round-1',
  status: 'verifying',
  verifyRunId: 'round-1',
};

export const nodeAttempts = (run: FlowRun | null, nodeId: string) =>
  run?.attempts.filter((attempt) => attempt.nodeId === nodeId) ?? [];

export const nodeState = (run: FlowRun | null, nodeId: string): FlowNodeState =>
  getFlowNodeState(
    nodeId,
    JOURNEY_FLOW.entryNodeId,
    JOURNEY_VERSION.edges,
    nodeAttempts(run, nodeId),
  );

export const nodeReview = (run: FlowRun | null, nodeId: string) =>
  nodeAttempts(run, nodeId)[0]?.review ?? undefined;

export const reviewNode = (
  run: FlowRun,
  nodeId: string,
  review: AcceptanceFlowReview,
): FlowRun => ({
  ...run,
  attempts: run.attempts.map((attempt) =>
    attempt.nodeId === nodeId ? { ...attempt, review } : attempt,
  ),
});
