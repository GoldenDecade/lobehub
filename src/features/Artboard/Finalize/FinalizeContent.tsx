import { Button, Flexbox, Icon, Tag, Text, useModalContext } from '@lobehub/ui';
import { cssVar } from '@lobehub/ui/stylex/cssVar.stylex';
import * as stylex from '@stylexjs/stylex';
import { LockIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { JOURNEY_CHECKS } from '../fixture/acceptanceFlow';
import { PENDING_NOTES } from '../fixture/board';
import { artboardActions, artboardSelectors, useArtboardStore } from '../store';
import PendingItem from './PendingItem';

const styles = stylex.create({
  check: {
    borderBlockEndColor: cssVar.colorBorderSecondary,
    borderBlockEndStyle: 'solid',
    borderBlockEndWidth: 1,
    paddingBlock: 8,
  },
  lock: {
    backgroundColor: cssVar.colorFillQuaternary,
    borderRadius: cssVar.borderRadiusLG,
    color: cssVar.colorTextSecondary,
    fontSize: 13,
    padding: 12,
  },
});

const FinalizeContent = () => {
  const { t } = useTranslation('project');
  const { close } = useModalContext();
  const { pendingLeft, revs } = useArtboardStore((s) => ({
    pendingLeft: artboardSelectors.pendingLeft(s),
    revs: s.revs,
  }));

  return (
    <Flexbox gap={16}>
      <Flexbox gap={8}>
        <Text strong>
          {pendingLeft
            ? t('artboard.finalize.pendingTitle', { count: pendingLeft })
            : t('artboard.finalize.pendingDone')}
        </Text>
        {PENDING_NOTES.map((note) => (
          <PendingItem key={note.id} noteId={note.id} onDiscuss={close} />
        ))}
      </Flexbox>
      <Flexbox gap={4}>
        <Text strong>{t('artboard.finalize.checksTitle', { count: JOURNEY_CHECKS.length })}</Text>
        {JOURNEY_CHECKS.map((check) => (
          <Flexbox horizontal align="center" gap={8} key={check.id} {...stylex.props(styles.check)}>
            <Text code style={{ fontSize: 12 }} type="secondary">
              {check.id}
            </Text>
            <Text style={{ flex: 1, minWidth: 0 }}>{check.definition.expected}</Text>
            <Tag size={'small'}>
              {check.nodeId} · v{revs[check.nodeId] ?? 1}
            </Tag>
          </Flexbox>
        ))}
      </Flexbox>
      <Flexbox horizontal align="flex-start" gap={8} {...stylex.props(styles.lock)}>
        <Icon icon={LockIcon} size={14} style={{ marginTop: 3 }} />
        <span>{t('artboard.finalize.lockNote')}</span>
      </Flexbox>
      <Flexbox horizontal gap={8} justify="flex-end">
        <Button onClick={close}>{t('artboard.finalize.cancel')}</Button>
        <Button
          disabled={pendingLeft > 0}
          type={'primary'}
          onClick={() => {
            close();
            artboardActions.finalize();
          }}
        >
          {pendingLeft
            ? t('artboard.finalize.blocked', { count: pendingLeft })
            : t('artboard.finalize.confirm')}
        </Button>
      </Flexbox>
    </Flexbox>
  );
};

export default FinalizeContent;
