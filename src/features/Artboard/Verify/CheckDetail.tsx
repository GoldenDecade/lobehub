import { Button, Flexbox, Icon, Text } from '@lobehub/ui';
import { cssVar } from '@lobehub/ui/stylex/cssVar.stylex';
import * as stylex from '@stylexjs/stylex';
import { ArrowLeftIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { flowStateColor } from '@/features/Acceptance/Viewer/Flow/FlowNode';

import {
  checkByNode,
  JOURNEY_FLOW,
  JOURNEY_VERSION,
  nodeAttempts,
  nodeReview,
  nodeState,
} from '../fixture/acceptanceFlow';
import { frameById } from '../fixture/board';
import StatusTag from '../StatusTag';
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
  const { rev, run } = useArtboardStore((s) => ({ rev: s.revs[frameId] ?? 1, run: s.run }));
  const check = checkByNode[frameId];
  const frame = frameById[frameId];
  const state = nodeState(run, frameId);
  const review = nodeReview(run, frameId);
  const attempts = nodeAttempts(run, frameId);
  const verdictOf = (edgeId: string | null) =>
    attempts.find((attempt) => attempt.incomingEdgeId === edgeId)?.verdict;
  const paths = [
    ...(frameId === JOURNEY_FLOW.entryNodeId ? [{ edgeId: null, label: null }] : []),
    ...JOURNEY_VERSION.edges
      .filter((edge) => edge.targetNodeKey === frameId)
      .map((edge) => ({
        edgeId: edge.id,
        label: `${frameById[edge.sourceNodeKey].title} → ${edge.trigger}`,
      })),
  ];
  const failed = state === 'failed';
  const shot = !!state && state !== 'blocked';
  const observation = attempts[0]?.observation;

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
        <StatusTag state={state} />
        <Text code style={{ fontSize: 12 }} type="secondary">
          {check.id} ↔ {frame.id}
        </Text>
      </Flexbox>
      <Text strong style={{ fontSize: 15, marginTop: 6 }}>
        {check.definition.expected}
      </Text>
      <Flexbox gap={6} {...stylex.props(styles.section)}>
        <Text style={{ fontSize: 12 }} type="secondary">
          {t('artboard.verify.paths')}
        </Text>
        {paths.map((path) => (
          <Flexbox horizontal align="center" gap={8} key={path.edgeId ?? 'entry'}>
            <Text style={{ flex: 1, fontSize: 13, minWidth: 0 }}>
              {path.label ?? t('artboard.verify.entry')}
            </Text>
            {run && <StatusTag state={verdictOf(path.edgeId)} />}
          </Flexbox>
        ))}
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
            {shot ? (
              <Thumb real rev={rev} screen={frame.screen} tone={flowStateColor(state)} />
            ) : (
              <EmptyThumb>{t('artboard.verify.noShot')}</EmptyThumb>
            )}
          </Flexbox>
        </Flexbox>
        {observation && (
          <Text style={{ fontSize: 13 }} type={failed ? 'danger' : undefined}>
            {t('artboard.verify.observation', { text: observation })}
          </Text>
        )}
      </Flexbox>
      {state && (
        <Flexbox gap={8} style={{ paddingTop: 14 }}>
          <Text style={{ fontSize: 12 }} type="secondary">
            {t('artboard.verify.reviewTitle')}
          </Text>
          {review ? (
            <Text>
              {t(
                review === 'accepted'
                  ? 'artboard.verify.reviewAccepted'
                  : 'artboard.verify.reviewRejected',
              )}
            </Text>
          ) : (
            <Flexbox horizontal gap={8}>
              <Button onClick={() => artboardActions.review(frameId, 'accepted')}>
                {t('artboard.verify.accept')}
              </Button>
              <Button danger onClick={() => artboardActions.review(frameId, 'rejected')}>
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
