import { readdir, readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { HeterogeneousAgentModel } from '@lobechat/types';
import { isRecord, pickTrimmedString, toRecord } from '@lobechat/utils/object';

export interface ListClaudeCodeModelsOptions {
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  home?: string;
  managedSettingsDir?: string;
}

type ClaudeSettingSource = 'local' | 'project' | 'user';

const ALL_SETTING_SOURCES: readonly ClaudeSettingSource[] = ['user', 'project', 'local'];

const ALIAS_DEFAULT_ENV_KEY: Record<string, string> = {
  haiku: 'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  opus: 'ANTHROPIC_DEFAULT_OPUS_MODEL',
  sonnet: 'ANTHROPIC_DEFAULT_SONNET_MODEL',
};

const defaultManagedSettingsDir = () => {
  if (process.platform === 'darwin') return '/Library/Application Support/ClaudeCode';
  if (process.platform === 'win32') return 'C:\\Program Files\\ClaudeCode';
  return '/etc/claude-code';
};

const parseJsonObject = (raw: string): Record<string, unknown> | undefined => {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const readJsonObject = async (filePath: string): Promise<Record<string, unknown> | undefined> => {
  try {
    return parseJsonObject(await readFile(filePath, 'utf8'));
  } catch {
    return undefined;
  }
};

const isDirectory = async (dirPath: string): Promise<boolean> =>
  (await stat(dirPath).catch(() => undefined))?.isDirectory() ?? false;

const findProjectRoot = async (workingDirectory: string): Promise<string> => {
  let current = path.resolve(workingDirectory);
  while (true) {
    const gitStat = await stat(path.join(current, '.git')).catch(() => undefined);
    if (gitStat) return current;
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(workingDirectory);
    current = parent;
  }
};

const extractFlagValues = (args: readonly string[], flag: string): string[] => {
  const values: string[] = [];
  const prefix = `${flag}=`;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--') break;
    if (arg === flag) {
      const next = args[index + 1];
      if (next !== undefined) {
        values.push(next);
        index += 1;
      }
      continue;
    }
    if (arg.startsWith(prefix)) {
      values.push(arg.slice(prefix.length));
    }
  }

  return values;
};

const resolveSettingSources = (args: readonly string[]): Set<ClaudeSettingSource> => {
  const values = extractFlagValues(args, '--setting-sources');
  if (values.length === 0) return new Set(ALL_SETTING_SOURCES);

  const last = values.at(-1) ?? '';
  const enabled = new Set<ClaudeSettingSource>();
  for (const token of last.split(',')) {
    const normalized = token.trim() as ClaudeSettingSource;
    if (normalized === 'user' || normalized === 'project' || normalized === 'local') {
      enabled.add(normalized);
    }
  }
  return enabled;
};

const readExplicitSettingsArgs = async (
  args: readonly string[],
  baseDir: string,
): Promise<(Record<string, unknown> | undefined)[]> => {
  const rawValues = extractFlagValues(args, '--settings').reverse();
  return Promise.all(
    rawValues.map(async (raw) => {
      const trimmed = raw.trim();
      if (!trimmed) return undefined;
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) return parseJsonObject(trimmed);
      return readJsonObject(path.resolve(baseDir, trimmed));
    }),
  );
};

const listManagedSettingsFiles = async (dir: string): Promise<string[]> => {
  const dropInDir = path.join(dir, 'managed-settings.d');
  const dropIns = await readdir(dropInDir).catch((): string[] => []);
  return [
    ...dropIns
      .filter((name) => !name.startsWith('.') && name.endsWith('.json'))
      .sort()
      .reverse()
      .map((name) => path.join(dropInDir, name)),
    path.join(dir, 'managed-settings.json'),
  ];
};

const resolveEffectiveDefaultModel = (
  settingsList: readonly (Record<string, unknown> | undefined)[],
  env: NodeJS.ProcessEnv,
): string | undefined => {
  const lookupEnv = (key: string): string | undefined => {
    const fromProcess = pickTrimmedString(env[key]);
    if (fromProcess) return fromProcess;
    for (const settings of settingsList) {
      const fromSettings = pickTrimmedString(toRecord(settings?.env)?.[key]);
      if (fromSettings) return fromSettings;
    }
    return undefined;
  };

  let configured = lookupEnv('ANTHROPIC_MODEL');
  if (!configured) {
    for (const settings of settingsList) {
      const candidate = pickTrimmedString(settings?.model);
      if (candidate) {
        configured = candidate;
        break;
      }
    }
  }

  const aliasEnvKey = configured ? ALIAS_DEFAULT_ENV_KEY[configured.toLowerCase()] : undefined;
  return (aliasEnvKey && lookupEnv(aliasEnvKey)) || configured;
};

/**
 * Parse `modelPicker.options` from the highest-precedence Claude Code settings
 * object that defines it. Returns `[]` when no custom `modelPicker` is configured
 * so callers can keep Claude Code's lightweight static alias menu.
 */
export const parseClaudeCodeModelPicker = (
  settingsList: readonly (Record<string, unknown> | undefined)[],
  defaultModel?: string,
): HeterogeneousAgentModel[] => {
  for (const settings of settingsList) {
    const picker = toRecord(settings?.modelPicker);
    if (!picker || !Array.isArray(picker.options)) continue;

    const seen = new Set<string>();
    const models: HeterogeneousAgentModel[] = [];

    for (const option of picker.options) {
      if (!isRecord(option)) continue;
      const id = pickTrimmedString(option.model);
      if (!id || seen.has(id)) continue;

      seen.add(id);
      const label = pickTrimmedString(option.label);
      const slashIndex = id.indexOf('/');
      const providerId = slashIndex > 0 ? id.slice(0, slashIndex) : 'claude-code';
      const modelId = slashIndex > 0 ? id.slice(slashIndex + 1) : id;

      models.push({
        id,
        ...(defaultModel && id === defaultModel ? { isDefault: true } : {}),
        ...(label ? { label } : {}),
        modelId,
        providerId,
      });
    }

    return models;
  }

  return [];
};

/**
 * Read custom `modelPicker.options` across Claude Code's settings cascade
 * (`--settings` → managed → project local/shared → user local/global).
 */
export const listClaudeCodeModels = async (
  options: ListClaudeCodeModelsOptions = {},
): Promise<HeterogeneousAgentModel[]> => {
  const args = options.args ?? [];
  const env = options.env ?? process.env;
  const home = options.home ?? pickTrimmedString(env.HOME) ?? os.homedir();
  const configDir = pickTrimmedString(env.CLAUDE_CONFIG_DIR) ?? path.join(home, '.claude');
  const managedDir = options.managedSettingsDir ?? defaultManagedSettingsDir();
  const enabledSources = resolveSettingSources(args);

  const rawCwd = options.cwd ?? home;
  const validProjectDir = (await isDirectory(rawCwd)) ? path.resolve(rawCwd) : undefined;
  const projectRoot = validProjectDir ? await findProjectRoot(validProjectDir) : undefined;
  const settingsBaseDir = validProjectDir ?? home;

  const candidateFiles: string[] = [...(await listManagedSettingsFiles(managedDir))];

  if (validProjectDir && projectRoot) {
    if (enabledSources.has('local')) {
      candidateFiles.push(
        path.join(validProjectDir, '.claude', 'settings.local.json'),
        path.join(projectRoot, '.claude', 'settings.local.json'),
      );
    }
    if (enabledSources.has('project')) {
      candidateFiles.push(
        path.join(validProjectDir, '.claude', 'settings.json'),
        path.join(projectRoot, '.claude', 'settings.json'),
      );
    }
  }

  if (enabledSources.has('local')) {
    candidateFiles.push(path.join(configDir, 'settings.local.json'));
  }
  if (enabledSources.has('user')) {
    candidateFiles.push(path.join(configDir, 'settings.json'));
  }

  const uniqueFiles = [...new Set(candidateFiles.map((file) => path.resolve(file)))];
  const [explicitSettings, fileSettings] = await Promise.all([
    readExplicitSettingsArgs(args, settingsBaseDir),
    Promise.all(uniqueFiles.map(readJsonObject)),
  ]);

  const settingsList = [...explicitSettings, ...fileSettings];
  const defaultModel = resolveEffectiveDefaultModel(settingsList, env);
  return parseClaudeCodeModelPicker(settingsList, defaultModel);
};
