import { LOBEHUB_CLI_GUIDE_CONTEXT, lobeHubCliGuide } from './lobeHubCliGuide';
import type { AgentContentBlock, AgentImageBlock } from './types';

export interface HeterogeneousPromptEngineInput {
  imageList?: HeterogeneousPromptImage[];
  /**
   * Whether this prompt opens a fresh agent session rather than continuing one
   * the CLI resumes natively. Dispatch sites derive it from their own resume
   * state (`!resumeSessionId`) — the engine cannot see it.
   *
   * Session-scoped context (the `lh` guide) is attached only when true: these
   * blocks are prepended to a USER message, so on a resumed session every
   * earlier turn's copy is still in the CLI's transcript. Re-sending it each
   * turn would stack duplicates for the whole life of the conversation. An
   * executor that loads the guide as a native skill instead (Claude Code, see
   * `spawn/lobeHubCliPlugin`) drops this copy and delivers it every turn, so
   * the gaps below do not apply there.
   *
   * Rollout consequence, accepted deliberately: a conversation that already had
   * a CLI session before this shipped resumes into a transcript that never saw
   * the guide, and keeps resuming without it. Delivering it there needs
   * per-session "has this been delivered" state rather than this flag. The gap
   * self-heals whenever the native session does not survive — transcript GC
   * (30 days), a changed cwd, a recycled sandbox — because every one of those
   * falls back to a fresh session, and the resume-fallback prompt always
   * carries the guide.
   */
  isNewSession?: boolean;
  prompt: string;
  systemContext?: string;
}

export interface HeterogeneousPromptImage {
  id?: string;
  url: string;
}

export interface HeterogeneousPromptContextProvider {
  /** Stamped onto the provider's block as `AgentTextBlock.context`. */
  context?: string;
  getContext: (input: HeterogeneousPromptEngineInput) => string | undefined;
  name: string;
}

const topicReferenceGuidanceProvider: HeterogeneousPromptContextProvider = {
  getContext: ({ prompt }) => {
    if (!prompt.includes('<refer_topic') && !prompt.includes('\\<refer\\_topic')) return;

    return [
      '## Referenced topics',
      'The user message contains one or more `<refer_topic>` tags. When you need the conversation from a referenced topic, retrieve it with `lh topic view <topic-id>` using the `id` from the tag.',
    ].join('\n');
  },
  name: 'TopicReferenceGuidanceProvider',
};

/**
 * Teach the agent that the LobeHub platform is reachable from its own shell.
 * Session-scoped: see `isNewSession`.
 */
const lobeHubCliProvider: HeterogeneousPromptContextProvider = {
  context: LOBEHUB_CLI_GUIDE_CONTEXT,
  getContext: ({ isNewSession }) => (isNewSession ? lobeHubCliGuide : undefined),
  name: 'LobeHubCliProvider',
};

const defaultContextProviders = [lobeHubCliProvider, topicReferenceGuidanceProvider];

/**
 * A CLI slash invocation only expands when it is the first thing in the
 * message. agy (Antigravity) has no plugin-dir to deliver the `lh` guide
 * through, so that guide is prepended as text — which would push `/swarm` off
 * the start and leave it unexpanded. Hoist one leading invocation back in
 * front; the guide follows it.
 *
 * Only a single leading token of the user's own text is hoisted. A slash later
 * in the message, or a message that is only the guide, is left untouched.
 */
const LEADING_SLASH_INVOCATION = /^(\/[A-Za-z0-9_.-]+(?::[A-Za-z0-9_.-]+)?)(?=$|\s)/;

export function hoistLeadingSlashInvocation(blocks: AgentContentBlock[]): AgentContentBlock[] {
  const firstText = blocks.findIndex((block) => block.type === 'text' && block.text.length > 0);
  if (firstText === -1) return blocks;

  // The user's text is the last block; the earlier ones are context prepended
  // by the engine. Walking backwards is what makes that distinction hold when
  // more than one context block precedes it.
  let userText = -1;
  for (let index = blocks.length - 1; index > firstText; index -= 1) {
    const block = blocks[index];
    if (block.type === 'text' && block.text.length > 0) {
      userText = index;
      break;
    }
  }
  if (userText === -1) return blocks;

  const userBlock = blocks[userText];
  if (userBlock.type !== 'text') return blocks;

  const match = LEADING_SLASH_INVOCATION.exec(userBlock.text);
  if (!match) return blocks;

  const invocation = match[1];
  const remainder = userBlock.text.slice(invocation.length).replace(/^\s+/, '');
  const hoisted = blocks.map((block, index) =>
    index === userText ? { ...block, text: remainder } : block,
  );
  if (!remainder) hoisted.splice(userText, 1);

  return [{ text: invocation, type: 'text' }, ...hoisted];
}

/**
 * Builds the semantic prompt shared by every heterogeneous-agent transport.
 * Providers add LobeHub context before the user message; CLI-specific wire
 * serialization remains the responsibility of `buildAgentInput`.
 */
export class HeterogeneousPromptEngine {
  constructor(
    private input: HeterogeneousPromptEngineInput,
    private contextProviders: HeterogeneousPromptContextProvider[] = defaultContextProviders,
  ) {}

  process(): AgentContentBlock[] {
    const blocks: AgentContentBlock[] = [];
    const { imageList = [], prompt, systemContext } = this.input;

    if (systemContext?.trim()) blocks.push({ text: systemContext.trim(), type: 'text' });

    for (const provider of this.contextProviders) {
      const text = provider.getContext(this.input)?.trim();
      if (!text) continue;
      blocks.push({ ...(provider.context && { context: provider.context }), text, type: 'text' });
    }

    if (prompt) blocks.push({ text: prompt, type: 'text' });

    return [
      ...hoistLeadingSlashInvocation(blocks),
      ...imageList.map(({ id, url }): AgentImageBlock => ({
        source: { id, type: 'url', url },
        type: 'image',
      })),
    ];
  }
}

export const buildHeterogeneousPrompt = (
  input: HeterogeneousPromptEngineInput,
): AgentContentBlock[] => new HeterogeneousPromptEngine(input).process();
