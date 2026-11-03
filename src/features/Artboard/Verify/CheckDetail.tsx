import { Button, Flexbox, Icon, Text } from '@lobehub/ui';
import { cssVar } from '@lobehub/ui/stylex/cssVar.stylex';
import * as stylex from '@stylexjs/stylex';
import { ArrowLeftIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ARROWS, checkByFrame, frameById } from '../fixture/board';
import StatusTag, { STATUS_META } from '../StatusTag';
import { artboardActions, useArtboardStore } from '../store';
import { EmptyThumb, Thumb } from './Thumb';

const styles = stylex.create({
  back: {
    cursor: 'pointer',
    marginBlockEnd: 8,
  },
  section: {
    borderBlockEndColor: cssVar.colorBorderSecondary,
    borderBlockEndStyle: 'solid',
    borderBlockEndWidth: 1,
    paddingBlock: 14,
  },
});

const CheckDetail = ({ frameId }: { frameId: string }) => {
  const { t } = useTranslation('project');
  const { result, rev, review } = useArtboardStore((s) => ({
    result: s.results[frameId],
    rev: s.revs[frameId] ?? 1,
    review: s.reviews[frameId],
  }));
  const check = checkByFrame[frameId];
  const frame = frameById[frameId];
  const incoming = ARROWS.filter((a) => a.to === frameId);
  const failed = result.status === 'failed';

  return (
    <Flexbox gap={4}>
      <Flexbox
        horizontal
        align="center"
        gap={6}
        {...stylex.props(styles.back)}
        onClick={() => artboardActions.select(null)}
      >
        <Icon icon={ArrowLeftIcon} size={14} />
        <Text style={{ fontSize: 12 }} type="secondary">
          {t('artboard.verify.back')}
        </Text>
      </Flexbox>
      <Flexbox horizontal align="center" gap={8}>
        <StatusTag status={result.status} />
        <Text code style={{ fontSize: 12 }} type="secondary">
          {check.id} ↔ {frame.id}
        </Text>
      </Flexbox>
      <Text strong style={{ fontSize: 15, marginTop: 6 }}>
        {check.title}
      </Text>
      <Flexbox gap={6} {...stylex.props(styles.section)}>
        <Text style={{ fontSize: 12 }} type="secondary">
          {t('artboard.verify.paths')}
        </Text>
        {incoming.length ? (
          incoming.map((a) => (
            <Text key={a.d} style={{ fontSize: 13 }}>
              {frameById[a.from].title} → {a.label}
            </Text>
          ))
        ) : (
          <Text style={{ fontSize: 13 }}>{t('artboard.verify.entry')}</Text>
        )}
      </Flexbox>
      <Flexbox gap={8} {...stylex.props(styles.section)}>
        <Flexbox horizontal gap={8}>
          <Flexbox flex={1} gap={4} style={{ minWidth: 0 }}>
            <Text style={{ fontSize: 12 }} type="secondary">
              {t('artboard.verify.reference', { rev })}
            </Text>
            <Thumb rev={rev} screen={frame.screen} />
          </Flexbox>
          <Flexbox flex={1} gap={4} style={{ minWidth: 0 }}>
            <Text style={{ fontSize: 12 }} type="secondary">
              {t('artboard.verify.realShot')}
            </Text>
            {result.shot ? (
              <Thumb real rev={rev} screen={frame.screen} tone={STATUS_META[result.status].tone} />
            ) : (
              <EmptyThumb>{t('artboard.verify.noShot')}</EmptyThumb>
            )}
          </Flexbox>
        </Flexbox>
        {result.obs && (
          <Text style={{ fontSize: 13 }} type={failed ? 'danger' : undefined}>
            {t('artboard.verify.observation', { text: result.obs })}
          </Text>
        )}
      </Flexbox>
      {result.status !== 'pending' && (
        <Flexbox gap={8} style={{ paddingTop: 14 }}>
          <Text style={{ fontSize: 12 }} type="secondary">
            {t('artboard.verify.reviewTitle')}
          </Text>
          {review ? (
            <Text>
              {t(
                review === 'accept'
                  ? 'artboard.verify.reviewAccepted'
                  : 'artboard.verify.reviewRejected',
              )}
            </Text>
          ) : (
            <Flexbox horizontal gap={8}>
              <Button onClick={() => artboardActions.review(frameId, 'accept')}>
                {t('artboard.verify.accept')}
              </Button>
              <Button danger onClick={() => artboardActions.review(frameId, 'reject')}>
                {t(failed ? 'artboard.verify.rejectFailed' : 'artboard.verify.reject')}
              </Button>
            </Flexbox>
          )}
        </Flexbox>
      )}
    </Flexbox>
  );
};

export default CheckDetail;
