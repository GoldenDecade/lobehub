import type { BuiltinRenderProps } from '@lobechat/types';
import { Block, Button, Flexbox, Icon, Text } from '@lobehub/ui';
import { ClipboardCheckIcon, PresentationIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { artboardActions } from '../store';
import { openBoardPanel } from './messages';
import { type BoardCardArgs, BoardToolApiName } from './tool';

const BoardCard = ({ apiName, args, messageId }: BuiltinRenderProps<BoardCardArgs>) => {
  const { t } = useTranslation('project');
  const acceptance = apiName === BoardToolApiName.acceptance;
  const open = () => {
    if (acceptance) artboardActions.setMode('verify');
    openBoardPanel(messageId);
  };

  return (
    <Block
      clickable
      horizontal
      align={'center'}
      gap={12}
      paddingBlock={10}
      paddingInline={12}
      variant={'outlined'}
      onClick={open}
    >
      <Icon icon={acceptance ? ClipboardCheckIcon : PresentationIcon} size={20} />
      <Flexbox flex={1} gap={2} style={{ minWidth: 0 }}>
        <Text style={{ fontSize: 12 }} type={'secondary'}>
          {acceptance ? t('artboard.card.acceptance') : t('artboard.title')}
        </Text>
        <Text ellipsis strong>
          {args?.title}
        </Text>
        <Text ellipsis style={{ fontSize: 12 }} type={'secondary'}>
          {args?.desc}
        </Text>
      </Flexbox>
      <Button
        size={'small'}
        onClick={(e) => {
          e.stopPropagation();
          open();
        }}
      >
        {acceptance ? t('artboard.card.openVerify') : t('artboard.card.openBoard')}
      </Button>
    </Block>
  );
};

export default BoardCard;
