import type { ListProjectSkillsResult } from '@lobechat/electron-client-ipc';
import type { HeterogeneousProviderConfig } from '@lobechat/types';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSlashActionItems } from './useSlashActionItems';

const state = vi.hoisted(() => ({
  /** `undefined`: the host publishes no topic; `null`: its conversation has none. */
  composerTopicId: undefined as string | null | undefined,
  heterogeneousProvider: { type: 'codex' } as HeterogeneousProviderConfig,
  projectSkillsResult: undefined as ListProjectSkillsResult | undefined,
  useFetchProjectSkills: vi.fn(() => ({ data: undefined })),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/ChatInput/store', () => ({
  useChatInputStore: (selector: (s: object) => unknown) =>
    selector({ agentId: 'agent-1', editor: undefined, topicId: state.composerTopicId }),
}));

vi.mock('@/helpers/gatewayMode', () => ({ useIsGatewayModeEnabled: () => true }));

// The main column's topic runs in the cloud sandbox; the side-by-side pane's
// topic is pinned to a device.
vi.mock('@/hooks/useEffectiveAgencyConfig', () => ({
  useEffectiveAgencyConfig: (_agentId: string, options?: { topicId?: string | null }) => ({
    agencyConfig:
      options?.topicId === 'pane-topic'
        ? {
            boundDeviceId: 'pane-device',
            executionTarget: 'device',
            heterogeneousProvider: state.heterogeneousProvider,
          }
        : { executionTarget: 'sandbox', heterogeneousProvider: state.heterogeneousProvider },
    workspaceScoped: false,
  }),
}));

vi.mock('@/hooks/useEffectiveWorkingDirectory', () => ({
  useEffectiveWorkingDirectory: () => '/repo/pane',
}));

vi.mock('@/store/agent', () => ({
  useAgentStore: (selector: (s: object) => unknown) => selector({ agentMap: {} }),
}));

vi.mock('@/store/agent/selectors', () => ({
  agentByIdSelectors: {
    getAgencyConfigById: () => () => ({ executionTarget: 'sandbox' }),
    isAgentHeterogeneousById: () => () => true,
    isWorkspaceAgentById: () => () => false,
  },
}));

vi.mock('@/store/chat', () => ({
  useChatStore: (selector: (s: object) => unknown) => selector({ activeTopicId: 'main-topic' }),
}));

vi.mock('@/store/tool', () => ({
  useToolStore: (selector: (s: object) => unknown) =>
    selector({
      useFetchAgentDocumentSkills: () => undefined,
      useFetchProjectSkills: state.useFetchProjectSkills,
    }),
}));

vi.mock('@/store/tool/selectors', () => ({
  agentDocumentSkillsSelectors: { getAgentDocumentSkills: () => () => [] },
  projectSkillsSelectors: { getProjectSkills: () => () => state.projectSkillsResult },
}));

vi.mock('./useInstalledSkillsAndTools', () => ({ useInstalledSkillsAndTools: () => [] }));

beforeEach(() => {
  state.composerTopicId = undefined;
  state.heterogeneousProvider = { type: 'codex' };
  state.projectSkillsResult = undefined;
  state.useFetchProjectSkills.mockClear();
});

describe('useSlashActionItems · project skills', () => {
  it("scans project skills on the device the composer's own topic is pinned to", () => {
    state.composerTopicId = 'pane-topic';

    renderHook(() => useSlashActionItems());

    expect(state.useFetchProjectSkills).toHaveBeenLastCalledWith(
      '/repo/pane',
      'pane-device',
      undefined,
    );
  });

  it('passes claude-code agentType for subscription Claude Code and maps builtin/plugin skills as cliSkill', async () => {
    state.composerTopicId = 'pane-topic';
    state.heterogeneousProvider = { type: 'claude-code' };
    state.projectSkillsResult = {
      root: '/repo/pane',
      skills: [
        {
          description: 'Design skill',
          name: 'frontend-design:frontend-design',
          path: '/home/.claude/plugins/cache/frontend-design/skills/frontend-design/SKILL.md',
          previewRoot: '/home/.claude/plugins/cache/frontend-design/skills/frontend-design',
          scope: 'device',
          skillDir: '/home/.claude/plugins/cache/frontend-design/skills/frontend-design',
          source: 'claude-code-plugin',
        },
        {
          description: 'Repeat a prompt on a recurring interval.',
          name: 'loop',
          path: '',
          previewRoot: '',
          scope: 'device',
          skillDir: 'claude-code-builtin:loop',
          source: 'claude-code-builtin',
        },
      ],
      source: 'claude-code-plugin',
    };

    const { result } = renderHook(() => useSlashActionItems());

    expect(state.useFetchProjectSkills).toHaveBeenLastCalledWith(
      '/repo/pane',
      'pane-device',
      'claude-code',
    );

    const items = await result.current(null);
    const pluginItem = items.find(
      (item: any) => item.key === 'project-skill-frontend-design:frontend-design',
    );
    expect(pluginItem).toMatchObject({
      label: 'frontend-design:frontend-design',
      metadata: {
        category: 'cliSkill',
        description: 'Design skill',
        type: 'frontend-design:frontend-design',
      },
    });
    const builtinItem = items.find((item: any) => item.key === 'project-skill-loop');
    expect(builtinItem).toMatchObject({
      label: 'loop',
      metadata: {
        category: 'cliSkill',
        description: 'Repeat a prompt on a recurring interval.',
        type: 'loop',
      },
    });
  });

  it('keeps claude-code agentType when Claude Code runs in API mode', () => {
    state.composerTopicId = 'pane-topic';
    state.heterogeneousProvider = { authMode: 'api', type: 'claude-code' };

    renderHook(() => useSlashActionItems());

    expect(state.useFetchProjectSkills).toHaveBeenLastCalledWith(
      '/repo/pane',
      'pane-device',
      'claude-code',
    );
  });
});
