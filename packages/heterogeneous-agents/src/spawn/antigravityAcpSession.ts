import type { HeterogeneousAgentModel } from '@lobechat/types';
import { isRecord, pickString } from '@lobechat/utils/object';

import type { AgentPromptInput } from '../protocol';
import type { AcpAgentSessionOptions } from './acpAgentSession';
import {
  ACP_PROTOCOL_VERSION,
  AcpAgentSession,
  selectAcpPermissionOption,
} from './acpAgentSession';
import type { AcpRpcMessage } from './acpStdioClient';
import { AcpRpcResponseError, AcpServerRequestError } from './acpStdioClient';
import { getAntigravitySpawnEnv } from './antigravity';
import type { BuildAgentInputOptions } from './input';
import { normalizeImage } from './input';
import type {
  TraeAcpImagePromptBlock,
  TraeAcpPromptBlock,
  TraeAcpTextPromptBlock,
} from './traeAcpSession';

const TRANSPORT = 'antigravity-acp' as const;

export type AntigravityAcpTextPromptBlock = TraeAcpTextPromptBlock;
export type AntigravityAcpImagePromptBlock = TraeAcpImagePromptBlock;
export type AntigravityAcpPromptBlock = TraeAcpPromptBlock;

const CONFLICTING_FLAGS = new Set([
  '--',
  '--continue',
  '--conversation',
  '--input-format',
  '--output-format',
  '--print',
  '--prompt',
  '--prompt-interactive',
  '--remote-control',
  '-c',
  '-i',
  '-p',
]);

interface ExtractedAntigravitySessionFlags {
  args: string[];
  effort?: string;
  mode?: string;
  model?: string;
}

const extractAntigravitySessionFlags = (
  extraArgs: string[] = [],
): ExtractedAntigravitySessionFlags => {
  const args: string[] = [];
  let effort: string | undefined;
  let mode: string | undefined;
  let model: string | undefined;

  for (let index = 0; index < extraArgs.length; index += 1) {
    const arg = extraArgs[index]!;
    const flagName = arg.split('=')[0]!;
    if (CONFLICTING_FLAGS.has(flagName)) {
      throw new Error(`LobeHub manages Antigravity's prompt, output and session flags: ${arg}`);
    }
    if (arg === 'acp' || arg === '--stdio') continue;

    if (arg === '--model' || arg === '-m') {
      const value = extraArgs[index + 1];
      if (value && !value.startsWith('-')) {
        model = value;
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--model=')) {
      model = arg.slice('--model='.length);
      continue;
    }
    if (arg.startsWith('-m=')) {
      model = arg.slice('-m='.length);
      continue;
    }

    if (arg === '--effort') {
      const value = extraArgs[index + 1];
      if (value && !value.startsWith('-')) {
        effort = value;
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--effort=')) {
      effort = arg.slice('--effort='.length);
      continue;
    }

    if (arg === '--mode') {
      const value = extraArgs[index + 1];
      if (value && !value.startsWith('-')) {
        mode = value;
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--mode=')) {
      mode = arg.slice('--mode='.length);
      continue;
    }

    args.push(arg);
  }

  return { args, effort, mode, model };
};

export const buildAntigravityAcpArgs = (extraArgs: string[] = []): string[] => {
  const { args } = extractAntigravitySessionFlags(extraArgs);
  const fullAccess = args.includes('--dangerously-skip-permissions')
    ? []
    : ['--dangerously-skip-permissions'];
  return ['acp', ...fullAccess, ...args];
};

export const buildAntigravityAcpPrompt = async (
  prompt: AgentPromptInput,
  options: BuildAgentInputOptions = {},
): Promise<AntigravityAcpPromptBlock[]> => {
  const blocks = typeof prompt === 'string' ? [{ text: prompt, type: 'text' as const }] : prompt;
  const result: AntigravityAcpPromptBlock[] = [];
  for (const block of blocks) {
    if (block.type === 'text') {
      if (block.text.length > 0 || blocks.length === 1) {
        result.push({ text: block.text, type: 'text' });
      }
    } else {
      const image = await normalizeImage(block.source, options);
      result.push({
        data: image.buffer.toString('base64'),
        mimeType: image.mediaType,
        type: 'image',
      });
    }
  }
  return result;
};

export const isAntigravityAcpSessionNotFoundError = (
  error: unknown,
): error is AcpRpcResponseError => {
  if (
    !(error instanceof AcpRpcResponseError) ||
    (error.method !== 'session/resume' && error.method !== 'session/load')
  ) {
    return false;
  }

  const data = isRecord(error.rpcError.data) ? error.rpcError.data : undefined;
  const details = typeof data?.details === 'string' ? data.details : '';
  const combined = `${error.rpcError.message} ${details}`;
  return /failed to read session\b|\bsession\b[\s\S]*?\bnot found|trajectory not found/i.test(
    combined,
  );
};

interface AntigravityAcpInitializeResult {
  agentCapabilities?: {
    load_session?: boolean;
    loadSession?: boolean;
    promptCapabilities?: { image?: boolean };
    session_capabilities?: { close?: unknown; resume?: unknown };
    sessionCapabilities?: { close?: unknown; resume?: unknown };
  };
  protocolVersion?: number | string;
}

interface AntigravityAcpSessionResult {
  configOptions?: unknown;
  models?: {
    availableModels?: unknown;
    currentModelId?: unknown;
  };
  modes?: {
    availableModes?: unknown;
    currentModeId?: unknown;
  };
  sessionId?: string;
}

interface AntigravityAcpPromptResult {
  stopReason?: string;
  usage?: unknown;
}

interface AntigravityAcpConfigOption {
  category?: unknown;
  currentValue?: unknown;
  id?: unknown;
  name?: unknown;
  options?: unknown;
  type?: unknown;
  value?: unknown;
}

export interface AntigravityAcpSessionOptions extends AcpAgentSessionOptions {
  initialModel?: string;
  inputOptions?: BuildAgentInputOptions;
  onModel?: (model: string) => void;
  prompt: AgentPromptInput | AntigravityAcpPromptBlock[];
}

const parseAvailableModels = (raw: unknown): HeterogeneousAgentModel[] => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const models: HeterogeneousAgentModel[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const id = pickString(item.modelId);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const name = pickString(item.name);
    models.push({
      id,
      ...(name && name !== id ? { label: name } : {}),
      modelId: id,
      providerId: 'antigravity',
    });
  }
  return models;
};

const findConfigOption = (
  configOptions: unknown,
  predicate: (option: AntigravityAcpConfigOption) => boolean,
): AntigravityAcpConfigOption | undefined => {
  if (!Array.isArray(configOptions)) return undefined;
  return configOptions
    .filter(isRecord)
    .find((option) => predicate(option as AntigravityAcpConfigOption)) as
    AntigravityAcpConfigOption | undefined;
};

const resolveModelFromConfigOptions = (
  configOptions: unknown,
  availableModelIds: ReadonlySet<string>,
): string | undefined => {
  const modelOption = findConfigOption(
    configOptions,
    (opt) => opt.id === 'model' || opt.category === 'model',
  );
  const family = pickString(modelOption?.currentValue);
  if (!family) return undefined;

  const thoughtOption = findConfigOption(
    configOptions,
    (opt) => opt.id === 'thought_level' || opt.category === 'thought_level',
  );
  const thoughtLevel = pickString(thoughtOption?.currentValue);
  if (thoughtLevel) {
    const combined = `${family}-${thoughtLevel}`;
    if (availableModelIds.has(combined)) return combined;
  }
  return family;
};

export class AntigravityAcpSession extends AcpAgentSession<
  AntigravityAcpInitializeResult,
  AntigravityAcpSessionOptions
> {
  private acceptUpdates = false;
  private availableModelIds = new Set<string>();
  private canCloseSession = false;
  private readonly effortFromArgs?: string;
  private readonly modeFromArgs?: string;
  private readonly modelFromArgs?: string;
  private resolvedPrompt: AntigravityAcpPromptBlock[] = [];

  constructor(options: AntigravityAcpSessionOptions) {
    const extracted = extractAntigravitySessionFlags(options.args);
    super(
      { ...options, env: getAntigravitySpawnEnv(options.env) },
      {
        args: buildAntigravityAcpArgs(options.args),
        pipeline: { agentType: 'antigravity-acp', cwd: options.cwd },
        processLabel: 'Antigravity ACP',
        transport: TRANSPORT,
      },
    );
    this.effortFromArgs = extracted.effort;
    this.modeFromArgs = extracted.mode;
    this.modelFromArgs = extracted.model;
  }

  get sessionId(): string | undefined {
    return this.acpSessionId;
  }

  /** Spawn the ACP child process eagerly (idempotent with `run()`). */
  startProcess(): Promise<void> {
    return this.client.start();
  }

  protected async prepareRun(): Promise<void> {
    this.resolvedPrompt = await this.resolvePrompt();
  }

  protected buildInitializeParams(): unknown {
    return {
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
      clientInfo: {
        name: 'lobehub',
        title: 'LobeHub',
        version: this.options.clientVersion,
      },
      protocolVersion: ACP_PROTOCOL_VERSION,
    };
  }

  protected validateInitialized(initialized: AntigravityAcpInitializeResult): void {
    if (
      initialized?.protocolVersion !== undefined &&
      initialized.protocolVersion !== ACP_PROTOCOL_VERSION &&
      initialized.protocolVersion !== String(ACP_PROTOCOL_VERSION)
    ) {
      throw new Error(
        `Antigravity ACP returned unsupported protocol version: ${String(initialized?.protocolVersion)}`,
      );
    }
  }

  protected async establishSession(initialized: AntigravityAcpInitializeResult): Promise<string> {
    const capabilities = initialized?.agentCapabilities;
    if (
      this.resolvedPrompt.some((block) => block.type === 'image') &&
      capabilities?.promptCapabilities?.image !== true
    ) {
      throw new Error(
        'Antigravity ACP does not support image prompt blocks. Update agy and retry.',
      );
    }

    const supportsResume =
      isRecord(capabilities?.sessionCapabilities?.resume) ||
      isRecord(capabilities?.session_capabilities?.resume);
    const supportsLoad = capabilities?.loadSession === true || capabilities?.load_session === true;
    if (this.options.resumeSessionId && !supportsResume && !supportsLoad) {
      throw new Error('Antigravity ACP does not support resuming sessions');
    }

    this.canCloseSession =
      isRecord(capabilities?.sessionCapabilities?.close) ||
      isRecord(capabilities?.session_capabilities?.close);

    const sessionMethod = this.options.resumeSessionId
      ? supportsResume
        ? 'session/resume'
        : 'session/load'
      : 'session/new';
    const sessionResult = await this.client.request<AntigravityAcpSessionResult>(sessionMethod, {
      cwd: this.options.cwd,
      mcpServers: [],
      ...(this.options.resumeSessionId ? { sessionId: this.options.resumeSessionId } : {}),
    });

    const sessionId = sessionResult?.sessionId ?? this.options.resumeSessionId;
    if (!sessionId) throw new Error('Antigravity ACP returned no session id');
    this.acpSessionId = sessionId;
    this.options.onSessionId(sessionId);

    const availableModels = parseAvailableModels(sessionResult?.models?.availableModels);
    this.availableModelIds = new Set(availableModels.map(({ id }) => id));

    let model = await this.applyInitialModel(sessionId, sessionResult, availableModels);
    if (this.effortFromArgs?.trim() && this.effortFromArgs.trim() !== 'default') {
      const effort = this.effortFromArgs.trim();
      const response = await this.client.request<{ configOptions?: unknown }>(
        'session/set_config_option',
        {
          configId: 'thought_level',
          sessionId,
          value: effort,
        },
      );
      model =
        resolveModelFromConfigOptions(response?.configOptions, this.availableModelIds) ?? model;
    }

    if (this.modeFromArgs?.trim()) {
      await this.client.request('session/set_mode', {
        modeId: this.modeFromArgs.trim(),
        sessionId,
      });
    }

    if (model) {
      this.pipeline.configureSession({ model });
      this.options.onModel?.(model);
    }
    await this.pushToPipeline({ model, sessionId, type: 'antigravity_session' });
    return sessionId;
  }

  protected onBeforePrompt(): void {
    this.acceptUpdates = true;
  }

  protected buildPromptParams(sessionId: string): unknown {
    return { prompt: this.resolvedPrompt, sessionId };
  }

  protected override async settlePrompt(result: unknown): Promise<void> {
    await this.client.drain();
    const promptResult = isRecord(result) ? (result as AntigravityAcpPromptResult) : undefined;
    await this.pushToPipeline({
      stopReason: promptResult?.stopReason,
      type: 'antigravity_prompt_completed',
      usage: promptResult?.usage,
    });
    if (this.canCloseSession && this.acpSessionId && !this.closedByHost) {
      await this.client
        .request('session/close', { sessionId: this.acpSessionId })
        .catch((error) => {
          console.error('[AntigravityAcpSession] Failed to close ACP session cleanly:', error);
        });
    }
  }

  protected async onRunFailure(error: Error): Promise<void> {
    const detail =
      error instanceof AcpRpcResponseError &&
      isRecord(error.rpcError.data) &&
      typeof error.rpcError.data.details === 'string' &&
      error.rpcError.data.details
        ? `${error.message}: ${error.rpcError.data.details}`
        : error.message;
    await this.pushToPipeline({ message: detail, type: 'antigravity_error' });
    await this.emitEvents(await this.pipeline.flush());
  }

  protected async onRunCancelled(): Promise<void> {
    await this.pushToPipeline({ stopReason: 'cancelled', type: 'antigravity_prompt_completed' });
  }

  protected async handleAgentMessage(message: AcpRpcMessage): Promise<void> {
    if (message.method !== 'session/update' || !this.acceptUpdates) return;

    const update = isRecord(message.params) ? message.params.update : undefined;
    if (!isRecord(update)) return;

    if (update.sessionUpdate === 'config_option_update') {
      const currentModel = resolveModelFromConfigOptions(
        update.configOptions,
        this.availableModelIds,
      );
      if (currentModel) {
        this.pipeline.configureSession({ model: currentModel });
        this.options.onModel?.(currentModel);
      }
    }
    await this.pushToPipeline(update);
  }

  protected handleServerRequest(message: AcpRpcMessage): unknown {
    if (message.method === 'session/request_permission') {
      const optionId = selectAcpPermissionOption(message.params, [
        (option) =>
          option.optionId === 'allow_session' ||
          option.optionId === 'allow_always' ||
          option.optionId === 'approve_for_session',
        (option) => option.kind === 'allow_always',
        (option) => option.kind === 'allow_once',
        (option) => option.kind === 'reject_once',
      ]);
      if (optionId) return { outcome: { optionId, outcome: 'selected' } };
      throw new AcpServerRequestError(-32_603, 'No safe permission option was offered');
    }
    throw new AcpServerRequestError(-32_601, `Unsupported ACP client request: ${message.method}`);
  }

  private async resolvePrompt(): Promise<AntigravityAcpPromptBlock[]> {
    const prompt = this.options.prompt;
    if (
      Array.isArray(prompt) &&
      prompt.every(
        (block) =>
          'type' in block && (block.type === 'text' || ('data' in block && block.type === 'image')),
      )
    ) {
      return prompt as AntigravityAcpPromptBlock[];
    }
    return buildAntigravityAcpPrompt(prompt as AgentPromptInput, this.options.inputOptions);
  }

  private async applyInitialModel(
    sessionId: string,
    sessionResult: AntigravityAcpSessionResult | undefined,
    availableModels: HeterogeneousAgentModel[],
  ): Promise<string | undefined> {
    const currentModelId = pickString(sessionResult?.models?.currentModelId);
    const requestedModel = (this.options.initialModel?.trim() || this.modelFromArgs?.trim()) ?? '';
    if (!requestedModel || requestedModel === 'default') {
      return (
        currentModelId ??
        resolveModelFromConfigOptions(sessionResult?.configOptions, this.availableModelIds)
      );
    }

    const selected = availableModels.find(
      (model) => model.id === requestedModel || model.label === requestedModel,
    );
    if (selected) {
      if (selected.id !== currentModelId) {
        await this.client.request('session/set_model', { modelId: selected.id, sessionId });
      }
      return selected.id;
    }

    const modelConfig = findConfigOption(
      sessionResult?.configOptions,
      (opt) => opt.id === 'model' || opt.category === 'model',
    );
    const familyOptions = Array.isArray(modelConfig?.options)
      ? modelConfig.options.filter(isRecord)
      : [];
    const matchedFamily = familyOptions.find(
      (opt) => opt.value === requestedModel || opt.name === requestedModel,
    );
    if (matchedFamily && typeof matchedFamily.value === 'string') {
      const response = await this.client.request<{ configOptions?: unknown }>(
        'session/set_config_option',
        {
          configId: typeof modelConfig?.id === 'string' ? modelConfig.id : 'model',
          sessionId,
          value: matchedFamily.value,
        },
      );
      return (
        resolveModelFromConfigOptions(response?.configOptions, this.availableModelIds) ??
        matchedFamily.value
      );
    }

    // Forward custom models (e.g. enterprise gateway or settings.json custom models) directly.
    await this.client.request('session/set_model', { modelId: requestedModel, sessionId });
    return requestedModel;
  }
}
