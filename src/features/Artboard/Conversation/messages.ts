import type { ChatToolPayloadWithResult } from '@lobechat/types';

import { displayMessageSelectors } from '@/store/chat/slices/message/selectors';
import { useChatStore } from '@/store/chat/store';

import { ARTBOARD_TOOL, type BoardCardArgs, type BoardToolApi } from './tool';

export interface ConversationTarget {
  agentId: string;
  threadId: string | null;
  topicId: string | null;
}

export interface BoardToolCall {
  apiName: BoardToolApi;
  args: BoardCardArgs;
}

let target: ConversationTarget | null = null;
let seq = 0;

export const bindConversation = (next: ConversationTarget) => {
  target = next;
};

const nextId = (kind: string) => `artboard-${kind}-${Date.now().toString(36)}-${(seq += 1)}`;

const bucket = (t: ConversationTarget) => ({
  agentId: t.agentId,
  scope: t.threadId ? ('thread' as const) : ('main' as const),
  threadId: t.threadId,
  topicId: t.topicId,
});

const messageBase = (t: ConversationTarget) => ({
  agentId: t.agentId,
  parentId: displayMessageSelectors.lastDisplayMessageId(useChatStore.getState()) ?? undefined,
  threadId: t.threadId ?? undefined,
  topicId: t.topicId ?? undefined,
});

// Demo turns are client-only: they never reach the agent or the database, and vanish on reload.
export const postUserMessage = (content: string) => {
  if (!target) return;
  useChatStore
    .getState()
    .optimisticCreateTmpMessage(
      { ...messageBase(target), content, role: 'user' },
      { context: bucket(target), tempMessageId: nextId('user') },
    );
};

export const startAgentReply = () => {
  if (!target) return (): string | undefined => undefined;
  const t = target;
  const chat = useChatStore.getState();
  const messageId = nextId('agent');
  const { operationId } = chat.startOperation({
    context: { ...bucket(t), messageId },
    type: 'execAgentRuntime',
  });
  chat.optimisticCreateTmpMessage(
    { ...messageBase(t), content: '', role: 'assistant' },
    { operationId, tempMessageId: messageId },
  );
  chat.associateMessageWithOperation(messageId, operationId);

  return (content: string, tool?: BoardToolCall): string | undefined => {
    const store = useChatStore.getState();
    const context = { operationId };
    store.internal_dispatchMessage(
      { id: messageId, type: 'updateMessage', value: { content } },
      context,
    );
    let toolMessageId: string | undefined;
    if (tool) {
      const toolCallId = nextId('call');
      toolMessageId = nextId('tool');
      const result = JSON.stringify(tool.args);
      const payload = {
        apiName: tool.apiName,
        arguments: result,
        id: toolCallId,
        identifier: ARTBOARD_TOOL,
        type: 'builtin' as const,
      };
      const tools: ChatToolPayloadWithResult[] = [
        {
          ...payload,
          result: { content: result, id: toolMessageId, state: tool.args },
          result_msg_id: toolMessageId,
        },
      ];
      store.internal_dispatchMessage(
        { id: messageId, type: 'updateMessage', value: { tools } },
        context,
      );
      store.internal_dispatchMessage(
        {
          id: toolMessageId,
          type: 'createMessage',
          value: {
            agentId: t.agentId,
            content: result,
            parentId: messageId,
            plugin: payload,
            pluginState: tool.args,
            role: 'tool',
            threadId: t.threadId ?? undefined,
            tool_call_id: toolCallId,
            topicId: t.topicId ?? undefined,
          },
        },
        context,
        { creationOrigin: 'client' },
      );
    }
    store.completeOperation(operationId);
    return toolMessageId;
  };
};

export const postAgentMessage = (content: string, tool?: BoardToolCall) =>
  startAgentReply()(content, tool);

export const openBoardPanel = (toolMessageId: string) =>
  useChatStore.getState().openToolUI(toolMessageId, ARTBOARD_TOOL);
