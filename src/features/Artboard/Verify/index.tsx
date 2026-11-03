import { ActionIcon, Flexbox, Icon, Tag, Text } from '@lobehub/ui';
import { cssVar } from '@lobehub/ui/stylex/cssVar.stylex';
import * as stylex from '@stylexjs/stylex';
import { Link2Icon, XIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { JOURNEY_CHECKS, nodeReview, nodeState } from '../fixture/acceptanceFlow';
import StatusTag from '../StatusTag';
import { artboardActions, artboardSelectors, useArtboardStore } from '../store';
import CheckDetail from './CheckDetail';

const styles = stylex.create({
  check: {
    borderColor: {
      ':hover': cssVar.colorBorder,
      'default': cssVar.colorBorderSecondary,
    },
    borderRadius: cssVar.borderRadiusLG,
    borderStyle: 'solid',
    borderWidth: 1,
    cursor: 'pointer',
    padding: 12,
    transitionDuration: '0.15s',
    transitionProperty: 'border-color',
  },
  head: {
    borderBlockEndColor: cssVar.colorBorderSecondary,
    borderBlockEndStyle: 'solid',
    borderBlockEndWidth: 1,
    flex: 'none',
    height: 48,
    paddingInlineEnd: 10,
    paddingInlineStart: 16,
  },
  panel: {
    backgroundColor: cssVar.colorBgContainer,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  scroll: {
    flex: '1',
    minHeight: 0,
    overflowY: 'auto',
    padding: 16,
  },
});

const CheckList = () => {
  const { t } = useTranslation('project');
  const { counts, run } = useArtboardStore((s) => ({
    counts: artboardSelectors.resultCounts(s),
    run: s.run,
  }));

  return (
    <Flexbox gap={10}>
      <Text style={{ fontSize: 12 }} type="secondary">
        {run ? t('artboard.verify.summary', counts) : t('artboard.verify.waiting')}
      </Text>
      {JOURNEY_CHECKS.map((check) => {
        const review = nodeReview(run, check.nodeId);
        return (
          <Flexbox
            gap={8}
            key={check.id}
            {...stylex.props(styles.check)}
            onClick={() => artboardActions.focusItem(check.nodeId)}
          >
            <Flexbox horizontal align="flex-start" gap={8}>
              <StatusTag state={nodeState(run, check.nodeId)} />
              <Text style={{ flex: 1, minWidth: 0 }}>{check.definition.expected}</Text>
            </Flexbox>
            <Flexbox horizontal align="center" gap={8}>
              <Tag icon={<Icon icon={Link2Icon} />} size={'small'}>
                {check.nodeId} · {check.title}
              </Tag>
              {review && (
                <Text style={{ fontSize: 12 }} type="secondary">
                  {t(
                    review === 'accepted'
                      ? 'artboard.verify.reviewedTag'
                      : 'artboard.verify.rejectedTag',
                  )}
                </Text>
              )}
            </Flexbox>
          </Flexbox>
        );
      })}
    </Flexbox>
  );
};

const VerifyPanel = ({ onClose }: { onClose?: () => void }) => {
  const { t } = useTranslation('project');
  const selected = useArtboardStore(artboardSelectors.selectedCheckFrame);

  return (
    <div {...stylex.props(styles.panel)}>
      <Flexbox horizontal align="center" gap={8} {...stylex.props(styles.head)}>
        <Text strong style={{ flex: 1 }}>
          {t(selected ? 'artboard.verify.detailTitle' : 'artboard.verify.title')}
        </Text>
        {onClose && (
          <ActionIcon
            icon={XIcon}
            size={'small'}
            title={t('artboard.verify.close')}
            onClick={onClose}
          />
        )}
      </Flexbox>
      <div {...stylex.props(styles.scroll)}>
        {selected ? <CheckDetail frameId={selected} /> : <CheckList />}
      </div>
    </div>
  );
};

export default VerifyPanel;
