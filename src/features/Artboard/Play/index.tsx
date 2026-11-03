import { ActionIcon, Button, Flexbox, Tag, Text } from '@lobehub/ui';
import { cssVar } from '@lobehub/ui/stylex/cssVar.stylex';
import * as stylex from '@stylexjs/stylex';
import { useSize } from 'ahooks';
import { RotateCcwIcon, XIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { sx } from '@/styles/sx';

import { FRAME_H, FRAME_W, frameById, JOURNEY_ORDER, PLAY_NEXT } from '../fixture/board';
import { SCREENS } from '../fixture/screens';
import { artboardActions, useArtboardStore } from '../store';

const styles = stylex.create({
  bar: {
    flex: 'none',
    flexWrap: 'wrap',
    paddingBlock: 12,
    paddingInline: 16,
  },
  overlay: {
    backgroundColor: cssVar.colorBgLayout,
    display: 'flex',
    flexDirection: 'column',
    inset: 0,
    position: 'fixed',
    zIndex: 1000,
  },
  screen: {
    borderColor: cssVar.colorBorder,
    borderRadius: 12,
    borderStyle: 'solid',
    borderWidth: 1,
    boxShadow: cssVar.boxShadow,
    overflow: 'hidden',
  },
  stage: {
    alignItems: 'center',
    display: 'flex',
    flex: '1',
    justifyContent: 'center',
    minHeight: 0,
    padding: 16,
  },
  step: {
    cursor: 'pointer',
  },
});

const PlayOverlay = () => {
  const { t } = useTranslation('project');
  const play = useArtboardStore((s) => s.play);
  const rev = useArtboardStore((s) => (s.play ? (s.revs[s.play.frame] ?? 1) : 1));
  const stageRef = useRef<HTMLDivElement>(null);
  const size = useSize(stageRef);

  useEffect(() => {
    if (!play) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') artboardActions.closePlay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [play]);

  if (!play) return null;

  const frame = frameById[play.frame];
  const Screen = SCREENS[frame.screen];
  const playing = play.mode === 'play';
  const scale = size ? Math.min((size.width - 32) / FRAME_W, (size.height - 32) / FRAME_H, 1.5) : 1;
  const next = PLAY_NEXT[play.frame];

  return (
    <div {...stylex.props(styles.overlay)}>
      <Flexbox horizontal align="center" gap={8} {...stylex.props(styles.bar)}>
        <Text strong style={{ marginInlineEnd: 8 }}>
          {playing ? t('artboard.play.title') : `${frame.id} · ${frame.title}`}
        </Text>
        {playing &&
          JOURNEY_ORDER.map((id) => (
            <Tag
              color={id === play.frame ? 'blue' : undefined}
              key={id}
              size={'small'}
              {...stylex.props(styles.step)}
              onClick={() => artboardActions.stepPlay(id)}
            >
              {frameById[id].title}
            </Tag>
          ))}
        <Flexbox flex={1} />
        {playing && (
          <Button
            icon={RotateCcwIcon}
            size={'small'}
            onClick={() => artboardActions.stepPlay(JOURNEY_ORDER[0])}
          >
            {t('artboard.play.restart')}
          </Button>
        )}
        <ActionIcon
          icon={XIcon}
          title={t('artboard.play.close')}
          onClick={artboardActions.closePlay}
        />
      </Flexbox>
      <div ref={stageRef} {...stylex.props(styles.stage)}>
        <div {...sx(styles.screen, undefined, { height: FRAME_H * scale, width: FRAME_W * scale })}>
          <div
            style={{
              height: FRAME_H,
              transform: `scale(${scale})`,
              transformOrigin: '0 0',
              width: FRAME_W,
            }}
          >
            <Screen
              key={`${play.frame}-${play.nonce}`}
              playing={playing}
              rev={rev}
              onAction={
                playing
                  ? (action) => {
                      const target = next?.[action];
                      if (target) artboardActions.stepPlay(target);
                    }
                  : undefined
              }
            />
          </div>
        </div>
      </div>
      <Text style={{ fontSize: 12, paddingBlockEnd: 16, textAlign: 'center' }} type="secondary">
        {playing && !next ? t('artboard.play.end') : t('artboard.play.hint')}
      </Text>
    </div>
  );
};

export default PlayOverlay;
