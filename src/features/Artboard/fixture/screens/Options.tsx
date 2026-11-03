import { Avatar, Button, Center, Flexbox, Icon, Text } from '@lobehub/ui';
import { cssVar } from '@lobehub/ui/stylex/cssVar.stylex';
import * as stylex from '@stylexjs/stylex';
import { BotIcon } from 'lucide-react';

import { sx } from '@/styles/sx';

import type { ScreenProps } from '../../types';
import { SOURCES } from './Journey';
import Shell from './Shell';
import { screenStyles } from './styles';

const WIZARD_STEPS = ['选择来源', '授权', '读取'];

export const OptionWizard = () => (
  <Shell>
    <Flexbox gap={18}>
      <Flexbox horizontal align="center" gap={10}>
        {WIZARD_STEPS.map((step, i) => (
          <Flexbox horizontal align="center" gap={6} key={step}>
            <div
              {...stylex.props(
                screenStyles.stepNum,
                i === 0 ? screenStyles.stepNumOn : screenStyles.stepNumOff,
              )}
            >
              {i + 1}
            </div>
            <Text type={i === 0 ? undefined : 'secondary'}>{step}</Text>
            {i < WIZARD_STEPS.length - 1 && <Text type="secondary">—</Text>}
          </Flexbox>
        ))}
      </Flexbox>
      <div {...sx(screenStyles.wire, undefined, { height: 150 })} />
      <Flexbox horizontal justify="flex-end">
        <Button type="primary">下一步</Button>
      </Flexbox>
    </Flexbox>
  </Shell>
);

export const OptionCards = ({ rev = 1 }: ScreenProps) => (
  <Shell>
    <Flexbox gap={14}>
      <Text strong style={{ fontSize: 15 }}>
        给项目接入资料
      </Text>
      <Flexbox horizontal gap={12}>
        {SOURCES.map((s) => (
          <Flexbox gap={8} key={s.key} {...stylex.props(screenStyles.sourceCard)}>
            <Icon icon={s.icon} size={20} />
            <Text strong>{s.title}</Text>
            <Text style={{ fontSize: 12 }} type="secondary">
              {s.desc}
            </Text>
          </Flexbox>
        ))}
      </Flexbox>
      {rev > 1 && (
        <Text style={{ fontSize: 12 }} type="secondary">
          也可以先跳过，直接从空项目开始。
        </Text>
      )}
    </Flexbox>
  </Shell>
);

const CHAT_CHIPS = ['GitHub 仓库', '上传文档', '贴网页链接', '先随便聊聊'];

export const OptionChat = () => (
  <Shell>
    <Flexbox gap={12}>
      <Flexbox horizontal gap={8}>
        <Avatar avatar={<Icon icon={BotIcon} />} background={cssVar.colorFillSecondary} size={28} />
        <div {...stylex.props(screenStyles.bubble)}>
          你好，我是这个项目的 Agent。先告诉我资料放在哪里，我读完就能开始干活。
        </div>
      </Flexbox>
      <Flexbox horizontal gap={8} style={{ paddingInlineStart: 36 }} wrap={'wrap'}>
        {CHAT_CHIPS.map((chip) => (
          <span key={chip} {...stylex.props(screenStyles.chip)}>
            {chip}
          </span>
        ))}
      </Flexbox>
    </Flexbox>
  </Shell>
);

export const RefCurrent = () => (
  <Shell title="LobeHub（现状截图）">
    <Flexbox gap={10}>
      <div {...sx(screenStyles.wire, undefined, { height: 28, width: 220 })} />
      <Flexbox horizontal gap={10}>
        <div {...sx(screenStyles.wire, undefined, { flex: 1, height: 90 })} />
        <div {...sx(screenStyles.wire, undefined, { flex: 1, height: 90 })} />
      </Flexbox>
      <Center gap={4} {...sx(screenStyles.wire, undefined, { height: 120 })}>
        <Text type="secondary">暂无内容</Text>
      </Center>
    </Flexbox>
  </Shell>
);

const SKETCH_BOXES: [number, string][] = [
  [40, '空项目'],
  [190, '接入'],
  [340, '读取'],
  [490, '完成'],
];

export const RefSketch = () => (
  <div {...stylex.props(screenStyles.screen)}>
    <svg fill="none" height="400" viewBox="0 0 640 400" width="640">
      {SKETCH_BOXES.map(([x, label]) => (
        <g key={label}>
          <rect
            height="70"
            rx="10"
            stroke={cssVar.colorTextSecondary}
            strokeDasharray="6 4"
            strokeWidth="2"
            width="110"
            x={x}
            y="140"
          />
          <text
            fill={cssVar.colorTextSecondary}
            fontSize="16"
            textAnchor="middle"
            x={x + 55}
            y="181"
          >
            {label}
          </text>
        </g>
      ))}
      {[150, 300, 450].map((x) => (
        <path
          d={`M${x + 2} 175 L${x + 36} 175`}
          key={x}
          stroke={cssVar.colorTextSecondary}
          strokeWidth="2"
        />
      ))}
      <path
        d="M395 210 C395 290 245 290 245 212"
        stroke={cssVar.colorError}
        strokeDasharray="5 4"
        strokeWidth="2"
      />
      <text fill={cssVar.colorError} fontSize="14" x="268" y="300">
        失败了回到这里？
      </text>
      <text fill={cssVar.colorTextTertiary} fontSize="13" x="40" y="60">
        白板照片 · 10 月 23 日讨论
      </text>
    </svg>
  </div>
);
