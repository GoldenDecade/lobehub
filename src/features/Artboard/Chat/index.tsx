import { ActionIcon, Button, Flexbox, Icon, Tag, Text, TextArea } from '@lobehub/ui';
import { cssVar } from '@lobehub/ui/stylex/cssVar.stylex';
import * as stylex from '@stylexjs/stylex';
import { QuoteIcon, RotateCcwIcon, SendIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { sx } from '@/styles/sx';

import { artboardActions, artboardSelectors, useArtboardStore } from '../store';
import { CHAT_INPUT_ID } from './focusChatInput';
import MessageItem, { BotAvatar, useTargetName } from './MessageItem';

const dot = stylex.keyframes({ '50%': { opacity: 0.25 } });

const styles = stylex.create({
  composer: {
    borderBlockStartColor: cssVar.colorBorderSecondary,
    borderBlockStartStyle: 'solid',
    borderBlockStartWidth: 1,
    flex: 'none',
    paddingBlockEnd: 'max(16px, env(safe-area-inset-bottom, 0px))',
    paddingBlockStart: 12,
    paddingInline: 16,
  },
  dot: {
    animationDuration: '1s',
    animationIterationCount: 'infinite',
    animationName: dot,
    animationTimingFunction: 'ease-in-out',
    backgroundColor: cssVar.colorTextTertiary,
    borderRadius: '50%',
    height: 6,
    width: 6,
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
  hint: {
    borderColor: cssVar.colorBorderSecondary,
    borderRadius: cssVar.borderRadiusLG,
    borderStyle: 'solid',
    borderWidth: 1,
    paddingBlock: 10,
    paddingInline: 12,
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

const Typing = () => (
  <Flexbox horizontal gap={8}>
    <BotAvatar />
    <Flexbox horizontal align="center" gap={4} height={24}>
      {[0, 0.15, 0.3].map((delay) => (
        <span key={delay} {...sx(styles.dot, undefined, { animationDelay: `${delay}s` })} />
      ))}
    </Flexbox>
  </Flexbox>
);

const ChatPanel = ({ onClose }: { onClose?: () => void }) => {
  const { t } = useTranslation('project');
  const targetName = useTargetName();
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const { locked, messages, quote, replayed, typing } = useArtboardStore((s) => ({
    locked: artboardSelectors.isQuoteLocked(s),
    messages: s.messages,
    quote: s.selected,
    replayed: s.replayed,
    typing: s.typing,
  }));

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, typing]);

  const send = () => {
    if (!text.trim() || typing) return;
    artboardActions.send(text.trim());
    setText('');
  };

  return (
    <div {...stylex.props(styles.panel)}>
      <Flexbox horizontal align="center" gap={8} {...stylex.props(styles.head)}>
        <Text strong style={{ flex: 1 }}>
          {t('artboard.chat.title')}
        </Text>
        <ActionIcon
          disabled={typing}
          icon={RotateCcwIcon}
          size={'small'}
          title={t('artboard.chat.replay')}
          onClick={artboardActions.replay}
        />
        {onClose && (
          <ActionIcon
            icon={XIcon}
            size={'small'}
            title={t('artboard.chat.close')}
            onClick={onClose}
          />
        )}
      </Flexbox>
      <div {...stylex.props(styles.scroll)}>
        <Flexbox gap={16}>
          {!replayed && !typing && (
            <Flexbox horizontal align="center" gap={8} {...stylex.props(styles.hint)}>
              <Text style={{ flex: 1, fontSize: 12 }} type="secondary">
                {t('artboard.chat.replayHint')}
              </Text>
              <Button icon={RotateCcwIcon} size={'small'} onClick={artboardActions.replay}>
                {t('artboard.chat.replayAction')}
              </Button>
            </Flexbox>
          )}
          {messages.map((m) => (
            <MessageItem key={m.id} message={m} />
          ))}
          {typing && <Typing />}
          <div ref={endRef} />
        </Flexbox>
      </div>
      <Flexbox gap={8} {...stylex.props(styles.composer)}>
        {quote && (
          <Flexbox horizontal>
            <Tag
              closable
              icon={<Icon icon={QuoteIcon} />}
              size={'small'}
              onClose={() => artboardActions.select(null)}
            >
              {t('artboard.chat.quote', { target: targetName(quote) })}
            </Tag>
          </Flexbox>
        )}
        {quote && locked && (
          <Text style={{ fontSize: 12 }} type="warning">
            {t('artboard.chat.lockedHint')}
          </Text>
        )}
        <TextArea
          autoSize={{ maxRows: 5, minRows: 2 }}
          id={CHAT_INPUT_ID}
          placeholder={t(quote ? 'artboard.chat.placeholderQuote' : 'artboard.chat.placeholder')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Flexbox horizontal align="center" gap={8}>
          <Text style={{ flex: 1, fontSize: 12 }} type="secondary">
            {t('artboard.chat.sendHint')}
          </Text>
          <Button disabled={!text.trim() || typing} icon={SendIcon} type="primary" onClick={send}>
            {t('artboard.chat.send')}
          </Button>
        </Flexbox>
      </Flexbox>
    </div>
  );
};

export default ChatPanel;
