import { Flexbox, Icon, Text } from '@lobehub/ui';
import { LockIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { sx } from '@/styles/sx';

import { FRAMES, groupRect, GROUPS, JOURNEY_GROUP } from '../fixture/board';
import { useArtboardStore } from '../store';
import { ScaledLabel } from './FrameLabel';
import { canvasStyles } from './styles';

const Groups = ({ k }: { k: number }) => {
  const { t } = useTranslation('project');
  const { finalized, verify, visible } = useArtboardStore((s) => ({
    finalized: s.phase === 'finalized',
    verify: s.mode === 'verify',
    visible: s.visible,
  }));

  return GROUPS.map((group) => {
    if (!FRAMES.some((f) => f.group === group.id && visible.includes(f.id))) return null;
    const rect = groupRect(group.id);
    const locked = finalized && group.id === JOURNEY_GROUP;
    const desc = locked
      ? t(verify ? 'artboard.group.verifyDesc' : 'artboard.group.lockedDesc')
      : group.desc;
    return (
      <div
        key={group.id}
        {...sx([canvasStyles.group, locked && canvasStyles.groupLocked], undefined, {
          height: rect.h,
          left: rect.x,
          opacity: verify && group.id !== JOURNEY_GROUP ? 0.3 : 1,
          top: rect.y,
          width: rect.w,
        })}
      >
        <ScaledLabel gap={6} k={k} width={rect.w}>
          <Flexbox
            horizontal
            align="center"
            gap={8}
            style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}
          >
            {locked && <Icon icon={LockIcon} size={13} />}
            <Text strong style={{ flex: 'none', fontSize: 15 }}>
              {group.title}
            </Text>
            {rect.w * k > 420 && (
              <Text ellipsis style={{ fontSize: 12 }} type="secondary">
                {desc}
              </Text>
            )}
          </Flexbox>
        </ScaledLabel>
      </div>
    );
  });
};

export default Groups;
