import { Button, Flexbox, Text } from '@lobehub/ui';
import { cssVar } from '@lobehub/ui/stylex/cssVar.stylex';
import * as stylex from '@stylexjs/stylex';
import { useTranslation } from 'react-i18next';

import { focusChatInput } from '../Chat/focusChatInput';
import { noteById } from '../fixture/board';
import { artboardActions, useArtboardStore } from '../store';

const styles = stylex.create({
  item: {
    backgroundColor: cssVar.colorWarningBg,
    borderColor: cssVar.colorWarningBorder,
    borderRadius: cssVar.borderRadiusLG,
    borderStyle: 'solid',
    borderWidth: 1,
    padding: 12,
  },
  resolved: {
    backgroundColor: cssVar.colorFillQuaternary,
    borderColor: cssVar.colorBorderSecondary,
  },
});

interface PendingItemProps {
  noteId: string;
  onDiscuss: () => void;
  onResolved?: () => void;
}

const PendingItem = ({ noteId, onDiscuss, onResolved }: PendingItemProps) => {
  const { t } = useTranslation('project');
  const decided = useArtboardStore((s) => s.resolved[noteId]);
  const note = noteById[noteId];

  return (
    <Flexbox gap={8} {...stylex.props(styles.item, !!decided && styles.resolved)}>
      <Text strong>{note.text}</Text>
      {decided ? (
        <Text style={{ fontSize: 13 }} type="success">
          {t('artboard.chat.decided', { text: decided })}
        </Text>
      ) : (
        <>
          <Text style={{ fontSize: 13 }} type="secondary">
            {t('artboard.resolve.suggest', { text: note.suggest })}
          </Text>
          <Flexbox horizontal gap={8}>
            <Button
              size={'small'}
              type={'primary'}
              onClick={() => {
                artboardActions.resolve(noteId, note.suggest ?? '');
                onResolved?.();
              }}
            >
              {t('artboard.resolve.accept')}
            </Button>
            <Button
              size={'small'}
              onClick={() => {
                onDiscuss();
                artboardActions.openSticky(noteId);
                artboardActions.focusItem(noteId);
                focusChatInput();
              }}
            >
              {t('artboard.resolve.discuss')}
            </Button>
          </Flexbox>
        </>
      )}
    </Flexbox>
  );
};

export default PendingItem;
