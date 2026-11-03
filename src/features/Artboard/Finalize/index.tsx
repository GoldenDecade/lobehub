import { createModal, Flexbox, useModalContext } from '@lobehub/ui';
import { t } from 'i18next';

import FinalizeContent from './FinalizeContent';
import PendingItem from './PendingItem';

const ResolveContent = ({ noteId }: { noteId: string }) => {
  const { close } = useModalContext();
  return (
    <Flexbox paddingBlock={'0 8px'}>
      <PendingItem noteId={noteId} onDiscuss={close} onResolved={close} />
    </Flexbox>
  );
};

export const createFinalizeModal = () =>
  createModal({
    content: <FinalizeContent />,
    footer: null,
    title: t('artboard.finalize.title', { ns: 'project' }),
    width: 560,
  });

export const createResolveModal = (noteId: string) =>
  createModal({
    content: <ResolveContent noteId={noteId} />,
    footer: null,
    title: t('artboard.resolve.title', { ns: 'project' }),
    width: 440,
  });
