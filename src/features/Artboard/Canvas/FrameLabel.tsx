import { Flexbox, Icon, Tag, Text } from '@lobehub/ui';
import { ImageIcon, LockIcon, PlayIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { sx } from '@/styles/sx';

import { FRAME_W } from '../fixture/board';
import StatusTag, { STATUS_META } from '../StatusTag';
import type { BoardFrame, CheckResult } from '../types';
import { canvasStyles } from './styles';

interface ScaledLabelProps {
  children: ReactNode;
  gap?: number;
  k: number;
  width: number;
}

export const ScaledLabel = ({ children, gap = 8, k, width }: ScaledLabelProps) => (
  <div
    {...sx(canvasStyles.scaledLabel, undefined, {
      paddingBottom: gap,
      transform: `scale(${1 / k})`,
      width: width * k,
    })}
  >
    {children}
  </div>
);

interface FrameLabelProps {
  comments: number;
  frame: BoardFrame;
  k: number;
  linked?: string;
  result?: CheckResult;
  rev: number;
  verify: boolean;
}

const FrameLabel = ({ comments, frame, k, linked, result, rev, verify }: FrameLabelProps) => {
  const { t } = useTranslation('project');
  const screenWidth = FRAME_W * k;
  if (screenWidth < 90) return null;

  if (screenWidth < 320)
    return (
      <ScaledLabel gap={4} k={k} width={FRAME_W}>
        <Flexbox horizontal align="center" gap={4} style={{ minWidth: 0 }}>
          {verify && result && (
            <Icon
              color={STATUS_META[result.status].tone}
              icon={STATUS_META[result.status].icon}
              size={12}
            />
          )}
          <Text ellipsis strong style={{ fontSize: 12 }}>
            {frame.title}
          </Text>
        </Flexbox>
      </ScaledLabel>
    );

  return (
    <ScaledLabel k={k} width={FRAME_W}>
      <Flexbox
        horizontal
        align="center"
        gap={6}
        style={{ minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap' }}
      >
        <Text code style={{ flex: 'none', fontSize: 11 }} type="secondary">
          {frame.id}
        </Text>
        <Text ellipsis strong style={{ fontSize: 13 }}>
          {frame.title}
        </Text>
        {frame.recommended && (
          <Tag color="success" size={'small'}>
            {t('artboard.frame.recommended')}
          </Tag>
        )}
        {frame.interactive && !verify && (
          <Tag icon={<Icon icon={PlayIcon} />} size={'small'}>
            {t('artboard.frame.interactive')}
          </Tag>
        )}
        {frame.image && (
          <Tag icon={<Icon icon={ImageIcon} />} size={'small'}>
            {t('artboard.frame.image')}
          </Tag>
        )}
        {rev > 1 && <Tag size={'small'}>v{rev}</Tag>}
        <div style={{ flex: 1 }} />
        {linked && !verify && (
          <Tag icon={<Icon icon={LockIcon} />} size={'small'}>
            {linked}
          </Tag>
        )}
        {verify && result && <StatusTag status={result.status} />}
        {!verify && comments > 0 && (
          <Text style={{ fontSize: 12 }} type="secondary">
            {t('artboard.frame.comments', { count: comments })}
          </Text>
        )}
      </Flexbox>
    </ScaledLabel>
  );
};

export default FrameLabel;
