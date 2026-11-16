import type { HeterogeneousProviderConfig } from '@lobechat/types';

export type CliSkillAgentType = 'antigravity' | 'claude-code';

const CLI_SLASH_SKILL_SOURCES = new Set([
  'antigravity-builtin',
  'antigravity-global',
  'antigravity-plugin',
  'claude-code-builtin',
  'claude-code-plugin',
]);

/**
 * True when a scanned skill lives outside the shared `.agents` / `.claude` /
 * `.codex` directories and must be sent as a literal `/name` CLI invocation.
 */
export const isCliSlashSkillSource = (source?: string): boolean =>
  !!source && CLI_SLASH_SKILL_SOURCES.has(source);

/**
 * Which heterogeneous CLI's native skills should join the project-skills scan
 * for this provider config.
 */
export const resolveCliSkillAgentType = (
  heterogeneousProvider: Pick<HeterogeneousProviderConfig, 'authMode' | 'type'> | undefined,
): CliSkillAgentType | undefined => {
  if (!heterogeneousProvider) return undefined;
  if (heterogeneousProvider.type === 'antigravity') return 'antigravity';
  if (heterogeneousProvider.type === 'claude-code') return 'claude-code';
  return undefined;
};
