import { registerBuiltinPortals } from '@lobechat/builtin-tools/portals';
import { registerBuiltinRenders } from '@lobechat/builtin-tools/renders';
import type {
  BuiltinPortal,
  BuiltinPortalTitle,
  BuiltinRender,
  LobeBuiltinTool,
} from '@lobechat/types';

import { registerDeliverableTool } from '@/features/Conversation/Messages/AssistantGroup/toolRenderRules';
import { useToolStore } from '@/store/tool';

import BoardCard from './BoardCard';
import BoardPortal, { BoardPortalTitle } from './BoardPortal';
import { ARTBOARD_TOOL, BoardToolApiName } from './tool';

const api = (name: string) => ({
  description: '',
  name,
  parameters: { properties: {}, type: 'object' },
  renderDisplayControl: 'alwaysExpand' as const,
});

// Never offered to a model: it exists so the demo's client-only tool calls render as open cards.
const ARTBOARD_BUILTIN: LobeBuiltinTool = {
  hidden: true,
  identifier: ARTBOARD_TOOL,
  manifest: {
    api: [api(BoardToolApiName.board), api(BoardToolApiName.acceptance)],
    identifier: ARTBOARD_TOOL,
    meta: { avatar: '🎨', title: 'Artboard' },
    systemRole: '',
    type: 'builtin',
  },
  type: 'builtin',
};

let registered = false;

export const registerArtboardTool = () => {
  if (registered) return;
  registered = true;
  registerDeliverableTool(ARTBOARD_TOOL);
  registerBuiltinRenders({
    [ARTBOARD_TOOL]: {
      [BoardToolApiName.acceptance]: BoardCard as BuiltinRender,
      [BoardToolApiName.board]: BoardCard as BuiltinRender,
    },
  });
  registerBuiltinPortals({
    portals: { [ARTBOARD_TOOL]: BoardPortal as BuiltinPortal },
    titles: { [ARTBOARD_TOOL]: BoardPortalTitle as BuiltinPortalTitle },
  });
  useToolStore.setState((s) =>
    s.builtinTools.some((tool) => tool.identifier === ARTBOARD_TOOL)
      ? {}
      : { builtinTools: [...s.builtinTools, ARTBOARD_BUILTIN] },
  );
};
