import { t } from 'i18next';

import { frameById, noteById } from './fixture/board';

export const targetName = (id: string) => {
  const frame = frameById[id];
  if (frame) return `${frame.id} · ${frame.title}`;
  const note = noteById[id];
  return note ? t('artboard.chat.stickyTarget', { ns: 'project', text: note.text }) : id;
};
