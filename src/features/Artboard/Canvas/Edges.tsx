import { cssVar } from '@lobehub/ui/stylex/cssVar.stylex';

import { sx } from '@/styles/sx';

import { ARROWS } from '../fixture/board';
import { useArtboardStore } from '../store';
import type { BoardArrow, CheckResult } from '../types';
import { canvasStyles } from './styles';

interface EdgeTone {
  color: string;
  dash?: string;
  strong: boolean;
}

const toneOf = (
  arrow: BoardArrow,
  verify: boolean,
  results: Record<string, CheckResult>,
  hot: string | null,
): EdgeTone => {
  if (verify) {
    const ends = [results[arrow.from]?.status, results[arrow.to]?.status];
    if (ends.includes('failed')) return { color: cssVar.colorError, strong: true };
    if (ends.every((x) => x === 'passed')) return { color: cssVar.colorSuccess, strong: true };
    return { color: cssVar.colorTextQuaternary, dash: '8 6', strong: false };
  }
  if (hot && (arrow.from === hot || arrow.to === hot))
    return { color: cssVar.colorPrimary, strong: true };
  return { color: cssVar.colorTextTertiary, strong: false };
};

const Edges = ({ k }: { k: number }) => {
  const { hot, results, verify, visible } = useArtboardStore((s) => ({
    hot: s.mode === 'discuss' ? s.selected : null,
    results: s.results,
    verify: s.mode === 'verify',
    visible: s.visible,
  }));
  const shown = ARROWS.filter((a) => visible.includes(a.from) && visible.includes(a.to)).map(
    (a) => ({ arrow: a, tone: toneOf(a, verify, results, hot) }),
  );

  return (
    <>
      <svg
        height="1"
        width="1"
        style={{
          left: 0,
          overflow: 'visible',
          pointerEvents: 'none',
          position: 'absolute',
          top: 0,
        }}
      >
        {shown.map(({ arrow, tone }) => {
          const markerId = `artboard-edge-${arrow.from}-${arrow.to}`;
          return (
            <g key={arrow.d}>
              <defs>
                <marker
                  id={markerId}
                  markerHeight="8"
                  markerWidth="8"
                  orient="auto-start-reverse"
                  refX="8"
                  refY="4"
                  viewBox="0 0 8 8"
                >
                  <path d="M0 0 L8 4 L0 8 z" fill={tone.color} />
                </marker>
              </defs>
              <path
                d={arrow.d}
                fill="none"
                markerEnd={`url(#${markerId})`}
                stroke={tone.color}
                strokeWidth={(tone.strong ? 2.5 : 1.5) / k}
                strokeDasharray={tone.dash
                  ?.split(' ')
                  .map((v) => Number(v) / k)
                  .join(' ')}
              />
            </g>
          );
        })}
      </svg>
      {k >= 0.3 &&
        shown.map(({ arrow, tone }) => (
          <div
            key={arrow.d}
            {...sx(canvasStyles.arrowLabel, undefined, {
              borderColor: tone.strong ? tone.color : undefined,
              color: tone.strong ? tone.color : undefined,
              left: arrow.lx,
              top: arrow.ly,
              transform: `translate(-50%, -50%) scale(${1 / k})`,
            })}
          >
            {arrow.label}
          </div>
        ))}
    </>
  );
};

export default Edges;
