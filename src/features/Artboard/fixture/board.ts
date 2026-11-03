import type { BoardArrow, BoardFrame, BoardGroup, BoardNote } from '../types';

// Canvas/styles.ts repeats these as literals: StyleX only compiles static values.
export const FRAME_W = 640;
export const FRAME_H = 400;
export const JOURNEY_GROUP = 'g1';

export const FRAMES: BoardFrame[] = [
  { group: 'g1', id: 'j-1', interactive: true, screen: 'ScreenEmpty', title: '空项目', x: 0, y: 0 },
  {
    group: 'g1',
    id: 'j-2',
    interactive: true,
    screen: 'ScreenSources',
    title: '接入资料',
    x: 840,
    y: 0,
  },
  {
    group: 'g1',
    id: 'j-3',
    interactive: true,
    screen: 'ScreenReading',
    title: '读取中',
    x: 1680,
    y: 0,
  },
  {
    group: 'g1',
    id: 'j-4',
    interactive: true,
    screen: 'ScreenDone',
    title: '读取完成',
    x: 2520,
    y: 0,
  },
  {
    group: 'g1',
    id: 'j-5',
    interactive: true,
    screen: 'ScreenFailed',
    title: '读取失败',
    x: 1680,
    y: 600,
  },
  { group: 'g2', id: 'o-a', screen: 'OptionWizard', title: 'A · 分步向导', x: 0, y: 1360 },
  {
    group: 'g2',
    id: 'o-b',
    recommended: true,
    screen: 'OptionCards',
    title: 'B · 来源卡片',
    x: 720,
    y: 1360,
  },
  { group: 'g2', id: 'o-c', screen: 'OptionChat', title: 'C · 对话引导', x: 1440, y: 1360 },
  { group: 'g3', id: 'r-1', image: true, screen: 'RefCurrent', title: '现状截图', x: 0, y: 2120 },
  { group: 'g3', id: 'r-2', image: true, screen: 'RefSketch', title: '白板照片', x: 720, y: 2120 },
];

export const GROUPS: BoardGroup[] = [
  { desc: '每个 frame 是一个页面状态，箭头上写用户操作', id: 'g1', title: '用户旅程' },
  { desc: '同一个首屏的三种做法', id: 'g2', title: '首屏方案' },
  { desc: '讨论时贴进来的截图和照片', id: 'g3', title: '参考资料' },
];

export const ARROWS: BoardArrow[] = [
  { d: 'M640 200 H840', from: 'j-1', label: '点「接入资料」', lx: 740, ly: 200, to: 'j-2' },
  { d: 'M1480 200 H1680', from: 'j-2', label: '点「开始读取」', lx: 1580, ly: 200, to: 'j-3' },
  { d: 'M2320 200 H2520', from: 'j-3', label: '全部读完', lx: 2420, ly: 200, to: 'j-4' },
  { d: 'M2000 400 V600', from: 'j-3', label: '有资料读不了', lx: 2000, ly: 500, to: 'j-5' },
  { d: 'M1680 800 H1160 V400', from: 'j-5', label: '重新上传', lx: 1420, ly: 800, to: 'j-2' },
  { d: 'M2320 800 H2840 V400', from: 'j-5', label: '跳过这份', lx: 2580, ly: 800, to: 'j-4' },
];

export const NOTES: BoardNote[] = [
  { id: 'n-title', kind: 'title', text: '项目首页 Onboarding', x: 0, y: -440 },
  {
    id: 'n-goal',
    kind: 'subtitle',
    text: '需求：新用户第一次进入项目，30 秒内知道要接入什么资料、要等多久、出错了怎么办。',
    x: 0,
    y: -350,
  },
  {
    id: 's-1',
    kind: 'sticky',
    text: '推荐 B：三种来源并排摆出来，首屏就看得懂要做什么，也不用先读一段对话。',
    tone: 'good',
    w: 300,
    x: 2208,
    y: 1360,
  },
  {
    id: 's-2',
    kind: 'sticky',
    pending: true,
    suggest: '可以跳过。跳过后进入空项目，首页保留「接入资料」入口。',
    text: '接入资料这一步能不能跳过？',
    w: 300,
    x: 1488,
    y: 2120,
  },
  {
    id: 's-3',
    kind: 'sticky',
    pending: true,
    suggest: '保留已读完的资料，只让用户补传失败的那一份。',
    text: '读取失败时，已经上传的其他资料要保留吗？',
    w: 300,
    x: 1488,
    y: 2330,
  },
];

export const JOURNEY_ORDER = ['j-1', 'j-2', 'j-3', 'j-5', 'j-4'];

export const PLAY_NEXT: Record<string, Partial<Record<string, string>>> = {
  'j-1': { next: 'j-2' },
  'j-2': { next: 'j-3' },
  'j-3': { fail: 'j-5', next: 'j-4' },
  'j-5': { retry: 'j-2', skip: 'j-4' },
};

export const frameById: Record<string, BoardFrame> = Object.fromEntries(
  FRAMES.map((f) => [f.id, f]),
);
export const noteById: Record<string, BoardNote> = Object.fromEntries(NOTES.map((n) => [n.id, n]));
export const PENDING_NOTES = NOTES.filter((n) => n.pending);
export const ALL_ITEM_IDS = [...FRAMES.map((f) => f.id), ...NOTES.map((n) => n.id)];

export interface Rect {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
}

export const CONTENT_BOUNDS: Rect = { maxX: 3208, maxY: 2620, minX: -48, minY: -460 };

export const groupRect = (groupId: string) => {
  const frames = FRAMES.filter((f) => f.group === groupId);
  const minX = Math.min(...frames.map((f) => f.x));
  const minY = Math.min(...frames.map((f) => f.y));
  const maxX = Math.max(...frames.map((f) => f.x)) + FRAME_W;
  const maxY = Math.max(...frames.map((f) => f.y)) + FRAME_H;
  return { h: maxY - minY + 112, w: maxX - minX + 96, x: minX - 48, y: minY - 64 };
};
