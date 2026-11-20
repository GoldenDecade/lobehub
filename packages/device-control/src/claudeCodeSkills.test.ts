import type * as NodeChildProcess from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  extractClaudeCodeBuiltinSkills,
  listClaudeCodeSkills,
  resetClaudeCodeBuiltinSkillsCache,
} from './claudeCodeSkills';

const mocks = vi.hoisted(() => ({
  detectHeterogeneousCliCommand: vi.fn(),
  spawn: vi.fn(),
}));

vi.mock('@lobechat/heterogeneous-agents/resolveCliCommand', () => ({
  detectHeterogeneousCliCommand: mocks.detectHeterogeneousCliCommand,
}));

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof NodeChildProcess>();
  return {
    ...actual,
    spawn: mocks.spawn,
  };
});

let base: string;
let home: string;
let managedDir: string;

const write = async (file: string, content: string) => {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
};

const writeJson = (file: string, value: unknown) => write(file, JSON.stringify(value, null, 2));

const skillMd = (name: string, extra = '') =>
  `---\nname: ${name}\ndescription: ${name} skill\n${extra}---\n\n# ${name}\n`;

const createMockChild = () => {
  const child = new EventEmitter() as EventEmitter & {
    kill: ReturnType<typeof vi.fn>;
    killed: boolean;
    stdin: EventEmitter & { end: ReturnType<typeof vi.fn>; write: ReturnType<typeof vi.fn> };
    stdout: EventEmitter;
  };
  child.killed = false;
  child.kill = vi.fn(() => {
    child.killed = true;
    return true;
  });
  child.stdout = new EventEmitter();
  child.stdin = Object.assign(new EventEmitter(), {
    end: vi.fn(),
    write: vi.fn(),
  });
  return child;
};

beforeEach(async () => {
  base = await mkdtemp(path.join(tmpdir(), 'claude-plugin-skills-'));
  home = path.join(base, 'home');
  managedDir = path.join(base, 'managed');
  await mkdir(home, { recursive: true });
  await mkdir(managedDir, { recursive: true });
  resetClaudeCodeBuiltinSkillsCache();
  mocks.detectHeterogeneousCliCommand.mockReset().mockResolvedValue({ available: false });
  mocks.spawn.mockReset();
});

afterEach(async () => {
  resetClaudeCodeBuiltinSkillsCache();
  await rm(base, { force: true, recursive: true });
});

describe('extractClaudeCodeBuiltinSkills', () => {
  it('keeps prompt-based bundled skills, trims multi-line descriptions, and drops TUI/internal commands', () => {
    const skills = extractClaudeCodeBuiltinSkills([
      {
        builtin: true,
        description: 'Run a prompt or slash command on a recurring interval (e.g. /loop 5m /foo).',
        name: 'loop',
      },
      {
        builtin: true,
        description:
          'Reference for the Claude API / Anthropic SDK.\n\nTRIGGER — read FIRST before you answer.',
        name: 'claude-api',
      },
      {
        builtin: true,
        description: 'Launch and drive this project app.',
        name: 'run',
      },
      {
        builtin: true,
        description: 'Review changed code.',
        name: 'simplify',
      },
      {
        builtin: true,
        description: 'Execute large-scale work in parallel.',
        name: 'batch',
      },
      {
        builtin: true,
        description: 'Free up context by summarizing.',
        name: 'compact',
      },
      {
        builtin: true,
        description: 'Set a goal.',
        name: 'goal',
      },
      {
        builtin: true,
        description: 'Set the prompt bar color.',
        name: 'color',
      },
      {
        builtin: true,
        description: 'Run workflow script.',
        name: '__remote-workflow',
      },
      {
        builtin: true,
        description: '(removed) Ask Claude to manage subagents.',
        name: 'agents',
      },
      {
        builtin: false,
        description: 'User skill from disk.',
        name: 'user-skill',
      },
    ]);

    expect(skills).toEqual([
      {
        description: 'Run a prompt or slash command on a recurring interval (e.g. /loop 5m /foo).',
        name: 'loop',
        path: '',
        previewRoot: '',
        scope: 'device',
        skillDir: 'claude-code-builtin:loop',
        source: 'claude-code-builtin',
      },
      {
        description: 'Reference for the Claude API / Anthropic SDK.',
        name: 'claude-api',
        path: '',
        previewRoot: '',
        scope: 'device',
        skillDir: 'claude-code-builtin:claude-api',
        source: 'claude-code-builtin',
      },
      {
        description: 'Launch and drive this project app.',
        name: 'run',
        path: '',
        previewRoot: '',
        scope: 'device',
        skillDir: 'claude-code-builtin:run',
        source: 'claude-code-builtin',
      },
      {
        description: 'Review changed code.',
        name: 'simplify',
        path: '',
        previewRoot: '',
        scope: 'device',
        skillDir: 'claude-code-builtin:simplify',
        source: 'claude-code-builtin',
      },
      {
        description: 'Execute large-scale work in parallel.',
        name: 'batch',
        path: '',
        previewRoot: '',
        scope: 'device',
        skillDir: 'claude-code-builtin:batch',
        source: 'claude-code-builtin',
      },
    ]);
  });
});

describe('listClaudeCodeSkills', () => {
  it('returns [] when installed_plugins.json is missing or empty and builtins are excluded', async () => {
    const repo = path.join(base, 'repo');
    await mkdir(repo, { recursive: true });

    expect(
      await listClaudeCodeSkills({
        cwd: repo,
        env: {},
        home,
        includeBuiltins: false,
        managedSettingsDir: managedDir,
      }),
    ).toEqual([]);

    await writeJson(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), {
      plugins: {},
      version: 2,
    });

    expect(
      await listClaudeCodeSkills({
        cwd: repo,
        env: {},
        home,
        includeBuiltins: false,
        managedSettingsDir: managedDir,
      }),
    ).toEqual([]);
  });

  it('probes claude initialize over multi-chunk stdout, caches results, and works without installed_plugins.json', async () => {
    const repo = path.join(base, 'repo');
    await mkdir(repo, { recursive: true });

    mocks.detectHeterogeneousCliCommand.mockResolvedValue({
      available: true,
      path: '/usr/local/bin/claude',
      resolvedPathEnv: '/usr/local/bin:/usr/bin',
      version: '2.1.325',
    });

    mocks.spawn.mockImplementation(() => {
      const child = createMockChild();
      child.stdin.write.mockImplementation(() => {
        const payload = JSON.stringify({
          response: {
            response: {
              commands: [
                {
                  builtin: true,
                  description: 'Repeat on an interval.',
                  name: 'loop',
                },
                {
                  builtin: true,
                  description: 'Reference for the Claude API.',
                  name: 'claude-api',
                },
                {
                  builtin: true,
                  description: 'Free up context.',
                  name: 'compact',
                },
              ],
            },
          },
          type: 'control_response',
        });
        const splitAt = Math.floor(payload.length / 2);
        queueMicrotask(() => {
          child.stdout.emit('data', Buffer.from(payload.slice(0, splitAt)));
          child.stdout.emit('data', Buffer.from(`${payload.slice(splitAt)}\n`));
        });
        return true;
      });
      return child;
    });

    const first = await listClaudeCodeSkills({
      cwd: repo,
      env: { CLAUDECODE: '1', CLAUDE_CODE_ENTRYPOINT: 'cli' },
      home,
      managedSettingsDir: managedDir,
    });
    const second = await listClaudeCodeSkills({
      cwd: repo,
      env: {},
      home,
      managedSettingsDir: managedDir,
    });

    expect(first.map((item) => `${item.name}:${item.source}`)).toEqual([
      'loop:claude-code-builtin',
      'claude-api:claude-code-builtin',
    ]);
    expect(second).toEqual(first);
    expect(mocks.spawn).toHaveBeenCalledTimes(1);
    const [, args, spawnOpts] = mocks.spawn.mock.calls[0];
    expect(args).toEqual([
      '-p',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--verbose',
    ]);
    expect(spawnOpts.env.CLAUDECODE).toBeUndefined();
    expect(spawnOpts.env.CLAUDE_CODE_ENTRYPOINT).toBeUndefined();
    expect(spawnOpts.env.PATH).toBe('/usr/local/bin:/usr/bin');
  });

  it('discovers enabled user-scoped plugin skills with colon namespaces and nested files', async () => {
    const repo = path.join(base, 'repo');
    const installPath = path.join(
      home,
      '.claude',
      'plugins',
      'cache',
      'official',
      'frontend-design',
      '1.0.0',
    );
    await mkdir(repo, { recursive: true });

    await writeJson(path.join(installPath, '.claude-plugin', 'plugin.json'), {
      name: 'frontend-design',
      version: '1.0.0',
    });
    await write(
      path.join(installPath, 'skills', 'frontend-design', 'SKILL.md'),
      skillMd('frontend-design'),
    );
    await write(
      path.join(installPath, 'skills', 'frontend-design', 'references', 'tokens.md'),
      '# Tokens\n',
    );
    await writeJson(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), {
      plugins: {
        'frontend-design@claude-plugins-official': [
          { installPath, scope: 'user', version: '1.0.0' },
        ],
      },
      version: 2,
    });

    const skills = await listClaudeCodeSkills({
      cwd: repo,
      env: {},
      home,
      includeBuiltins: false,
      managedSettingsDir: managedDir,
    });

    const skillDir = path.join(installPath, 'skills', 'frontend-design');
    expect(skills).toEqual([
      {
        description: 'frontend-design skill',
        name: 'frontend-design:frontend-design',
        path: path.join(skillDir, 'SKILL.md'),
        previewRoot: skillDir,
        scope: 'device',
        skillDir,
        source: 'claude-code-plugin',
      },
    ]);
  });

  it('respects settings precedence and manifest defaultEnabled / disabled flags', async () => {
    const repo = path.join(base, 'repo');
    await mkdir(path.join(repo, '.git'), { recursive: true });

    const pluginA = path.join(base, 'cache', 'plugin-a');
    const pluginB = path.join(base, 'cache', 'plugin-b');
    const pluginC = path.join(base, 'cache', 'plugin-c');
    const pluginD = path.join(base, 'cache', 'plugin-d');

    await writeJson(path.join(pluginA, '.claude-plugin', 'plugin.json'), { name: 'alpha' });
    await write(path.join(pluginA, 'skills', 'run', 'SKILL.md'), skillMd('run'));

    await writeJson(path.join(pluginB, '.claude-plugin', 'plugin.json'), { name: 'beta' });
    await write(path.join(pluginB, 'skills', 'check', 'SKILL.md'), skillMd('check'));

    await writeJson(path.join(pluginC, '.claude-plugin', 'plugin.json'), {
      defaultEnabled: false,
      name: 'gamma',
    });
    await write(path.join(pluginC, 'skills', 'opt', 'SKILL.md'), skillMd('opt'));

    await writeJson(path.join(pluginD, '.claude-plugin', 'plugin.json'), {
      disabled: true,
      name: 'delta',
    });
    await write(path.join(pluginD, 'skills', 'nope', 'SKILL.md'), skillMd('nope'));

    await writeJson(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), {
      plugins: {
        'alpha@mkt': [{ installPath: pluginA, scope: 'user' }],
        'beta@mkt': [{ installPath: pluginB, scope: 'user' }],
        'delta@mkt': [{ installPath: pluginD, scope: 'user' }],
        'gamma@mkt': [{ installPath: pluginC, scope: 'user' }],
      },
      version: 2,
    });

    // User settings disable alpha; project settings.local.json re-enables alpha and disables beta.
    await writeJson(path.join(home, '.claude', 'settings.json'), {
      enabledPlugins: {
        'alpha@mkt': false,
        'beta@mkt': true,
      },
    });
    await writeJson(path.join(repo, '.claude', 'settings.local.json'), {
      enabledPlugins: {
        'alpha@mkt': true,
        'beta@mkt': false,
      },
    });

    const skills = await listClaudeCodeSkills({
      cwd: repo,
      env: {},
      home,
      includeBuiltins: false,
      managedSettingsDir: managedDir,
    });

    expect(skills.map((item) => item.name)).toEqual(['alpha:run']);
  });

  it('filters project/local-scoped plugins by projectPath and maps scope to project', async () => {
    const repo = path.join(base, 'repo');
    const subdir = path.join(repo, 'packages', 'web');
    const otherRepo = path.join(base, 'other-repo');
    await mkdir(path.join(repo, '.git'), { recursive: true });
    await mkdir(subdir, { recursive: true });
    await mkdir(otherRepo, { recursive: true });

    const matchingPlugin = path.join(base, 'cache', 'proj-plugin');
    const unrelatedPlugin = path.join(base, 'cache', 'other-plugin');
    await writeJson(path.join(matchingPlugin, '.claude-plugin', 'plugin.json'), { name: 'proj' });
    await write(path.join(matchingPlugin, 'skills', 'ship', 'SKILL.md'), skillMd('ship'));
    await writeJson(path.join(unrelatedPlugin, '.claude-plugin', 'plugin.json'), {
      name: 'other',
    });
    await write(path.join(unrelatedPlugin, 'skills', 'hide', 'SKILL.md'), skillMd('hide'));

    await writeJson(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), {
      plugins: {
        'other@mkt': [{ installPath: unrelatedPlugin, projectPath: otherRepo, scope: 'project' }],
        'proj@mkt': [{ installPath: matchingPlugin, projectPath: repo, scope: 'local' }],
      },
      version: 2,
    });

    const skills = await listClaudeCodeSkills({
      cwd: subdir,
      env: {},
      home,
      includeBuiltins: false,
      managedSettingsDir: managedDir,
    });

    expect(skills).toHaveLength(1);
    expect(skills[0]).toMatchObject({
      name: 'proj:ship',
      scope: 'project',
      source: 'claude-code-plugin',
    });
  });

  it('skips non-invocable skills and internal @skills-dir / lobehub@inline entries', async () => {
    const repo = path.join(base, 'repo');
    await mkdir(repo, { recursive: true });

    const plugin = path.join(base, 'cache', 'tooling');
    const skillsDirPlugin = path.join(home, '.claude', 'skills', 'local-one');
    await writeJson(path.join(plugin, '.claude-plugin', 'plugin.json'), { name: 'tooling' });
    await write(path.join(plugin, 'skills', 'visible', 'SKILL.md'), skillMd('visible'));
    await write(
      path.join(plugin, 'skills', 'hidden-ui', 'SKILL.md'),
      skillMd('hidden-ui', 'user-invocable: false\n'),
    );
    await write(
      path.join(plugin, 'skills', 'hidden-slash', 'SKILL.md'),
      skillMd('hidden-slash', 'disable-slash-command: true\n'),
    );
    await write(path.join(skillsDirPlugin, 'SKILL.md'), skillMd('local-one'));

    await writeJson(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), {
      plugins: {
        'lobehub@inline': [{ installPath: plugin, scope: 'user' }],
        'local-one@skills-dir': [{ installPath: skillsDirPlugin, scope: 'user' }],
        'tooling@mkt': [{ installPath: plugin, scope: 'user' }],
      },
      version: 2,
    });

    const skills = await listClaudeCodeSkills({
      cwd: repo,
      env: {},
      home,
      includeBuiltins: false,
      managedSettingsDir: managedDir,
    });

    expect(skills.map((item) => item.name)).toEqual(['tooling:visible']);
  });

  it('respects CLAUDE_CONFIG_DIR and custom manifest.skills while blocking traversal', async () => {
    const repo = path.join(base, 'repo');
    const customConfigDir = path.join(base, 'custom-claude');
    const outsideDir = path.join(base, 'outside-skills');
    await mkdir(repo, { recursive: true });

    const plugin = path.join(base, 'cache', 'custom');
    await write(path.join(outsideDir, 'escape', 'SKILL.md'), skillMd('escape'));
    await write(path.join(plugin, 'custom-skills', 'lint', 'SKILL.md'), skillMd('lint'));
    await mkdir(path.join(plugin, 'linked-skills'), { recursive: true });
    await symlink(
      path.join(outsideDir, 'escape'),
      path.join(plugin, 'linked-skills', 'escape-link'),
    ).catch(() => {});

    await writeJson(path.join(plugin, '.claude-plugin', 'plugin.json'), {
      name: 'custom',
      skills: ['custom-skills', '../outside-skills', 'linked-skills/escape-link'],
    });
    await writeJson(path.join(customConfigDir, 'plugins', 'installed_plugins.json'), {
      plugins: {
        'custom@mkt': [{ installPath: plugin, scope: 'user' }],
      },
      version: 2,
    });

    const skills = await listClaudeCodeSkills({
      cwd: repo,
      env: { CLAUDE_CONFIG_DIR: customConfigDir },
      home,
      includeBuiltins: false,
      managedSettingsDir: managedDir,
    });

    expect(skills.map((item) => item.name)).toEqual(['custom:lint']);
  });
});
