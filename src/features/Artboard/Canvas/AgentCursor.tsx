import { Icon } from '@lobehub/ui';
import { cssVar } from '@lobehub/ui/stylex/cssVar.stylex';
import * as stylex from '@stylexjs/stylex';
import { MousePointer2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { sx } from '@/styles/sx';

import { FRAME_W, frameById, noteById } from '../fixture/board';
import { useArtboardStore } from '../store';
import { canvasStyles } from './styles';

const AgentCursor = ({ k }: { k: number }) => {
  const { t } = useTranslation('project');
  const target = useArtboardStore((s) => (s.previewState === 'generating' ? 'o-b' : s.agentAt));
  const item = target ? (frameById[target] ?? noteById[target]) : undefined;
  if (!item) return null;
  const width = noteById[target!]?.w ?? FRAME_W;

  return (
    <div
      {...sx(canvasStyles.cursor, undefined, {
        transform: `translate(${item.x + width * 0.55}px, ${item.y + 140}px)`,
      })}
    >
      <div style={{ transform: `scale(${1 / k})`, transformOrigin: '0 0' }}>
        <Icon
          color={cssVar.colorPrimary}
          icon={MousePointer2Icon}
          size={22}
          style={{ fill: cssVar.colorPrimary }}
        />
        <div {...stylex.props(canvasStyles.cursorName)}>{t('artboard.cursor.agent')}</div>
      </div>
    </div>
  );
};

export default AgentCursor;
