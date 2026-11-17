import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { listClaudeCodeModels, parseClaudeCodeModelPicker } from './claudeCode';

describe('Claude Code modelPicker catalog discovery', () => {
  let root: string;
  let home: string;
  let managed: string;
  let project: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'claude-model-picker-'));
    home = path.join(root, 'home');
    managed = path.join(root, 'managed');
    project = path.join(root, 'repo');
    await mkdir(path.join(home, '.claude'), { recursive: true });
    await mkdir(managed, { recursive: true });
    await mkdir(path.join(project, '.git'), { recursive: true });
    await mkdir(path.join(project, 'packages', 'app', '.claude'), { recursive: true });
  });

  afterEach(async () => {
    await rm(root, { force: true, recursive: true });
  });

  it('parses magpie-style modelPicker.options, keeps [1m] suffixes, and resolves alias defaults', async () => {
    await writeFile(
      path.join(home, '.claude', 'settings.json'),
      JSON.stringify({
        env: {
          ANTHROPIC_BASE_URL: 'http://127.0.0.1:3425',
          ANTHROPIC_DEFAULT_SONNET_MODEL: 'cursor/grok-4.7@256k',
        },
        model: 'sonnet',
        modelPicker: {
          options: [
            {
              description: 'v0 · via magpie',
              label: 'v0-opus',
              model: 'v0/v0-opus',
            },
            {
              description: 'Cursor · via magpie',
              label: 'Grok 4.7 @ 256k',
              model: 'cursor/grok-4.7@256k',
            },
            {
              description: 'Cursor · via magpie',
              label: 'Claude Opus 5.5 @ 1m',
              model: 'cursor/claude-opus-5-5@1m[1m]',
            },
            // Duplicate id is ignored
            {
              label: 'Duplicate Opus',
              model: 'v0/v0-opus',
            },
          ],
        },
      }),
    );

    const models = await listClaudeCodeModels({
      cwd: project,
      env: {},
      home,
      managedSettingsDir: managed,
    });

    expect(models).toEqual([
      {
        id: 'v0/v0-opus',
        label: 'v0-opus',
        modelId: 'v0-opus',
        providerId: 'v0',
      },
      {
        id: 'cursor/grok-4.7@256k',
        isDefault: true,
        label: 'Grok 4.7 @ 256k',
        modelId: 'grok-4.7@256k',
        providerId: 'cursor',
      },
      {
        id: 'cursor/claude-opus-5-5@1m[1m]',
        label: 'Claude Opus 5.5 @ 1m',
        modelId: 'claude-opus-5-5@1m[1m]',
        providerId: 'cursor',
      },
    ]);
  });

  it('returns an empty list when no settings file configures modelPicker.options', async () => {
    await writeFile(path.join(home, '.claude', 'settings.json'), JSON.stringify({ model: 'opus' }));

    await expect(
      listClaudeCodeModels({ cwd: project, env: {}, home, managedSettingsDir: managed }),
    ).resolves.toEqual([]);
  });

  it('applies settings precedence (--settings > project > CLAUDE_CONFIG_DIR > user) and --setting-sources', async () => {
    const customConfigDir = path.join(root, 'custom-profile');
    await mkdir(customConfigDir, { recursive: true });
    await mkdir(path.join(project, '.claude'), { recursive: true });

    await writeFile(
      path.join(home, '.claude', 'settings.json'),
      JSON.stringify({ modelPicker: { options: [{ label: 'Home', model: 'home/model' }] } }),
    );
    await writeFile(
      path.join(customConfigDir, 'settings.json'),
      JSON.stringify({ modelPicker: { options: [{ label: 'Profile', model: 'profile/model' }] } }),
    );
    await writeFile(
      path.join(project, '.claude', 'settings.json'),
      JSON.stringify({ modelPicker: { options: [{ label: 'Project', model: 'project/model' }] } }),
    );

    // Subdirectory inherits git root `.claude/settings.json` over CLAUDE_CONFIG_DIR
    const subdir = path.join(project, 'packages', 'app');
    const fromProject = await listClaudeCodeModels({
      cwd: subdir,
      env: { CLAUDE_CONFIG_DIR: customConfigDir },
      home,
      managedSettingsDir: managed,
    });
    expect(fromProject.map((item) => item.id)).toEqual(['project/model']);

    // `--setting-sources=user` skips project settings and reads CLAUDE_CONFIG_DIR
    const userOnly = await listClaudeCodeModels({
      args: ['--setting-sources=user'],
      cwd: subdir,
      env: { CLAUDE_CONFIG_DIR: customConfigDir },
      home,
      managedSettingsDir: managed,
    });
    expect(userOnly.map((item) => item.id)).toEqual(['profile/model']);

    // Inline `--settings` overrides everything
    const fromArg = await listClaudeCodeModels({
      args: [
        '--settings',
        JSON.stringify({ modelPicker: { options: [{ label: 'Inline', model: 'inline-model' }] } }),
      ],
      cwd: subdir,
      env: { CLAUDE_CONFIG_DIR: customConfigDir },
      home,
      managedSettingsDir: managed,
    });
    expect(fromArg).toEqual([
      {
        id: 'inline-model',
        label: 'Inline',
        modelId: 'inline-model',
        providerId: 'claude-code',
      },
    ]);
  });

  it('ignores malformed entries in parseClaudeCodeModelPicker', () => {
    expect(
      parseClaudeCodeModelPicker([
        undefined,
        { modelPicker: 'invalid' },
        {
          modelPicker: {
            options: [null, {}, { model: '   ' }, { label: 'Valid', model: 'grok/grok-4.7' }],
          },
        },
      ]),
    ).toEqual([
      {
        id: 'grok/grok-4.7',
        label: 'Valid',
        modelId: 'grok-4.7',
        providerId: 'grok',
      },
    ]);
  });
});
