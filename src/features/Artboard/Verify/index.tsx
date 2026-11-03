import { ActionIcon, Flexbox, Icon, Tag, Text } from '@lobehub/ui';
import { cssVar } from '@lobehub/ui/stylex/cssVar.stylex';
import * as stylex from '@stylexjs/stylex';
import { Link2Icon, XIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { CHECKS, frameById } from '../fixture/board';
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
  const { counts, filled, results, reviews } = useArtboardStore((s) => ({
    counts: artboardSelectors.resultCounts(s),
    filled: s.filled,
    results: s.results,
    reviews: s.reviews,
  }));

  return (
    <Flexbox gap={10}>
      <Text style={{ fontSize: 12 }} type="secondary">
        {filled ? t('artboard.verify.summary', counts) : t('artboard.verify.waiting')}
      </Text>
      {CHECKS.map((check) => (
        <Flexbox
          gap={8}
          key={check.id}
          {...stylex.props(styles.check)}
          onClick={() => artboardActions.focusItem(check.frame)}
        >
          <Flexbox horizontal align="flex-start" gap={8}>
            <StatusTag status={results[check.frame].status} />
            <Text style={{ flex: 1, minWidth: 0 }}>{check.title}</Text>
          </Flexbox>
          <Flexbox horizontal align="center" gap={8}>
            <Tag icon={<Icon icon={Link2Icon} />} size={'small'}>
              {check.frame} · {frameById[check.frame].title}
            </Tag>
            {reviews[check.frame] && (
              <Text style={{ fontSize: 12 }} type="secondary">
                {t(
                  reviews[check.frame] === 'accept'
                    ? 'artboard.verify.reviewedTag'
                    : 'artboard.verify.rejectedTag',
                )}
              </Text>
            )}
          </Flexbox>
        </Flexbox>
      ))}
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
