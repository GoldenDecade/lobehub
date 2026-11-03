import * as stylex from '@stylexjs/stylex';
import { memo, useRef } from 'react';

import { sx } from '@/styles/sx';

import { FRAMES } from '../fixture/board';
import { artboardActions, useArtboardStore } from '../store';
import AgentCursor from './AgentCursor';
import Edges from './Edges';
import FrameNode from './FrameNode';
import Groups from './Groups';
import Notes from './Notes';
import { SelectionBar, ZoomBar } from './Overlays';
import { canvasStyles } from './styles';
import { useViewport } from './useViewport';

const VisibleFrames = ({ k }: { k: number }) => {
  const visible = useArtboardStore((s) => s.visible);
  return FRAMES.filter((f) => visible.includes(f.id)).map((f) => (
    <FrameNode frame={f} k={k} key={f.id} />
  ));
};

// Panning updates the view on every pointer move; only the world transform should follow it.
const Content = memo<{ k: number }>(({ k }) => (
  <>
    <Groups k={k} />
    <Notes />
    <Edges k={k} />
    <VisibleFrames k={k} />
    <AgentCursor k={k} />
  </>
));

Content.displayName = 'ArtboardCanvasContent';

const clearSelection = () => artboardActions.select(null);

const Canvas = ({ narrow }: { narrow: boolean }) => {
  const ref = useRef<HTMLDivElement>(null);
  const { fitAll, flying, handlers, panning, view, zoomBy } = useViewport(ref, clearSelection);

  return (
    <>
      <div
        ref={ref}
        {...stylex.props(canvasStyles.viewport, panning && canvasStyles.panning)}
        {...handlers}
      >
        <div
          {...sx([canvasStyles.world, flying && canvasStyles.worldFlying], undefined, {
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
          })}
        >
          <Content k={view.k} />
        </div>
      </div>
      {!narrow && <SelectionBar view={view} />}
      <ZoomBar k={view.k} onFit={fitAll} onZoom={zoomBy} />
    </>
  );
};

export default Canvas;
