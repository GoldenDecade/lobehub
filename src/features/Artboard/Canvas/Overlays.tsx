import { ActionIcon, Flexbox, Text } from '@lobehub/ui';
import { cssVar } from '@lobehub/ui/stylex/cssVar.stylex';
import * as stylex from '@stylexjs/stylex';
import {
  Maximize2Icon,
  MessageSquareIcon,
  PlayIcon,
  ScanIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { sx } from '@/styles/sx';

import { focusChatInput } from '../Chat/focusChatInput';
import { FRAME_W, frameById } from '../fixture/board';
import { artboardActions, useArtboardStore } from '../store';
import type { ViewState } from './useViewport';

export const floatStyles = stylex.create({
  float: {
    backgroundColor: cssVar.colorBgContainer,
    borderColor: cssVar.colorBorderSecondary,
    borderRadius: cssVar.borderRadiusLG,
    borderStyle: 'solid',
    borderWidth: 1,
    boxShadow: '0 4px 16px rgb(0 0 0 / 6%)',
    padding: 4,
    position: 'absolute',
    zIndex: 5,
  },
  selectionBar: {
    transform: 'translate(-100%, calc(-100% - 36px))',
    zIndex: 6,
  },
});

export const SelectionBar = ({ view }: { view: ViewState }) => {
  const { t } = useTranslation('project');
  const frame = useArtboardStore((s) => {
    if (s.mode !== 'discuss' || !s.selected || !s.visible.includes(s.selected)) return;
    return frameById[s.selected];
  });
  if (!frame) return null;

  return (
    <Flexbox
      horizontal
      gap={2}

      {...sx([floatStyles.float, floatStyles.selectionBar], undefined, {
        left: (frame.x + FRAME_W) * view.k + view.x,
        top: frame.y * view.k + view.y,
      })}
    >
      <ActionIcon
        icon={Maximize2Icon}
        size={'small'}
        title={t('artboard.selection.view')}
        onClick={() => artboardActions.openPlay(frame.id, 'view')}
      />
      {frame.interactive && (
        <ActionIcon
          icon={PlayIcon}
          size={'small'}
          title={t('artboard.selection.play')}
          onClick={() => artboardActions.openPlay(frame.id, 'play')}
        />
      )}
      <ActionIcon
        icon={MessageSquareIcon}
        size={'small'}
        title={t('artboard.selection.discuss')}
        onClick={focusChatInput}
      />
    </Flexbox>
  );
};

interface ZoomBarProps {
  k: number;
  onFit: () => void;
  onZoom: (factor: number) => void;
}

export const ZoomBar = ({ k, onFit, onZoom }: ZoomBarProps) => {
  const { t } = useTranslation('project');
  return (
    <Flexbox
      horizontal
      align="center"
      gap={2}

      {...sx(floatStyles.float, undefined, {
        insetBlockEnd: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        insetInlineStart: 12,
      })}
    >
      <ActionIcon
        icon={ZoomOutIcon}
        size={'small'}
        title={t('artboard.zoom.out')}
        onClick={() => onZoom(1 / 1.25)}
      />
      <Text
        style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', textAlign: 'center', width: 44 }}
      >
        {Math.round(k * 100)}%
      </Text>
      <ActionIcon
        icon={ZoomInIcon}
        size={'small'}
        title={t('artboard.zoom.in')}
        onClick={() => onZoom(1.25)}
      />
      <ActionIcon icon={ScanIcon} size={'small'} title={t('artboard.zoom.fit')} onClick={onFit} />
    </Flexbox>
  );
};
