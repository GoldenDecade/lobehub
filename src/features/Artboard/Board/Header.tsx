import { ActionIcon, Button, Flexbox, Icon, Segmented, Tag } from '@lobehub/ui';
import { cssVar } from '@lobehub/ui/stylex/cssVar.stylex';
import * as stylex from '@stylexjs/stylex';
import { ClipboardCheckIcon, ListTreeIcon, LockIcon, PlayIcon, StampIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { createFinalizeModal } from '../Finalize';
import { JOURNEY_ORDER } from '../fixture/board';
import { artboardActions, artboardSelectors, useArtboardStore } from '../store';
import type { BoardMode } from '../types';

const styles = stylex.create({
  bar: {
    borderBlockEndColor: cssVar.colorBorderSecondary,
    borderBlockEndStyle: 'solid',
    borderBlockEndWidth: 1,
    flex: 'none',
    minHeight: 44,
    paddingBlock: 6,
    paddingInline: 12,
  },
});

const Header = ({ narrow }: { narrow: boolean }) => {
  const { t } = useTranslation('project');
  const { finalized, mode, outlineOpen, pendingLeft, verifyOpen } = useArtboardStore((s) => ({
    finalized: s.phase === 'finalized',
    mode: s.mode,
    outlineOpen: s.outlineOpen,
    pendingLeft: artboardSelectors.pendingLeft(s),
    verifyOpen: s.verifyOpen,
  }));

  return (
    <Flexbox
      horizontal
      align={'center'}
      gap={8}
      justify={'space-between'}
      wrap={'wrap'}
      {...stylex.props(styles.bar)}
    >
      <Flexbox horizontal align={'center'} gap={6} style={{ minWidth: 0 }}>
        {!narrow && (
          <ActionIcon
            active={outlineOpen}
            disabled={mode === 'verify'}
            icon={ListTreeIcon}
            size={'small'}
            title={t('artboard.header.outline')}
            onClick={() => artboardActions.setOutlineOpen(!outlineOpen)}
          />
        )}
        <Tag size={'small'}>
          {finalized ? t('artboard.header.phaseFinalized') : t('artboard.header.phaseDraft')}
        </Tag>
      </Flexbox>
      <Flexbox horizontal align={'center'} gap={8}>
        <Segmented
          size={'small'}
          value={mode}
          options={[
            { label: t('artboard.header.discuss'), value: 'discuss' },
            {
              disabled: !finalized,
              label: t('artboard.header.verify'),
              title: finalized ? undefined : t('artboard.header.verifyLocked'),
              value: 'verify',
            },
          ]}
          onChange={(value) => artboardActions.setMode(value as BoardMode)}
        />
        {narrow ? (
          <ActionIcon
            icon={PlayIcon}
            size={'small'}
            title={t('artboard.header.tryJourney')}
            onClick={() => artboardActions.openPlay(JOURNEY_ORDER[0], 'play')}
          />
        ) : (
          <Button
            icon={PlayIcon}
            size={'small'}
            onClick={() => artboardActions.openPlay(JOURNEY_ORDER[0], 'play')}
          >
            {t('artboard.header.tryJourney')}
          </Button>
        )}
        {finalized ? (
          <Tag color={'success'} icon={<Icon icon={LockIcon} />} size={'small'}>
            {t('artboard.header.finalized')}
          </Tag>
        ) : (
          <Button icon={StampIcon} size={'small'} type={'primary'} onClick={createFinalizeModal}>
            {narrow
              ? t('artboard.header.finalizeShort')
              : pendingLeft
                ? t('artboard.header.finalizePending', { count: pendingLeft })
                : t('artboard.header.finalize')}
          </Button>
        )}
        {mode === 'verify' && (
          <ActionIcon
            active={verifyOpen}
            icon={ClipboardCheckIcon}
            size={'small'}
            title={t('artboard.header.verifyPanel')}
            onClick={() => artboardActions.setVerifyOpen(!verifyOpen)}
          />
        )}
      </Flexbox>
    </Flexbox>
  );
};

export default Header;
