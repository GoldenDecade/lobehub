import { Avatar, Button, Center, Flexbox, Icon, Text } from '@lobehub/ui';
import { cssVar } from '@lobehub/ui/stylex/cssVar.stylex';
import * as stylex from '@stylexjs/stylex';
import {
  BotIcon,
  CheckIcon,
  CircleDashedIcon,
  FileTextIcon,
  FolderGit2Icon,
  GlobeIcon,
  Loader2Icon,
  TriangleAlertIcon,
  UploadIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { sx } from '@/styles/sx';

import type { ScreenProps } from '../../types';
import Shell from './Shell';
import { screenStyles } from './styles';

export const SOURCES = [
  { desc: '读取代码和 README', icon: FolderGit2Icon, key: 'repo', title: '代码仓库' },
  { desc: 'PDF、Markdown、Word', icon: FileTextIcon, key: 'doc', title: '文档' },
  { desc: '帮助中心、博客链接', icon: GlobeIcon, key: 'web', title: '网页' },
];

export const ScreenEmpty = ({ onAction }: ScreenProps) => (
  <Shell>
    <Center gap={12} height={'100%'}>
      <Center height={56} width={56} {...stylex.props(screenStyles.emptyIcon)}>
        <Icon icon={FolderGit2Icon} size={28} />
      </Center>
      <Text strong style={{ fontSize: 16 }}>
        这个项目还没有资料
      </Text>
      <Text style={{ maxWidth: 360, textAlign: 'center' }} type="secondary">
        接入代码仓库、文档或网页，Agent 会先读懂资料，再开始帮你干活。
      </Text>
      <Flexbox horizontal gap={8} style={{ marginTop: 4 }}>
        <Button type="primary" onClick={() => onAction?.('next')}>
          接入资料
        </Button>
        <Button>看看示例项目</Button>
      </Flexbox>
    </Center>
  </Shell>
);

export const ScreenSources = ({ onAction, rev = 1, real }: ScreenProps) => {
  const [picked, setPicked] = useState(['repo', 'doc']);
  const toggle = (key: string) =>
    setPicked((p) => (p.includes(key) ? p.filter((x) => x !== key) : [...p, key]));
  return (
    <Shell>
      <Flexbox gap={16} height={'100%'}>
        <Flexbox gap={2}>
          <Text strong style={{ fontSize: 15 }}>
            接入资料
          </Text>
          <Text type="secondary">选一种或几种，之后还能随时补充。</Text>
        </Flexbox>
        <Flexbox horizontal gap={12}>
          {SOURCES.map((s) => {
            const on = picked.includes(s.key);
            return (
              <Flexbox
                gap={8}
                key={s.key}
                onClick={() => toggle(s.key)}
                {...stylex.props(screenStyles.sourceCard, on && screenStyles.sourceCardOn)}
              >
                <Flexbox horizontal align="center" justify="space-between">
                  <Icon icon={s.icon} size={20} />
                  {on && <Icon color={cssVar.colorPrimary} icon={CheckIcon} size={16} />}
                </Flexbox>
                <Text strong>{s.title}</Text>
                <Text style={{ fontSize: 12 }} type="secondary">
                  {s.desc}
                </Text>
              </Flexbox>
            );
          })}
        </Flexbox>
        <Flexbox horizontal align="center" gap={8} style={{ marginTop: 'auto' }}>
          <Text type="secondary">已选 {picked.length} 项</Text>
          <div style={{ flex: 1 }} />
          {rev > 1 && <Button type="text">稍后再接入</Button>}
          <Button disabled={!picked.length} type="primary" onClick={() => onAction?.('next')}>
            {real ? '下一步' : '开始读取'}
          </Button>
        </Flexbox>
      </Flexbox>
    </Shell>
  );
};

const READING_ROWS = [
  { icon: FolderGit2Icon, label: '代码仓库', state: 'done', status: '已读取 312 个文件' },
  { icon: FileTextIcon, label: '文档', state: 'busy', status: '解析中 18 / 40' },
  { icon: GlobeIcon, label: '网页', state: 'wait', status: '排队中' },
] as const;

export const ScreenReading = ({ onAction, playing }: ScreenProps) => {
  const [pct, setPct] = useState(playing ? 20 : 62);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setPct((p) => Math.min(100, p + 16)), 450);
    return () => clearInterval(timer);
  }, [playing]);
  useEffect(() => {
    if (playing && pct >= 100) onAction?.('next');
  }, [pct, playing, onAction]);
  return (
    <Shell>
      <Flexbox gap={14} height={'100%'}>
        <Flexbox gap={2}>
          <Text strong style={{ fontSize: 15 }}>
            正在读取资料
          </Text>
          <Text type="secondary">大约还要 2 分钟。可以先离开这个页面，读完会通知你。</Text>
        </Flexbox>
        <Flexbox gap={6}>
          <div {...stylex.props(screenStyles.bar)}>
            <div {...sx(screenStyles.barFill, undefined, { width: `${pct}%` })} />
          </div>
          <Text style={{ fontSize: 12 }} type="secondary">
            {pct}%
          </Text>
        </Flexbox>
        <Flexbox>
          {READING_ROWS.map((r) => (
            <Flexbox
              horizontal
              align="center"
              gap={10}
              key={r.label}
              {...stylex.props(screenStyles.row)}
            >
              <Icon icon={r.icon} size={16} />
              <Text style={{ flex: 1 }}>{r.label}</Text>
              <Text style={{ fontSize: 12 }} type="secondary">
                {r.status}
              </Text>
              {r.state === 'done' && (
                <Icon color={cssVar.colorSuccess} icon={CheckIcon} size={14} />
              )}
              {r.state === 'busy' && <Icon spin icon={Loader2Icon} size={14} />}
              {r.state === 'wait' && <Icon icon={CircleDashedIcon} size={14} />}
            </Flexbox>
          ))}
        </Flexbox>
        {playing && (
          <Flexbox horizontal style={{ marginTop: 'auto' }}>
            <Button size="small" type="dashed" onClick={() => onAction?.('fail')}>
              模拟解析失败
            </Button>
          </Flexbox>
        )}
      </Flexbox>
    </Shell>
  );
};

export const ScreenFailed = ({ onAction }: ScreenProps) => (
  <Shell>
    <Flexbox gap={14} height={'100%'}>
      <Text strong style={{ fontSize: 15 }}>
        有 1 份资料没读成功
      </Text>
      <Flexbox horizontal gap={10} {...stylex.props(screenStyles.danger)}>
        <Icon color={cssVar.colorError} icon={TriangleAlertIcon} size={18} />
        <Flexbox gap={2}>
          <Text strong>《API 参考.pdf》设置了打开密码</Text>
          <Text style={{ fontSize: 12 }} type="secondary">
            去掉密码后重新上传，或者先跳过它。其余 2 份资料已经读完。
          </Text>
        </Flexbox>
      </Flexbox>
      <Flexbox horizontal gap={8} style={{ marginTop: 'auto' }}>
        <Button icon={UploadIcon} type="primary" onClick={() => onAction?.('retry')}>
          重新上传
        </Button>
        <Button onClick={() => onAction?.('skip')}>跳过这份</Button>
      </Flexbox>
    </Flexbox>
  </Shell>
);

const NEXT_TASKS = ['梳理 API 文档结构', '找出过期的示例代码', '写一份新手指南大纲'];

export const ScreenDone = () => (
  <Shell>
    <Flexbox gap={14} height={'100%'}>
      <Flexbox horizontal align="center" gap={10}>
        <Avatar avatar={<Icon icon={BotIcon} />} background={cssVar.colorFillSecondary} size={32} />
        <Flexbox gap={2}>
          <Text strong>资料读完了</Text>
          <Text style={{ fontSize: 12 }} type="secondary">
            312 个文件 · 40 篇文档 · 12 个网页
          </Text>
        </Flexbox>
      </Flexbox>
      <Text type="secondary">可以从这几件事开始：</Text>
      <Flexbox horizontal gap={10}>
        {NEXT_TASKS.map((task) => (
          <Flexbox gap={6} key={task} {...stylex.props(screenStyles.task)}>
            <Text strong>{task}</Text>
            <Text style={{ fontSize: 12 }} type="secondary">
              约 5 分钟
            </Text>
          </Flexbox>
        ))}
      </Flexbox>
    </Flexbox>
  </Shell>
);
