import { Flexbox, Icon, Skeleton, Text } from '@lobehub/ui';
import * as stylex from '@stylexjs/stylex';
import { CircleDashedIcon, Loader2Icon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { sx } from '@/styles/sx';

import { ARROWS, checkByFrame, frameById, JOURNEY_GROUP } from '../fixture/board';
import { SCREENS } from '../fixture/screens';
import { STATUS_META } from '../StatusTag';
import { artboardActions, useArtboardStore } from '../store';
import type { BoardFrame, ScreenKey } from '../types';
import FrameLabel from './FrameLabel';
import { canvasStyles } from './styles';

const isRelated = (selected: string | null, id: string) =>
  !!selected &&
  selected !== id &&
  frameById[selected]?.group === JOURNEY_GROUP &&
  ARROWS.some((a) => (a.from === selected && a.to === id) || (a.to === selected && a.from === id));

const Drawing = () => {
  const { t } = useTranslation('project');
  return (
    <div {...stylex.props(canvasStyles.drawing)}>
      <Flexbox horizontal align="center" gap={8}>
        <Icon spin icon={Loader2Icon} />
        <Text style={{ fontSize: 15 }} type="secondary">
          {t('artboard.frame.drawing')}
        </Text>
      </Flexbox>
      <Skeleton animated height={140} radius={10} width={'100%'} />
      <Skeleton.Text animated rows={3} width={['80%', '60%', '40%']} />
    </div>
  );
};

interface FrameBodyProps {
  real: boolean;
  rev: number;
  screen: ScreenKey;
}

const FrameBody = memo<FrameBodyProps>(({ real, rev, screen }) => {
  const Screen = SCREENS[screen];
  return (
    <div {...stylex.props(canvasStyles.inert)}>
      <Screen real={real} rev={rev} />
    </div>
  );
});

FrameBody.displayName = 'ArtboardFrameBody';

const NoShot = () => {
  const { t } = useTranslation('project');
  return (
    <div {...stylex.props(canvasStyles.noShot)}>
      <Icon icon={CircleDashedIcon} size={22} />
      {t('artboard.frame.noShot')}
    </div>
  );
};

const FrameNode = ({ frame, k }: { frame: BoardFrame; k: number }) => {
  const { t } = useTranslation('project');
  const s = useArtboardStore((st) => ({
    busy: st.busy.includes(frame.id),
    comments: st.messages.filter((m) => m.role === 'user' && m.quote === frame.id).length,
    drawing: st.drawing.includes(frame.id),
    finalized: st.phase === 'finalized',
    flash: st.flash === frame.id,
    related: st.mode === 'discuss' && isRelated(st.selected, frame.id),
    result: st.results[frame.id],
    rev: st.revs[frame.id] ?? 1,
    selected: st.selected === frame.id,
    showReal: st.showReal,
    verify: st.mode === 'verify',
  }));

  const muted = s.verify && frame.group !== JOURNEY_GROUP;
  const border = s.verify && s.result && !muted ? STATUS_META[s.result.status].tone : undefined;
  const showShot = s.verify && s.showReal && !!s.result;

  const body = (() => {
    if (s.drawing) return <Drawing />;
    if (showShot && !s.result?.shot) return <NoShot />;
    return <FrameBody real={showShot} rev={s.rev} screen={frame.screen} />;
  })();

  return (
    <div
      data-board-item

      {...sx([canvasStyles.frame, canvasStyles.appear, muted && canvasStyles.muted], undefined, {
        left: frame.x,
        top: frame.y,
      })}
      onClick={(e) => {
        e.stopPropagation();
        artboardActions.select(frame.id);
      }}
    >
      <FrameLabel
        comments={s.comments}
        frame={frame}
        k={k}
        linked={s.finalized ? checkByFrame[frame.id]?.id : undefined}
        result={s.result}
        rev={s.rev}
        verify={s.verify}
      />
      <div
        {...sx(
          [
            canvasStyles.frameCard,
            s.selected && canvasStyles.frameSelected,
            !s.selected && s.related && canvasStyles.frameRelated,
            s.flash && canvasStyles.flash,
          ],
          undefined,
          border ? { borderColor: border, borderWidth: 3 } : undefined,
        )}
      >
        {body}
        {showShot && s.result?.shot && (
          <div {...stylex.props(canvasStyles.shotChip)}>{t('artboard.frame.realShot')}</div>
        )}
        {s.busy && (
          <div {...stylex.props(canvasStyles.busy)}>
            <Icon spin icon={Loader2Icon} />
            {t('artboard.frame.busy')}
          </div>
        )}
      </div>
    </div>
  );
};

export default FrameNode;
