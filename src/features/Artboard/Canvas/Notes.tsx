import { useTranslation } from 'react-i18next';

import { sx } from '@/styles/sx';

import { createResolveModal } from '../Finalize';
import { NOTES } from '../fixture/board';
import { useArtboardStore } from '../store';
import { canvasStyles } from './styles';

const Notes = () => {
  const { t } = useTranslation('project');
  const { resolved, verify, visible } = useArtboardStore((s) => ({
    resolved: s.resolved,
    verify: s.mode === 'verify',
    visible: s.visible,
  }));

  return NOTES.map((note) => {
    if (!visible.includes(note.id)) return null;
    const position = { left: note.x, top: note.y };
    if (note.kind === 'title')
      return (
        <div
          key={note.id}

          {...sx([canvasStyles.title, canvasStyles.appear], undefined, position)}
        >
          {note.text}
        </div>
      );
    if (note.kind === 'subtitle')
      return (
        <div
          key={note.id}

          {...sx([canvasStyles.subtitle, canvasStyles.appear], undefined, position)}
        >
          {note.text}
        </div>
      );

    const decided = resolved[note.id];
    const open = note.pending && !decided;
    return (
      <div
        data-board-item={open || undefined}
        key={note.id}

        {...sx(
          [
            canvasStyles.sticky,
            canvasStyles.appear,
            open && canvasStyles.stickyPending,
            (note.tone === 'good' || !!decided) && canvasStyles.stickyGood,
          ],
          undefined,
          { ...position, opacity: verify ? 0.3 : 1, width: note.w },
        )}
        onClick={
          open
            ? (e) => {
                e.stopPropagation();
                createResolveModal(note.id);
              }
            : undefined
        }
      >
        {decided
          ? t('artboard.sticky.decided', { text: decided })
          : open
            ? t('artboard.sticky.pending', { text: note.text })
            : note.text}
        {open && (
          <div style={{ fontSize: 15, marginTop: 8, opacity: 0.7 }}>
            {t('artboard.sticky.action')}
          </div>
        )}
      </div>
    );
  });
};

export default Notes;
