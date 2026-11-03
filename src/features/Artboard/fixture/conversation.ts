import type { ChatMessage, CheckResult } from '../types';
import { ARROWS, CHECKS } from './board';

export const OPENING_USER: Omit<ChatMessage, 'id'> = {
  role: 'user',
  text: '新用户第一次进项目首页，不知道该干嘛。想做个 onboarding：让他接入代码仓库、文档、网页，读完给一份摘要。',
};

export const BOARD_CARD = {
  desc: '用户旅程 5 · 首屏方案 3 · 参考资料 2 · 待确认 2',
  type: 'board' as const,
};

export const ACCEPTANCE_CARD = {
  desc: `${CHECKS.length} 个检查项 · ${ARROWS.length} 条路径 · 基线是用户旅程定稿版`,
  type: 'acceptance' as const,
};

export const SEED_MESSAGES: ChatMessage[] = [
  OPENING_USER,
  {
    card: BOARD_CARD,
    role: 'agent' as const,
    text: '我开了一块画板：先把用户旅程拆成 5 个页面状态，箭头上写用户操作；首屏出了三种做法，推荐 B。你贴的现状截图和白板照片也放上去了。',
  },
  { quote: 'o-b', role: 'user' as const, text: '首屏补一句可以跳过，不想接资料的人别卡在这里。' },
  { role: 'agent' as const, text: '在 B 的卡片下加了「也可以先跳过」，o-b 更新到 v2。' },
  { quote: 'j-3', role: 'user' as const, text: '读取要多久？给个预估时间。' },
  {
    role: 'agent' as const,
    text: 'j-3 加上了「大约还要 2 分钟」，并说明可以离开页面。\n还有 2 个问题得你来定，我贴成黄色便签放在参考资料右边。都定下来就能定稿，定稿后用户旅程直接变成验收。',
  },
].map((m, i) => ({ ...m, id: `seed-${i}` }));

export const SEED_REVS: Record<string, number> = { 'j-3': 2, 'o-b': 2 };

export const AGENT_LINES = {
  boardDone:
    '摆好了。用户旅程可以点「试用旅程」走一遍；首屏我推荐 B。\n有 2 个问题得你来定，我贴成黄色便签了。都定下来就能定稿，定稿后用户旅程直接变成验收。',
  boardOpen: '我开一块画板把它摆出来：先拆用户旅程，每个页面状态一个 frame，箭头上写用户做了什么。',
  filled:
    '开发说做完了，我按验收 flow 走了一遍：3 条通过，1 条没通过，1 条没法验。\n· c-2（j-2）按钮文案是「下一步」，定稿里是「开始读取」\n· c-5（j-4）读取完成页还没开发\n画板上红色的就是没通过的那一步，点开能看定稿和真实截图的对比。',
  finalized:
    '定稿了。用户旅程的 5 个页面状态变成 5 个检查项，箭头变成验收 flow。画板上这一组已经锁住，每个页面标签上能看到它对应的检查项。\n开发完成后，我会按这条 flow 走一遍，截真实截图回填。',
  generic: '收到，我补到画板上。想改具体哪一块，先在画板上点选它，我就知道改哪里。',
  options: '首屏怎么引导，我出三种做法放在一起比。',
  userRefs: '现在首页长这样（截图），这是昨天白板上画的（照片）。',
};

export const AGENT_REPLIES = {
  decidedInChat: (text: string) => `好，按你说的定下来，便签改成已定：${text}`,
  lockedChange: (frameId: string) =>
    `用户旅程已经定稿，${frameId} 是验收基线的一部分。这条我记成变更，不直接改画板；等这一轮验收结束，再一起重新定稿。`,
  rejected: (checkId: string) => `已打回 ${checkId}。修好后我重新截图，这条进入第 2 轮。`,
  resolved: (note: string, left: number) =>
    left
      ? `记下了，「${note}」的便签改成已定。还剩 ${left} 个待定。`
      : '记下了。待定的问题都定了，可以定稿了。',
  revised: (frameId: string, rev: number) => `改好了，${frameId} 更新到 v${rev}。`,
};

export const REVIEW_LINES = {
  recheck: '这条我不认，重验。',
  rejectFailed: '打回，按定稿改。',
};

export const PENDING_RESULTS: Record<string, CheckResult> = Object.fromEntries(
  CHECKS.map((c) => [c.frame, { status: 'pending' }]),
);

export const FILLED_RESULTS: Record<string, CheckResult> = {
  'j-1': { obs: '首屏能看到「接入资料」入口，和定稿一致。', shot: true, status: 'passed' },
  'j-2': { obs: '按钮文案是「下一步」，定稿里是「开始读取」。', shot: true, status: 'failed' },
  'j-3': { obs: '有进度和预计时间；离开页面再回来，进度还在。', shot: true, status: 'passed' },
  'j-4': { obs: '读取完成页还没开发，走到这一步没有页面可截。', shot: false, status: 'pending' },
  'j-5': { obs: '失败原因写清楚了，重新上传和跳过都走得通。', shot: true, status: 'passed' },
};
