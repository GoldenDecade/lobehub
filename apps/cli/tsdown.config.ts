import { createRequire } from 'node:module';
import path from 'node:path';

import { defineConfig } from 'tsdown';

const require = createRequire(import.meta.url);
const zodDir = path.dirname(require.resolve('zod/package.json'));

export default defineConfig({
  banner: { js: '#!/usr/bin/env node' },
  clean: true,
  deps: {
    // The desktop app executes this bundle directly from Resources/bin, where
    // the published package's node_modules tree does not exist. Keep the only
    // production dependency inside the bundle so the embedded CLI is truly
    // self-contained instead of failing at startup with ERR_MODULE_NOT_FOUND.
    alwaysBundle: ['ws'],
    // `@lydell/node-pty` is deliberately NOT bundled: it loads a prebuilt
    // native binary per platform, which bundling would break. It stays a real
    // runtime dependency and is imported lazily (see `src/device/terminal.ts`),
    // so only a process that actually opens a remote terminal resolves it —
    // the desktop-embedded CLI keeps working without it.
    neverBundle: ['@lydell/node-pty'],
  },
  entry: ['src/index.ts'],
  fixedExtension: false,
  format: ['esm'],
  inputOptions(options) {
    // Rolldown downgrades an unresolvable import to an external dependency and
    // still reports a successful build, so a workspace package that fails to
    // resolve (a broken `node_modules` link, a renamed package) silently ships
    // a bundle that dies at startup with ERR_MODULE_NOT_FOUND. Nothing the CLI
    // imports is expected to be external, so treat it as a build failure.
    options.onLog = (level, log, defaultHandler) => {
      if (log.code === 'UNRESOLVED_IMPORT') {
        throw new Error(
          `Unresolved import in the CLI bundle: ${log.message}. The embedded CLI has no node_modules at runtime, so every import must be bundled.`,
        );
      }

      defaultHandler(level, log);
    };

    // Dedupe `zod` across the root and `apps/desktop` pnpm workspaces and keep
    // its module initializers intact under `codeSplitting: false`. `zod@4.6+`
    // declares narrow `sideEffects`, causing Rolldown to wrap `schemas.js` in
    // `__esmMin` (via dynamic imports like `@modelcontextprotocol/client`) while
    // eliding the initializer call at static call sites (`Class is not a constructor`).
    options.resolve = {
      ...options.resolve,
      alias: {
        ...(options.resolve?.alias as Record<string, string> | undefined),
        zod: zodDir,
      },
    };
    const existingTreeshake =
      typeof options.treeshake === 'object' && options.treeshake !== null ? options.treeshake : {};
    const existingModuleSideEffects = Array.isArray(existingTreeshake.moduleSideEffects)
      ? existingTreeshake.moduleSideEffects
      : [];
    options.treeshake = {
      ...existingTreeshake,
      moduleSideEffects: [
        ...existingModuleSideEffects,
        { sideEffects: true, test: /[\\/]node_modules[\\/].*zod[\\/]/ },
      ],
    };

    return options;
  },
  minify: !!process.env.MINIFY,
  outputOptions: {
    codeSplitting: false,
  },
  platform: 'node',
  // Matches the `engines.node` floor: reading a compressed trace snapshot needs
  // `node:zlib` zstd, which lands in 22.15. Node 20 went EOL in April 2026.
  target: 'node22',
});
