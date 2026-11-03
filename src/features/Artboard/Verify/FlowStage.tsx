'use client';

import { cssVar } from '@lobehub/ui';
import * as stylex from '@stylexjs/stylex';
import { MarkerType, ReactFlowProvider } from '@xyflow/react';
import { useSize } from 'ahooks';
import { useRef, useState } from 'react';

import { FlowCanvas } from '@/features/Acceptance/Viewer/Flow/FlowCanvas';
import { buildFlowGraph } from '@/features/Acceptance/Viewer/Flow/flowGraph';
import { FlowGroup } from '@/features/Acceptance/Viewer/Flow/FlowGroup';
import { FlowNode } from '@/features/Acceptance/Viewer/Flow/FlowNode';

import { JOURNEY_VERSION } from '../fixture/acceptanceFlow';
import { artboardActions, useArtboardStore } from '../store';

const nodeTypes = { flowGroup: FlowGroup, state: FlowNode };
const VIEW_ID = JOURNEY_VERSION.id;
// The stage shares the row with the side panels, so the whole journey has to fit below the viewer's default zoom floor.
const wideFit = { maxZoom: 1, minZoom: 0.15, padding: 0.08 };
// Below this the whole journey only fits at an unreadable zoom, so the view opens on its start instead.
const NARROW_STAGE = 900;
const narrowFit = {
  ...wideFit,
  minZoom: 0.4,
  nodes: JOURNEY_VERSION.nodes.slice(0, 2).map((node) => ({ id: `${VIEW_ID}/${node.nodeKey}` })),
};

const styles = stylex.create({
  stage: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    paddingBlockEnd: 12,
    paddingBlockStart: 56,
    paddingInline: 12,
  },
});

const FlowStage = () => {
  const ref = useRef<HTMLDivElement>(null);
  const width = useSize(ref)?.width ?? 0;
  const { run, selected } = useArtboardStore((s) => ({ run: s.run, selected: s.selected }));
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const graph = buildFlowGraph(
    [{ id: VIEW_ID, run: run ?? undefined, version: JOURNEY_VERSION }],
    collapsed,
    selected ? `${VIEW_ID}/${selected}` : undefined,
    toggle,
    () => {},
  );
  // The journey is the only group, so there is nothing to drill into.
  const nodes = graph.nodes.map((node) =>
    node.type === 'flowGroup' ? { ...node, data: { ...node.data, onEnter: undefined } } : node,
  );
  const fitOptions = width > 0 && width < NARROW_STAGE ? narrowFit : wideFit;
  const edges = graph.edges.map((edge) => ({
    ...edge,
    markerEnd: { color: cssVar.colorTextQuaternary, height: 16, type: MarkerType.Arrow, width: 16 },
    style: { stroke: cssVar.colorTextQuaternary, strokeWidth: 1.5 },
  }));

  return (
    <div ref={ref} {...stylex.props(styles.stage)}>
      <ReactFlowProvider>
        <FlowCanvas
          fullscreen
          edges={edges}
          fitOptions={fitOptions}
          nodeTypes={nodeTypes}
          nodes={nodes}
          viewKey={`${VIEW_ID}:${Math.round(width)}`}
          onSelect={(id) => artboardActions.select(graph.checks.get(id)?.node.id ?? null)}
        />
      </ReactFlowProvider>
    </div>
  );
};

export default FlowStage;
