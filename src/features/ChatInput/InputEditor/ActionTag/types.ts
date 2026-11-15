/**
 * Action tag architecture:
 *
 * 1. Command      — Built-in, line-start only (slash menu), executed client-side before send
 * 2. Skill        — Skill package, inserted via @ mention, preloaded before execution
 * 3. Tool         — Explicit tool selection, inserted via @ mention, context injected directly
 * 4. ProjectSkill — Filesystem skill discovered from the project or execution device,
 *                   inserted via slash menu. The runtime already lists it in
 *                   `<available_skills>`, so it serializes as a `<skill>` tag.
 * 5. AgentSkill   — Agent-document skill bundle from `agentDocumentService`; the runtime
 *                   resolves the chip's identifier (`agent-document:<filename>`) against
 *                   the agent's document store at preload time.
 * 6. CliSkill     — A skill the heterogeneous CLI itself expands from a message
 *                   that starts with `/name` (agy's builtin, global and plugin
 *                   skills). It is not in the runtime registry, so the chip
 *                   serializes back to that literal prefix.
 */
export type ActionTagCategory =
  'command' | 'skill' | 'tool' | 'projectSkill' | 'agentSkill' | 'cliSkill';

// Built-in commands: client-side intercepted, never sent to AI.
// `goal` is the exception — it has no client handler; it serializes back to the
// literal `/goal ` prefix the runtime keys off (see `isGoalPrompt`), and exists
// as a tag so the marker is structured in `editorData` instead of being a
// hidden send-time string.
export type CommandType = 'compact' | 'newTopic' | 'goal';

/**
 * The action-tag type carrying the "this message opens a goal" marker.
 *
 * It lives here, in the leaf module of this folder, rather than next to
 * `insertGoalTag`: the chip renderer, the node, the markdown writer and the
 * slash menu all need it, and importing it from `goalTag` closed the cycle
 * `ActionMention → goalTag → ActionTagNode → ActionMention`, which crashed the
 * SPA at boot with a TDZ `Cannot access 'GOAL_COMMAND_TYPE' before
 * initialization`.
 */
export const GOAL_COMMAND_TYPE = 'goal';

// Skills use dynamic identifiers from agent config (plugin/tool identifiers)
export type SkillType = string & {};

export type ActionTagType = CommandType | SkillType;

export interface ActionTagData {
  category: ActionTagCategory;
  description?: string;
  icon?: string;
  label: string;
  type: ActionTagType;
}

// Built-in commands — line-start only, client-side execution
export const BUILTIN_COMMANDS: ActionTagData[] = [
  { category: 'command', label: 'newTopic', type: 'newTopic' },
  { category: 'command', label: 'compact', type: 'compact' },
];
