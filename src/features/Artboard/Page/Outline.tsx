import { Flexbox, Text } from '@lobehub/ui';
import { cssVar } from '@lobehub/ui/stylex/cssVar.stylex';
import * as stylex from '@stylexjs/stylex';
import { useTranslation } from 'react-i18next';

import { floatStyles } from '../Canvas/Overlays';
import { FRAMES, GROUPS } from '../fixture/board';
import { artboardActions, artboardSelectors, useArtboardStore } from '../store';

const styles = stylex.create({
  group: {
    color: cssVar.colorTextSecondary,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    paddingBlock: 6,
    paddingInline: 8,
  },
  item: {
    backgroundColor: {
      ':hover': cssVar.colorFillTertiary,
      'default': 'transparent',
    },
    borderRadius: cssVar.borderRadius,
    cursor: 'pointer',
    fontSize: 13,
    overflow: 'hidden',
    paddingBlock: 5,
    paddingInline: 8,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemActive: {
    backgroundColor: cssVar.colorFillSecondary,
  },
  panel: {
    insetBlockStart: 12,
    insetInlineStart: 12,
    maxHeight: 'calc(100% - 80px)',
    overflowY: 'auto',
    width: 184,
  },
});

const Outline = () => {
  const { t } = useTranslation('project');
  const { counts, selected, visible } = useArtboardStore((s) => ({
    counts: artboardSelectors.commentCounts(s),
    selected: s.selected,
    visible: s.visible,
  }));

  return (
    <Flexbox gap={2} {...stylex.props(floatStyles.float, styles.panel)}>
      <Text style={{ fontSize: 12, padding: '6px 8px 2px' }} type="secondary">
        {t('artboard.outline.title')}
      </Text>
      {GROUPS.map((group) => {
        const frames = FRAMES.filter((f) => f.group === group.id && visible.includes(f.id));
        if (!frames.length) return null;
        return (
          <Flexbox key={group.id}>
            <div
              {...stylex.props(styles.group)}
              onClick={() => artboardActions.focus({ id: group.id, kind: 'group' })}
            >
              {group.title}
            </div>
            {frames.map((frame) => (
              <div
                key={frame.id}
                {...stylex.props(styles.item, selected === frame.id && styles.itemActive)}
                onClick={() => artboardActions.focusItem(frame.id)}
              >
                {frame.title}
                {counts[frame.id] ? ` · ${counts[frame.id]}` : ''}
              </div>
            ))}
          </Flexbox>
        );
      })}
    </Flexbox>
  );
};

export default Outline;
