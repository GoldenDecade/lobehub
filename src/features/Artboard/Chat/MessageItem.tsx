import { Avatar, Button, Flexbox, Icon, Text } from '@lobehub/ui';
import { cssVar } from '@lobehub/ui/stylex/cssVar.stylex';
import * as stylex from '@stylexjs/stylex';
import { BotIcon, ClipboardCheckIcon, LayoutDashboardIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { frameById, noteById } from '../fixture/board';
import { artboardActions } from '../store';
import type { ChatMessage } from '../types';

const styles = stylex.create({
  card: {
    backgroundColor: cssVar.colorBgContainer,
    borderColor: cssVar.colorBorderSecondary,
    borderRadius: cssVar.borderRadiusLG,
    borderStyle: 'solid',
    borderWidth: 1,
    paddingBlock: 10,
    paddingInline: 12,
  },
  cardClickable: {
    cursor: 'pointer',
  },
  quote: {
    borderInlineStartColor: cssVar.colorPrimary,
    borderInlineStartStyle: 'solid',
    borderInlineStartWidth: 2,
    color: cssVar.colorTextSecondary,
    cursor: 'pointer',
    fontSize: 12,
    maxWidth: '86%',
    paddingInline: 8,
  },
  text: {
    whiteSpace: 'pre-wrap',
  },
  userBubble: {
    backgroundColor: cssVar.colorFillSecondary,
    borderRadius: 12,
    maxWidth: '86%',
    paddingBlock: 8,
    paddingInline: 12,
    whiteSpace: 'pre-wrap',
  },
});

export const useTargetName = () => {
  const { t } = useTranslation('project');
  return (id: string) => {
    const frame = frameById[id];
    if (frame) return `${frame.id} · ${frame.title}`;
    const note = noteById[id];
    return note ? t('artboard.chat.stickyTarget', { text: note.text }) : id;
  };
};

export const BotAvatar = () => (
  <Avatar
    avatar={<Icon icon={BotIcon} size={14} />}
    background={cssVar.colorFillSecondary}
    size={24}
  />
);

const MessageCard = ({ card }: { card: NonNullable<ChatMessage['card']> }) => {
  const { t } = useTranslation('project');
  if (card.type === 'board')
    return (
      <Flexbox
        horizontal
        align="center"
        gap={10}
        {...stylex.props(styles.card, styles.cardClickable)}
        onClick={() => artboardActions.focus({ kind: 'all' })}
      >
        <Icon icon={LayoutDashboardIcon} size={18} />
        <Flexbox flex={1} gap={2} style={{ minWidth: 0 }}>
          <Text strong>{t('artboard.card.board')}</Text>
          <Text style={{ fontSize: 12 }} type="secondary">
            {card.desc}
          </Text>
        </Flexbox>
      </Flexbox>
    );
  return (
    <Flexbox gap={10} {...stylex.props(styles.card)}>
      <Flexbox horizontal align="center" gap={10}>
        <Icon icon={ClipboardCheckIcon} size={18} />
        <Flexbox flex={1} gap={2} style={{ minWidth: 0 }}>
          <Text strong>{t('artboard.card.acceptance')}</Text>
          <Text style={{ fontSize: 12 }} type="secondary">
            {card.desc}
          </Text>
        </Flexbox>
      </Flexbox>
      <Button size={'small'} onClick={() => artboardActions.setMode('verify')}>
        {t('artboard.card.openVerify')}
      </Button>
    </Flexbox>
  );
};

const MessageItem = ({ message }: { message: ChatMessage }) => {
  const { t } = useTranslation('project');
  const targetName = useTargetName();

  if (message.role === 'user')
    return (
      <Flexbox align="flex-end" gap={4}>
        {message.quote && (
          <div
            {...stylex.props(styles.quote)}
            onClick={() => artboardActions.focusItem(message.quote!)}
          >
            {t('artboard.chat.quote', { target: targetName(message.quote) })}
          </div>
        )}
        <div {...stylex.props(styles.userBubble)}>{message.text}</div>
      </Flexbox>
    );

  return (
    <Flexbox horizontal gap={8}>
      <BotAvatar />
      <Flexbox flex={1} gap={8} style={{ minWidth: 0, paddingTop: 2 }}>
        <div {...stylex.props(styles.text)}>{message.text}</div>
        {message.card && <MessageCard card={message.card} />}
      </Flexbox>
    </Flexbox>
  );
};

export default MessageItem;
