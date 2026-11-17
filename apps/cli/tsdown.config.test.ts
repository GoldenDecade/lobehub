import { existsSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import config from './tsdown.config';

const resolveInputOptions = async () => {
  const { inputOptions } = config as {
    inputOptions: (options: Record<string, any>, ...rest: any[]) => Promise<any> | any;
  };

  const options: Record<string, any> = {};
  await inputOptions(options, 'esm', { cjsDts: false });

  return options;
};

describe('CLI build configuration', () => {
  it('bundles ws so the desktop-embedded CLI runs without node_modules', () => {
    expect(config).toEqual(
      expect.objectContaining({
        deps: expect.objectContaining({ alwaysBundle: expect.arrayContaining(['ws']) }),
      }),
    );
  });

  it('keeps the native PTY module external instead of bundling its binary', () => {
    expect(config).toEqual(
      expect.objectContaining({
        deps: expect.objectContaining({
          neverBundle: expect.arrayContaining(['@lydell/node-pty']),
        }),
      }),
    );
  });

  it('fails the build instead of externalizing an unresolved import', async () => {
    const { onLog } = await resolveInputOptions();

    expect(() =>
      onLog(
        'warn',
        {
          code: 'UNRESOLVED_IMPORT',
          message: `Could not resolve '@lobechat/device-control' in src/commands/connect.ts`,
        },
        vi.fn(),
      ),
    ).toThrow('@lobechat/device-control');
  });

  it('forwards every other log to the default handler', async () => {
    const { onLog } = await resolveInputOptions();
    const defaultHandler = vi.fn();
    const log = { code: 'INEFFECTIVE_DYNAMIC_IMPORT', message: 'dynamic import will not move' };

    onLog('warn', log, defaultHandler);

    expect(defaultHandler).toHaveBeenCalledWith('warn', log);
  });

  it('dedupes zod and preserves its module side effects under codeSplitting:false', async () => {
    const options = await resolveInputOptions();

    expect(typeof options.resolve?.alias?.zod).toBe('string');
    expect(existsSync(path.join(options.resolve.alias.zod, 'package.json'))).toBe(true);
    expect(options.treeshake?.moduleSideEffects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sideEffects: true,
          test: expect.any(RegExp),
        }),
      ]),
    );
    const zodRule = options.treeshake.moduleSideEffects.find(
      (rule: { sideEffects?: boolean; test?: RegExp }) =>
        rule.sideEffects === true && rule.test instanceof RegExp,
    );
    expect(
      zodRule.test.test(
        '/repo/node_modules/.pnpm/zod@4.6.5/node_modules/zod/v4/classic/schemas.js',
      ),
    ).toBe(true);
  });
});
