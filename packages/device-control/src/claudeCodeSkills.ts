import { spawn } from 'node:child_process';
import { readdir, readFile, realpath } from 'node:fs/promises';
import * as os from 'node:os';
import path from 'node:path';

import { detectHeterogeneousCliCommand } from '@lobechat/heterogeneous-agents/resolveCliCommand';
import { isRecord, pickTrimmedString, toRecord } from '@lobechat/utils/object';
import matter from 'gray-matter';

import { resolveClaudeCodeProjectRoot } from './claudeCodeMemory';
import type { ProjectSkillItem, ProjectSkillScope } from './types';
import { listSkillFilesRecursive } from './workspace';

export interface ListClaudeCodeSkillsOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  home?: string;
  /** Whether to probe `claude` for binary-compiled built-in skills (`/loop`, `/claude-api`, …). Defaults to true. */
  includeBuiltins?: boolean;
  /** System directory of the file-based managed settings; the platform's own by default. */
  managedSettingsDir?: string;
}

interface InstalledPluginRecord {
  installPath: string;
  projectPath?: string;
  rawScope: string;
}

interface PluginCandidate {
  barePluginId: string;
  installPath: string;
  pluginId: string;
  scope: ProjectSkillScope;
}

interface ParsedPluginSkillFile {
  description?: string;
  disabled: boolean;
  name?: string;
}

const SCOPE_PRECEDENCE: Record<string, number> = {
  local: 3,
  project: 2,
  user: 1,
};

/**
 * Valid Claude Code plugin skill invocation names: `<plugin>:<skill>` or bare
 * `<skill>`, matching `ActionTagPlugin` and `promptEngine`.
 */
const INVOCABLE_CLAUDE_SKILL_NAME = /^[\w.-]+(?::[\w.-]+)?$/;

const defaultManagedSettingsDir = () => {
  if (process.platform === 'darwin') return '/Library/Application Support/ClaudeCode';
  if (process.platform === 'win32') return 'C:\\Program Files\\ClaudeCode';
  return '/etc/claude-code';
};

const readJsonObject = async (file: string): Promise<Record<string, unknown> | undefined> => {
  try {
    const value: unknown = JSON.parse(await readFile(file, 'utf8'));
    return isRecord(value) ? value : undefined;
  } catch {
    return undefined;
  }
};

const containsPath = (root: string, target: string) => {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

const listManagedSettingsFiles = async (dir: string): Promise<string[]> => {
  const dropInDir = path.join(dir, 'managed-settings.d');
  const dropIns = await readdir(dropInDir).catch((): string[] => []);
  return [
    path.join(dir, 'managed-settings.json'),
    ...dropIns
      .filter((name) => !name.startsWith('.') && name.endsWith('.json'))
      .sort()
      .map((name) => path.join(dropInDir, name)),
  ];
};

const readSettingsPrecedenceList = async ({
  configDir,
  managedSettingsDir,
  projectRoot,
  workingDirectory,
}: {
  configDir: string;
  managedSettingsDir: string;
  projectRoot: string;
  workingDirectory: string;
}): Promise<(Record<string, unknown> | undefined)[]> => {
  const orderedFiles = [
    ...(await listManagedSettingsFiles(managedSettingsDir)).reverse(),
    path.join(projectRoot, '.claude', 'settings.local.json'),
    path.join(workingDirectory, '.claude', 'settings.local.json'),
    path.join(projectRoot, '.claude', 'settings.json'),
    path.join(workingDirectory, '.claude', 'settings.json'),
    path.join(configDir, 'settings.local.json'),
    path.join(configDir, 'settings.json'),
  ];

  // Dedupe repeated paths (e.g. when projectRoot === workingDirectory) preserving precedence.
  const uniqueFiles = [...new Set(orderedFiles.map((file) => path.resolve(file)))];
  return Promise.all(uniqueFiles.map(readJsonObject));
};

const resolvePluginEnabledFromSettings = (
  settingsList: (Record<string, unknown> | undefined)[],
  pluginId: string,
  barePluginId: string,
): boolean | undefined => {
  for (const settings of settingsList) {
    const enabledPlugins = toRecord(settings?.enabledPlugins);
    if (!enabledPlugins) continue;

    const exact = enabledPlugins[pluginId];
    if (typeof exact === 'boolean') return exact;

    if (barePluginId && barePluginId !== pluginId) {
      const bare = enabledPlugins[barePluginId];
      if (typeof bare === 'boolean') return bare;
    }
  }
  return undefined;
};

const readPluginManifest = async (
  installPath: string,
): Promise<Record<string, unknown> | undefined> => {
  const primary = await readJsonObject(path.join(installPath, '.claude-plugin', 'plugin.json'));
  if (primary) return primary;
  return readJsonObject(path.join(installPath, 'plugin.json'));
};

const parsePluginRecords = (entry: unknown): InstalledPluginRecord[] => {
  const rawRecords = Array.isArray(entry) ? entry.filter(isRecord) : isRecord(entry) ? [entry] : [];
  const records: InstalledPluginRecord[] = [];
  for (const record of rawRecords) {
    const installPath = pickTrimmedString(record.installPath);
    if (!installPath) continue;
    records.push({
      installPath,
      projectPath: pickTrimmedString(record.projectPath),
      rawScope: pickTrimmedString(record.scope) ?? 'user',
    });
  }
  return records;
};

const matchesProjectScope = async (
  projectPath: string | undefined,
  workingDirectory: string,
  resolvedWorkingDirectory: string,
  resolvedProjectRoot: string,
): Promise<boolean> => {
  if (!projectPath) return true;
  const normalized = path.resolve(workingDirectory, projectPath);
  const resolved = await realpath(normalized).catch(() => normalized);
  return (
    resolved === resolvedProjectRoot ||
    containsPath(resolved, resolvedWorkingDirectory) ||
    containsPath(resolvedProjectRoot, resolved)
  );
};

const selectPluginCandidate = async (
  pluginId: string,
  rawEntry: unknown,
  context: {
    resolvedProjectRoot: string;
    resolvedWorkingDirectory: string;
    workingDirectory: string;
  },
): Promise<PluginCandidate | undefined> => {
  if (pluginId === 'lobehub@inline' || pluginId.endsWith('@skills-dir')) return undefined;

  const records = parsePluginRecords(rawEntry);
  if (records.length === 0) return undefined;

  let best: InstalledPluginRecord | undefined;
  let bestRank = -1;

  for (const record of records) {
    if (record.rawScope === 'project' || record.rawScope === 'local') {
      const matches = await matchesProjectScope(
        record.projectPath,
        context.workingDirectory,
        context.resolvedWorkingDirectory,
        context.resolvedProjectRoot,
      );
      if (!matches) continue;
    }

    const rank = SCOPE_PRECEDENCE[record.rawScope] ?? 0;
    if (!best || rank > bestRank) {
      best = record;
      bestRank = rank;
    }
  }

  if (!best) return undefined;

  const atIndex = pluginId.indexOf('@');
  const barePluginId = atIndex > 0 ? pluginId.slice(0, atIndex) : pluginId;
  const scope: ProjectSkillScope =
    best.rawScope === 'project' || best.rawScope === 'local' ? 'project' : 'device';

  return {
    barePluginId,
    installPath: path.resolve(context.workingDirectory, best.installPath),
    pluginId,
    scope,
  };
};

const resolvePluginSkillRoots = async (
  installPath: string,
  manifest: Record<string, unknown> | undefined,
): Promise<string[]> => {
  const rawSkills = manifest?.skills;
  if (typeof rawSkills !== 'string' && !Array.isArray(rawSkills)) {
    return [path.join(installPath, 'skills')];
  }

  const declared = (Array.isArray(rawSkills) ? rawSkills : [rawSkills])
    .map((item) => pickTrimmedString(item))
    .filter((item): item is string => Boolean(item));

  const resolvedInstallPath = await realpath(installPath).catch(() => path.resolve(installPath));
  const safeRoots: string[] = [];

  for (const rel of declared) {
    const candidate = path.resolve(installPath, rel);
    const lexicalCheck = path.resolve(resolvedInstallPath, rel);
    const resolvedCandidate = await realpath(candidate).catch(() => lexicalCheck);
    if (containsPath(resolvedInstallPath, resolvedCandidate)) {
      safeRoots.push(candidate);
    }
  }

  return safeRoots;
};

const isSkillDisabledInFrontmatter = (data: Record<string, unknown>): boolean =>
  data['user-invocable'] === false ||
  data['user-invocable'] === 'false' ||
  data['disable-slash-command'] === true ||
  data['disable-slash-command'] === 'true';

const parsePluginSkillFile = (raw: string): ParsedPluginSkillFile => {
  try {
    const { data } = matter(raw) as { data: Record<string, unknown> };
    return {
      description: pickTrimmedString(data.description),
      disabled: isSkillDisabledInFrontmatter(data),
      name: pickTrimmedString(data.name),
    };
  } catch {
    return { disabled: false };
  }
};

const listChildDirs = async (dir: string): Promise<string[]> => {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter(
        (entry) => (entry.isDirectory() || entry.isSymbolicLink()) && !entry.name.startsWith('.'),
      )
      .map((entry) => entry.name);
  } catch {
    return [];
  }
};

const readPluginSkillItem = async (
  skillDir: string,
  entryName: string,
  pluginName: string,
  scope: ProjectSkillScope,
): Promise<ProjectSkillItem | null> => {
  const skillFile = path.join(skillDir, 'SKILL.md');
  try {
    const raw = await readFile(skillFile, 'utf8');
    const parsed = parsePluginSkillFile(raw);
    if (parsed.disabled) return null;

    const rawSkillName = parsed.name || entryName;
    const qualifiedName = rawSkillName.includes(':')
      ? rawSkillName
      : `${pluginName}:${rawSkillName}`;
    if (!INVOCABLE_CLAUDE_SKILL_NAME.test(qualifiedName)) return null;

    const files = await listSkillFilesRecursive(skillDir);
    const resolvedFiles = files.length > 0 ? files : ['SKILL.md'];

    return {
      description: parsed.description,
      fileCount: resolvedFiles.length,
      files: resolvedFiles,
      name: qualifiedName,
      path: skillFile,
      previewRoot: skillDir,
      scope,
      skillDir,
      source: 'claude-code-plugin',
    };
  } catch {
    return null;
  }
};

const BUILTIN_PROBE_TIMEOUT_MS = 5000;

/**
 * Interactive TUI, session-control, internal, and LobeHub-conflicting built-in
 * commands returned by Claude Code `initialize` that are not prompt-based skills.
 */
const NON_SKILL_CLAUDE_BUILTIN_COMMANDS = new Set([
  'advisor',
  'agents',
  'auto-mode-setup',
  'autocompact',
  'clear',
  'color',
  'compact',
  'config',
  'context',
  'design',
  'design-consent',
  'design-revoke',
  'effort',
  'fast',
  'focus',
  'goal',
  'heapdump',
  'import',
  'list-agents',
  'mcp',
  'model',
  'output-style',
  'reload-plugins',
  'reload-skills',
  'rename',
  'usage',
  'workflow-launch-exec',
]);

const builtinSkillsCache = new Map<string, Promise<ProjectSkillItem[]>>();

export const resetClaudeCodeBuiltinSkillsCache = () => {
  builtinSkillsCache.clear();
};

/**
 * Extract prompt-based built-in bundled skills (`/loop`, `/claude-api`, `/run`, …)
 * from the `commands` array returned by Claude Code's `initialize` control response.
 */
export const extractClaudeCodeBuiltinSkills = (commands: unknown): ProjectSkillItem[] => {
  if (!Array.isArray(commands)) return [];

  const skills: ProjectSkillItem[] = [];
  for (const cmd of commands) {
    if (!isRecord(cmd) || cmd.builtin !== true) continue;

    const name = pickTrimmedString(cmd.name);
    if (
      !name ||
      name.startsWith('__') ||
      NON_SKILL_CLAUDE_BUILTIN_COMMANDS.has(name) ||
      !INVOCABLE_CLAUDE_SKILL_NAME.test(name)
    ) {
      continue;
    }

    const rawDesc = pickTrimmedString(cmd.description);
    if (rawDesc?.startsWith('(removed)')) continue;

    // Keep the first non-empty line so multi-paragraph trigger rules stay concise in tooltips.
    const description = rawDesc
      ? rawDesc
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find(Boolean)
      : undefined;

    skills.push({
      description,
      fileCount: 0,
      files: [],
      name,
      path: '',
      previewRoot: '',
      scope: 'device',
      skillDir: `claude-code-builtin:${name}`,
      source: 'claude-code-builtin',
    });
  }

  return skills;
};

const probeClaudeCodeBuiltinSkills = (
  commandPath: string,
  env: NodeJS.ProcessEnv,
  resolvedPathEnv?: string,
): Promise<ProjectSkillItem[]> => {
  const spawnEnv: NodeJS.ProcessEnv = { ...env };
  if (resolvedPathEnv) spawnEnv.PATH = resolvedPathEnv;
  // Clear nested-session markers so launching `claude` inside another Claude session succeeds.
  delete spawnEnv.CLAUDECODE;
  delete spawnEnv.CLAUDE_CODE_ENTRYPOINT;

  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(
        commandPath,
        ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose'],
        {
          env: spawnEnv,
          shell: process.platform === 'win32' && /\.(?:bat|cmd)$/i.test(commandPath),
          stdio: ['pipe', 'pipe', 'ignore'],
          windowsHide: true,
        },
      );
    } catch {
      resolve([]);
      return;
    }

    let settled = false;
    let buffer = '';

    const finish = (skills: ProjectSkillItem[]) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        child.stdin?.end();
      } catch {
        // Ignore stream close errors.
      }
      if (!child.killed) {
        try {
          child.kill();
        } catch {
          // Ignore already-exited child errors.
        }
      }
      resolve(skills);
    };

    const handleLine = (rawLine: string): boolean => {
      const line = rawLine.trim();
      if (!line) return false;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        return false;
      }
      if (!isRecord(parsed) || parsed.type !== 'control_response') return false;
      const response = toRecord(parsed.response);
      const inner = toRecord(response?.response);
      finish(extractClaudeCodeBuiltinSkills(inner?.commands));
      return true;
    };

    const timer = setTimeout(() => finish([]), BUILTIN_PROBE_TIMEOUT_MS);
    timer.unref?.();

    child.stdin?.on('error', () => {});
    child.on('error', () => finish([]));
    child.stdout?.on('data', (chunk: Buffer | string) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (handleLine(line)) return;
      }
    });
    child.on('close', () => {
      if (!settled && buffer.trim()) {
        handleLine(buffer);
      }
      finish([]);
    });

    try {
      child.stdin?.write(
        `${JSON.stringify({ request: { subtype: 'initialize' }, request_id: '1', type: 'control_request' })}\n`,
      );
    } catch {
      finish([]);
    }
  });
};

const loadClaudeCodeBuiltinSkills = async (env: NodeJS.ProcessEnv): Promise<ProjectSkillItem[]> => {
  const status = await detectHeterogeneousCliCommand('claude-code', 'claude', env).catch(() => ({
    available: false as const,
    path: undefined,
    version: undefined,
  }));
  if (!status.available || !status.path) return [];

  const cacheKey = `${status.path}@${status.version ?? ''}`;
  const cached = builtinSkillsCache.get(cacheKey);
  if (cached) return cached;

  const pending = probeClaudeCodeBuiltinSkills(status.path, env, status.resolvedPathEnv).then(
    (skills) => {
      // Evict empty results so transient spawn failures or timeouts can retry on the next scan.
      if (skills.length === 0) builtinSkillsCache.delete(cacheKey);
      return skills;
    },
    () => {
      builtinSkillsCache.delete(cacheKey);
      return [];
    },
  );
  builtinSkillsCache.set(cacheKey, pending);
  return pending;
};

const listClaudeCodePluginSkills = async ({
  env,
  home,
  managedSettingsDir: customManagedSettingsDir,
  workingDirectory,
}: {
  env: NodeJS.ProcessEnv;
  home: string;
  managedSettingsDir?: string;
  workingDirectory: string;
}): Promise<ProjectSkillItem[]> => {
  const customConfigDir = env.CLAUDE_CONFIG_DIR?.trim();
  const configDir = customConfigDir
    ? path.resolve(workingDirectory, customConfigDir)
    : path.join(home, '.claude');

  const registry = await readJsonObject(path.join(configDir, 'plugins', 'installed_plugins.json'));
  if (!registry) return [];

  const pluginMap = isRecord(registry.plugins) ? registry.plugins : registry;
  const entries = Object.entries(pluginMap);
  if (entries.length === 0) return [];

  const [resolvedWorkingDirectory, projectRoot] = await Promise.all([
    realpath(workingDirectory).catch(() => workingDirectory),
    resolveClaudeCodeProjectRoot(workingDirectory),
  ]);
  const resolvedProjectRoot = await realpath(projectRoot).catch(() => projectRoot);

  const candidates = (
    await Promise.all(
      entries.map(([pluginId, rawEntry]) =>
        selectPluginCandidate(pluginId, rawEntry, {
          resolvedProjectRoot,
          resolvedWorkingDirectory,
          workingDirectory,
        }),
      ),
    )
  ).filter((candidate): candidate is PluginCandidate => candidate !== undefined);

  if (candidates.length === 0) return [];

  const managedSettingsDir = customManagedSettingsDir ?? defaultManagedSettingsDir();
  const settingsList = await readSettingsPrecedenceList({
    configDir,
    managedSettingsDir,
    projectRoot,
    workingDirectory,
  });

  const seen = new Set<string>();
  const skills: ProjectSkillItem[] = [];

  for (const candidate of candidates) {
    const manifest = await readPluginManifest(candidate.installPath);
    const settingsEnabled = resolvePluginEnabledFromSettings(
      settingsList,
      candidate.pluginId,
      candidate.barePluginId,
    );
    const manifestDisabled = manifest?.disabled === true || manifest?.defaultEnabled === false;
    const isEnabled = settingsEnabled ?? !manifestDisabled;
    if (!isEnabled) continue;

    const pluginName =
      pickTrimmedString(manifest?.name) ||
      candidate.barePluginId ||
      path.basename(candidate.installPath);
    const skillRoots = await resolvePluginSkillRoots(candidate.installPath, manifest);

    for (const skillRoot of skillRoots) {
      const childDirs = await listChildDirs(skillRoot);
      const items = await Promise.all(
        childDirs.map((entryName) =>
          readPluginSkillItem(
            path.join(skillRoot, entryName),
            entryName,
            pluginName,
            candidate.scope,
          ),
        ),
      );
      for (const item of items) {
        if (!item || seen.has(item.name)) continue;
        seen.add(item.name);
        skills.push(item);
      }
    }
  }

  return skills;
};

/**
 * Discover Claude Code's enabled plugin skills (from `installed_plugins.json` +
 * settings cascade) and binary-compiled built-in bundled skills (`/loop`,
 * `/claude-api`, `/run`, … via a cached `initialize` probe).
 */
export const listClaudeCodeSkills = async (
  options: ListClaudeCodeSkillsOptions = {},
): Promise<ProjectSkillItem[]> => {
  const home = options.home ?? os.homedir();
  const env = options.env ?? process.env;
  const workingDirectory = path.resolve(options.cwd ?? home);

  const [pluginSkills, builtinSkills] = await Promise.all([
    listClaudeCodePluginSkills({
      env,
      home,
      managedSettingsDir: options.managedSettingsDir,
      workingDirectory,
    }),
    options.includeBuiltins === false ? Promise.resolve([]) : loadClaudeCodeBuiltinSkills(env),
  ]);

  const seen = new Set<string>();
  const skills: ProjectSkillItem[] = [];
  for (const skill of [...pluginSkills, ...builtinSkills]) {
    if (seen.has(skill.name)) continue;
    seen.add(skill.name);
    skills.push(skill);
  }

  return skills;
};
