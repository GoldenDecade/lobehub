import { Button } from '@lobehub/ui';
import { PresentationIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useChatStore } from '@/store/chat/store';

import { useArtboardFeature } from '../useArtboardFeature';

const play = async () => {
  const { activeAgentId, activeThreadId, activeTopicId } = useChatStore.getState();
  if (!activeAgentId) return;
  const [{ registerArtboardTool }, { bindConversation }, { artboardActions }] = await Promise.all([
    import('./register'),
    import('./messages'),
    import('../store'),
  ]);
  registerArtboardTool();
  bindConversation({
    agentId: activeAgentId,
    threadId: activeThreadId ?? null,
    topicId: activeTopicId ?? null,
  });
  artboardActions.replay();
};

const ArtboardDemoButton = () => {
  const { t } = useTranslation('project');
  const { enabled } = useArtboardFeature();
  if (!enabled) return null;

  return (
    <Button icon={PresentationIcon} size={'small'} type={'text'} onClick={play}>
      {t('artboard.demo.start')}
    </Button>
  );
};

export default ArtboardDemoButton;
