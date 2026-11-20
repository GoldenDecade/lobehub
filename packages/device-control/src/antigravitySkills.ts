import { execFile } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import * as os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import matter from 'gray-matter';

import type { ProjectSkillItem, ProjectSkillSource } from './types';

const execFileAsync = promisify(execFile);

/** agy has no `skills list`; enabled plugins come from this, with a config fallback. */
const PLUGIN_LIST_TIMEOUT_MS = 4000;

interface AntigravityScanRoot {
  source: Extract<
    ProjectSkillSource,
    'antigravity-builtin' | 'antigravity-global' | 'antigravity-plugin'
  >;
  sourceRoot: string;
}

/**
 * `agy` stores skills outside the working directory. Discovery order is the
 * order callers should prefer on a name collision (a skill the user installed
 * beats a plugin skill, which beats the CLI's own builtins):
 *
 * - global: `~/.gemini/config/skills/<name>/SKILL.md`
 * - plugin: `~/.gemini/config/plugins/<plugin>/skills/<name>/SKILL.md`, only
 *   for plugins `agy plugin list --json` reports enabled (config.json when the
 *   CLI is missing or too slow)
 * - builtin: `~/.gemini/antigravity-cli/builtin/skills/<name>/SKILL.md`
 *
 * Skills marked `disable-slash-command: true` are internal (the swarm pane, UI
 * navigation) and never appear as a `/name` the user can type.
 */
export const antigravitySkillRoots = (home = os.homedir()): AntigravityScanRoot[] => [
  {
    source: 'antigravity-global',
    sourceRoot: path.join(home, '.gemini', 'config', 'skills'),
  },
  {
    source: 'antigravity-plugin',
    sourceRoot: path.join(home, '.gemini', 'config', 'plugins'),
  },
  {
    source: 'antigravity-builtin',
    sourceRoot: path.join(home, '.gemini', 'antigravity-cli', 'builtin', 'skills'),
  },
];

const readString = (data: Record<string, unknown>, field: string) => {
  const value = data[field];
  return typeof value === 'string' ? value.trim() : undefined;
};

/** True when the skill is an internal helper agy itself will not expand from `/name`. */
export const isSlashCommandDisabled = (data: Record<string, unknown>): boolean => {
  const value = data['disable-slash-command'];
  return value === true || value === 'true';
};

interface ParsedSkillFile {
  description?: string;
  disabled: boolean;
  name?: string;
}

const parseSkillFile = (raw: string): ParsedSkillFile => {
  try {
    const { data } = matter(raw) as { data: Record<string, unknown> };
    return {
      description: readString(data, 'description'),
      disabled: isSlashCommandDisabled(data),
      name: readString(data, 'name'),
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

/**
 * A name agy can expand from a leading `/name`. Anything with whitespace or a
 * slash would serialize into a command agy cannot match, so it is dropped
 * rather than offered.
 */
const isInvocableName = (name: string) => /^[\w.-]+$/.test(name);

const readSkillItem = async (
  skillDir: string,
  source: AntigravityScanRoot['source'],
): Promise<ProjectSkillItem | null> => {
  try {
    const skillFile = path.join(skillDir, 'SKILL.md');
    const parsed = parseSkillFile(await readFile(skillFile, 'utf8'));
    if (parsed.disabled) return null;

    const name = parsed.name || path.basename(skillDir);
    if (!isInvocableName(name)) return null;

    return {
      description: parsed.description || undefined,
      name,
      path: skillFile,
      previewRoot: skillDir,
      scope: 'device',
      skillDir,
      source,
    };
  } catch {
    return null;
  }
};

interface PluginListEntry {
  enabled?: boolean;
  path?: string;
}

/** Plugins `agy` itself would load. A missing or slow CLI falls back to config. */
const listEnabledPluginDirs = async (home: string): Promise<string[]> => {
  try {
    const { stdout } = await execFileAsync('agy', ['plugin', 'list', '--json'], {
      timeout: PLUGIN_LIST_TIMEOUT_MS,
      windowsHide: true,
    });
    const parsed = JSON.parse(stdout) as unknown;
    if (!Array.isArray(parsed)) return readEnabledPluginDirsFromConfig(home);

    return parsed
      .filter((entry): entry is PluginListEntry => !!entry && typeof entry === 'object')
      .filter((entry) => entry.enabled !== false && typeof entry.path === 'string')
      .map((entry) => entry.path as string);
  } catch {
    return readEnabledPluginDirsFromConfig(home);
  }
};

/**
 * The rule agy uses when it cannot be asked: a config.json entry wins, and a
 * plugin without one is enabled unless its own plugin.json says `disabled`.
 */
const readEnabledPluginDirsFromConfig = async (home: string): Promise<string[]> => {
  const pluginsDir = path.join(home, '.gemini', 'config', 'plugins');
  const names = await listChildDirs(pluginsDir);

  let configured: Record<string, { enabled?: boolean }> = {};
  try {
    const raw = JSON.parse(
      await readFile(path.join(home, '.gemini', 'config', 'config.json'), 'utf8'),
    ) as { plugins?: unknown };
    if (raw.plugins && typeof raw.plugins === 'object' && !Array.isArray(raw.plugins)) {
      configured = raw.plugins as Record<string, { enabled?: boolean }>;
    }
  } catch {
    // No config — every plugin decides for itself.
  }

  const enabled: string[] = [];
  for (const name of names) {
    const entry = configured[name];
    if (entry && entry.enabled === false) continue;
    if (!entry) {
      try {
        const plugin = JSON.parse(
          await readFile(path.join(pluginsDir, name, 'plugin.json'), 'utf8'),
        ) as { disabled?: boolean };
        if (plugin.disabled === true) continue;
      } catch {
        // A plugin without plugin.json is still a directory agy may load.
      }
    }
    enabled.push(path.join(pluginsDir, name));
  }
  return enabled;
};

const scanFlatRoot = async (root: AntigravityScanRoot): Promise<ProjectSkillItem[]> => {
  const names = await listChildDirs(root.sourceRoot);
  const skills = await Promise.all(
    names.map((name) => readSkillItem(path.join(root.sourceRoot, name), root.source)),
  );
  return skills.filter((skill): skill is ProjectSkillItem => skill !== null);
};

const scanPluginRoot = async (
  root: AntigravityScanRoot,
  home: string,
): Promise<ProjectSkillItem[]> => {
  const pluginDirs = (await listEnabledPluginDirs(home)).filter((dir) =>
    dir.startsWith(root.sourceRoot + path.sep),
  );

  const groups = await Promise.all(
    pluginDirs.map(async (pluginDir) => {
      const names = await listChildDirs(path.join(pluginDir, 'skills'));
      const skills = await Promise.all(
        names.map((name) => readSkillItem(path.join(pluginDir, 'skills', name), root.source)),
      );
      return skills.filter((skill): skill is ProjectSkillItem => skill !== null);
    }),
  );
  return groups.flat();
};

/**
 * agy's own skills, in preference order. A name already seen is dropped, so a
 * user skill shadows a plugin skill of the same name and the menu offers one
 * `/name`.
 */
export const listAntigravitySkills = async (home = os.homedir()): Promise<ProjectSkillItem[]> => {
  const seen = new Set<string>();
  const skills: ProjectSkillItem[] = [];

  for (const root of antigravitySkillRoots(home)) {
    const found =
      root.source === 'antigravity-plugin'
        ? await scanPluginRoot(root, home)
        : await scanFlatRoot(root);
    for (const skill of found) {
      if (seen.has(skill.name)) continue;
      seen.add(skill.name);
      skills.push(skill);
    }
  }

  return skills;
};
