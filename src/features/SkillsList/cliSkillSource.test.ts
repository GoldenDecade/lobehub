import { describe, expect, it } from 'vitest';

import { isCliSlashSkillSource, resolveCliSkillAgentType } from './cliSkillSource';

describe('isCliSlashSkillSource', () => {
  it('matches Antigravity and Claude Code CLI skill sources', () => {
    expect(isCliSlashSkillSource('antigravity-builtin')).toBe(true);
    expect(isCliSlashSkillSource('antigravity-global')).toBe(true);
    expect(isCliSlashSkillSource('antigravity-plugin')).toBe(true);
    expect(isCliSlashSkillSource('claude-code-builtin')).toBe(true);
    expect(isCliSlashSkillSource('claude-code-plugin')).toBe(true);
  });

  it('rejects shared filesystem and undefined sources', () => {
    expect(isCliSlashSkillSource('.agents/skills')).toBe(false);
    expect(isCliSlashSkillSource('.claude/skills')).toBe(false);
    expect(isCliSlashSkillSource('.codex/skills')).toBe(false);
    expect(isCliSlashSkillSource(undefined)).toBe(false);
  });
});

describe('resolveCliSkillAgentType', () => {
  it('returns antigravity for antigravity providers', () => {
    expect(resolveCliSkillAgentType({ type: 'antigravity' })).toBe('antigravity');
  });

  it('returns claude-code for subscription, API-bound, and default Claude Code providers', () => {
    expect(resolveCliSkillAgentType({ type: 'claude-code' })).toBe('claude-code');
    expect(resolveCliSkillAgentType({ authMode: 'subscription', type: 'claude-code' })).toBe(
      'claude-code',
    );
    expect(resolveCliSkillAgentType({ authMode: 'api', type: 'claude-code' })).toBe('claude-code');
  });

  it('returns undefined for other providers', () => {
    expect(resolveCliSkillAgentType({ type: 'codex' })).toBeUndefined();
    expect(resolveCliSkillAgentType(undefined)).toBeUndefined();
  });
});
