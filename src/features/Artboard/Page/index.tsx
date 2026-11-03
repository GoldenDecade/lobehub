'use client';

import { DraggablePanel, Flexbox } from '@lobehub/ui';
import { cssVar } from '@lobehub/ui/stylex/cssVar.stylex';
import * as stylex from '@stylexjs/stylex';
import { useSize } from 'ahooks';
import { type ReactNode, useEffect, useRef } from 'react';

import Canvas from '../Canvas';
import ChatPanel from '../Chat';
import PlayOverlay from '../Play';
import { artboardActions, useArtboardStore } from '../store';
import VerifyPanel from '../Verify';
import Header from './Header';
import Outline from './Outline';
import { GeneratingBar, PreviewStateBar, VerifyBar } from './StageBars';
import { BoardEmpty, BoardError } from './States';

const NARROW_WIDTH = 768;
const PREVIEW_BAR_MIN_STAGE = 640;

const styles = stylex.create({
  body: {
    display: 'flex',
    flex: '1',
    minHeight: 0,
    position: 'relative',
  },
  sheet: {
    backgroundColor: cssVar.colorBgContainer,
    inset: 0,
    position: 'absolute',
    zIndex: 20,
  },
  stage: {
    flex: '1',
    minWidth: 0,
    overflow: 'hidden',
    position: 'relative',
  },
});

const Stage = ({ narrow }: { narrow: boolean }) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const stageSize = useSize(stageRef);
  const showPreviewBar = !narrow && !!stageSize && stageSize.width >= PREVIEW_BAR_MIN_STAGE;
  const { mode, outlineOpen, previewState } = useArtboardStore((s) => ({
    mode: s.mode,
    outlineOpen: s.outlineOpen,
    previewState: s.previewState,
  }));

  if (previewState === 'empty' || previewState === 'error')
    return (
      <div ref={stageRef} {...stylex.props(styles.stage)}>
        {previewState === 'empty' ? <BoardEmpty /> : <BoardError />}
        {showPreviewBar && <PreviewStateBar />}
      </div>
    );

  return (
    <div ref={stageRef} {...stylex.props(styles.stage)}>
      <Canvas narrow={narrow} />
      {outlineOpen && !narrow && mode === 'discuss' && <Outline />}
      {mode === 'verify' && <VerifyBar />}
      {previewState === 'generating' && mode === 'discuss' && <GeneratingBar />}
      {showPreviewBar && <PreviewStateBar />}
    </div>
  );
};

const SidePanel = ({
  children,
  narrow,
  open,
  placement,
}: {
  children: ReactNode;
  narrow: boolean;
  open: boolean;
  placement: 'left' | 'right';
}) => {
  if (narrow) return open ? <div {...stylex.props(styles.sheet)}>{children}</div> : null;
  return (
    <DraggablePanel
      backgroundColor={cssVar.colorBgContainer}
      defaultSize={{ height: '100%', width: placement === 'left' ? 360 : 380 }}
      expand={open}
      expandable={false}
      maxWidth={560}
      minWidth={300}
      placement={placement}
    >
      {children}
    </DraggablePanel>
  );
};

const ArtboardPage = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const size = useSize(rootRef);
  const narrow = !!size && size.width < NARROW_WIDTH;
  const { chatOpen, mode, verifyOpen } = useArtboardStore((s) => ({
    chatOpen: s.chatOpen,
    mode: s.mode,
    verifyOpen: s.verifyOpen,
  }));

  useEffect(() => {
    if (size) artboardActions.setNarrow(narrow);
  }, [narrow, size]);

  useEffect(() => () => artboardActions.reset(), []);

  return (
    <Flexbox flex={1} height={'100%'} ref={rootRef} style={{ minWidth: 0 }}>
      <Header narrow={narrow} />
      <div {...stylex.props(styles.body)}>
        <SidePanel narrow={narrow} open={chatOpen} placement={'left'}>
          <ChatPanel onClose={narrow ? () => artboardActions.setChatOpen(false) : undefined} />
        </SidePanel>
        <Stage narrow={narrow} />
        {mode === 'verify' && (
          <SidePanel narrow={narrow} open={verifyOpen} placement={'right'}>
            <VerifyPanel
              onClose={narrow ? () => artboardActions.setVerifyOpen(false) : undefined}
            />
          </SidePanel>
        )}
      </div>
      <PlayOverlay />
    </Flexbox>
  );
};

export default ArtboardPage;
