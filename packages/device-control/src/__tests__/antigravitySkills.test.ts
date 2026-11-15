import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { listAntigravitySkills } from '../antigravitySkills';

const execFile = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({ execFile }));

let home: string;

const write = async (file: string, content: string) => {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
};

const skill = (name: string, extra = '') =>
  `---\nname: ${name}\ndescription: ${name} skill\n${extra}---\n\n# ${name}\n`;

beforeEach(async () => {
  home = await mkdtemp(path.join(tmpdir(), 'agy-skills-'));
  execFile.mockReset();
});

afterEach(async () => {
  await rm(home, { force: true, recursive: true });
});

const roots = () => ({
  builtin: path.join(home, '.gemini', 'antigravity-cli', 'builtin', 'skills'),
  global: path.join(home, '.gemini', 'config', 'skills'),
  plugins: path.join(home, '.gemini', 'config', 'plugins'),
});

describe('listAntigravitySkills', () => {
  it('lists builtin, global and enabled-plugin skills, dropping internal ones', async () => {
    const { builtin, global, plugins } = roots();
    await write(path.join(builtin, 'native_swarm', 'SKILL.md'), skill('swarm'));
    await write(
      path.join(builtin, 'swarm_pane', 'SKILL.md'),
      skill('swarm_pane', 'disable-slash-command: true\n'),
    );
    await write(path.join(global, 'ego-browser', 'SKILL.md'), skill('ego-browser'));
    await write(
      path.join(plugins, 'sentry', 'skills', 'sentry-debug-issue', 'SKILL.md'),
      skill('sentry-debug-issue'),
    );
    await write(path.join(plugins, 'sentry', 'plugin.json'), JSON.stringify({ name: 'sentry' }));
    await write(
      path.join(plugins, 'draft', 'skills', 'draft-skill', 'SKILL.md'),
      skill('draft-skill'),
    );
    await write(
      path.join(plugins, 'draft', 'plugin.json'),
      JSON.stringify({ disabled: true, name: 'draft' }),
    );
    execFile.mockImplementation((_cmd, _args, _opts, cb) => cb(new Error('agy not installed')));

    const skills = await listAntigravitySkills(home);

    expect(skills.map((item) => `${item.name}:${item.source}`)).toEqual([
      'ego-browser:antigravity-global',
      'sentry-debug-issue:antigravity-plugin',
      'swarm:antigravity-builtin',
    ]);
  });

  it('lets a user skill shadow a builtin of the same name', async () => {
    const { builtin, global } = roots();
    await write(path.join(global, 'swarm', 'SKILL.md'), skill('swarm'));
    await write(path.join(builtin, 'native_swarm', 'SKILL.md'), skill('swarm'));
    execFile.mockImplementation((_cmd, _args, _opts, cb) => cb(new Error('no agy')));

    const skills = await listAntigravitySkills(home);

    expect(skills).toHaveLength(1);
    expect(skills[0]).toMatchObject({ name: 'swarm', source: 'antigravity-global' });
  });

  it('trusts agy plugin list over the on-disk plugin.json', async () => {
    const { plugins } = roots();
    await write(
      path.join(plugins, 'extra', 'skills', 'extra-skill', 'SKILL.md'),
      skill('extra-skill'),
    );
    execFile.mockImplementation((_cmd, args, _opts, cb) => {
      expect(args).toEqual(['plugin', 'list', '--json']);
      cb(null, JSON.stringify([{ enabled: true, path: path.join(plugins, 'extra') }]), '');
    });

    const skills = await listAntigravitySkills(home);

    expect(skills.map((item) => item.name)).toEqual(['extra-skill']);
  });

  it('returns nothing when agy is not installed and no skill dirs exist', async () => {
    execFile.mockImplementation((_cmd, _args, _opts, cb) => cb(new Error('not found')));

    expect(await listAntigravitySkills(home)).toEqual([]);
  });
});
