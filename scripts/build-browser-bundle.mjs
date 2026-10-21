#!/usr/bin/env node
/**
 * Browser bundles (#76).
 *
 *   node scripts/build-browser-bundle.mjs [--out <dir>] [--require-lockstep]
 *
 * Produces, under `<out>` (default `browser-bundles/`):
 *
 *   <version>/zenith.min.js          IIFE, minified, `window.Zenith`   (umbrella `zenith/browser`)
 *   <version>/zenith.min.js.map      separate sourcemap file, referenced by a trailing `sourceMappingURL` comment
 *   <version>/zenith-runtime.js(.map) minified ESM runtime bundle
 *   <version>/integrity.json         sha384 (SRI) + byte size of every file above
 *   latest/…                         byte-identical copy, `"pinned": false` (moves every release)
 *   zenith-runtime.js(.map)          legacy flat copy used by the size budget / README / e2e
 *
 * `<version>` is the version of the `zenith` umbrella package. It must equal the version the
 * bundle reports at runtime (`Zenith.version`) — the build fails otherwise — and with
 * `--require-lockstep` (used when publishing) every workspace package must share it (DEC-026).
 * Versioned paths are immutable: pin them with `<script integrity>`; never pin `latest/`.
 */
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const ALGORITHM = 'sha384';

export function sriOf(bytes) {
  return `${ALGORITHM}-${createHash(ALGORITHM).update(bytes).digest('base64')}`;
}

/** Pure lockstep check: returns the offending `name@version` entries (empty = all equal). */
export function lockstepViolations(packages, expected) {
  return packages.filter((p) => p.version !== expected).map((p) => `${p.name}@${p.version}`);
}

function workspacePackages(root) {
  const dir = join(root, 'packages');
  return readdirSync(dir)
    .map((d) => join(dir, d, 'package.json'))
    .filter((f) => existsSync(f))
    .map((f) => JSON.parse(readFileSync(f, 'utf8')))
    .filter((p) => p.private !== true && typeof p.version === 'string');
}

/** Resolve `@zenith/<pkg>[/<sub>]` to workspace sources (the bundle must not read dist/). */
function workspaceSourcePlugin(root) {
  return {
    name: 'resolve-zenith-workspace-sources',
    setup(b) {
      b.onResolve({ filter: /^@zenith\/[^/]+(\/.+)?$/ }, (args) => {
        const [slug, ...rest] = args.path.slice('@zenith/'.length).split('/');
        const file = join(root, 'packages', slug, 'src', `${rest.join('/') || 'index'}.ts`);
        if (!existsSync(file)) {
          return { errors: [{ text: `Zenith workspace source was not found for ${args.path}` }] };
        }
        return { path: file };
      });
    },
  };
}

export async function buildBrowserBundles({
  root = process.cwd(),
  out = join(root, 'browser-bundles'),
  requireLockstep = false,
} = {}) {
  const umbrella = JSON.parse(
    readFileSync(join(root, 'packages', 'zenith', 'package.json'), 'utf8'),
  );
  const version = umbrella.version;

  const runtimeCore = readFileSync(
    join(root, 'packages', 'runtime-core', 'src', 'index.ts'),
    'utf8',
  );
  const reported = /ZENITH_RUNTIME_CORE_VERSION\s*=\s*['"]([^'"]+)['"]/.exec(runtimeCore)?.[1];
  if (reported !== version) {
    throw new Error(
      `bundle version mismatch: packages/zenith is ${version} but the bundle would report ` +
        `Zenith.version = ${reported} (ZENITH_RUNTIME_CORE_VERSION). Bump them together.`,
    );
  }
  if (requireLockstep) {
    const bad = lockstepViolations(workspacePackages(root), version);
    if (bad.length > 0) {
      throw new Error(
        `lockstep violation: every package must be ${version} (DEC-026) — ${bad.length} are not: ` +
          `${bad.slice(0, 5).join(', ')}${bad.length > 5 ? ', …' : ''}`,
      );
    }
  }

  const versionDir = join(out, version);
  rmSync(versionDir, { recursive: true, force: true });
  mkdirSync(versionDir, { recursive: true });
  const common = {
    bundle: true,
    platform: 'browser',
    target: 'es2022',
    minify: true,
    sourcemap: 'linked',
    plugins: [workspaceSourcePlugin(root)],
    absWorkingDir: root,
    logLevel: 'warning',
    // #57 — browser bundles are published artifacts: always production
    // (no development variant of these files exists).
    define: { __ZENITH_DEV__: 'false', 'globalThis.__ZENITH_DEV__': 'false' },
  };

  // 1) classic <script> bundle exposing window.Zenith
  await build({
    ...common,
    entryPoints: [join(root, 'packages', 'zenith', 'src', 'browser.ts')],
    outfile: join(versionDir, 'zenith.min.js'),
    format: 'iife',
    globalName: 'Zenith',
    banner: { js: `/*! zenith v${version} | MIT | https://github.com/legionir/zenith-v1.4.0 */` },
    // esbuild's IIFE assigns the module NAMESPACE to `var Zenith`, clobbering the frozen
    // `ZenithBrowser` that browser.ts installs on globalThis (so `Zenith.version` was undefined).
    footer: { js: 'Zenith=Zenith.ZenithBrowser;' },
  });
  // 2) ESM runtime bundle (what README / e2e / the size budget have always used)
  await build({
    ...common,
    entryPoints: [join(root, 'packages', 'runtime', 'src', 'index.ts')],
    outfile: join(versionDir, 'zenith-runtime.js'),
    format: 'esm',
    banner: { js: `/*! @zenith/runtime bundle v${version} | MIT */` },
  });

  const files = {};
  for (const name of readdirSync(versionDir).sort()) {
    const bytes = readFileSync(join(versionDir, name));
    files[name] = { integrity: sriOf(bytes), bytes: bytes.length };
  }
  const manifest = (extra) => ({ version, algorithm: ALGORITHM, ...extra, files });
  writeFileSync(
    join(versionDir, 'integrity.json'),
    JSON.stringify(manifest({ pinned: true }), null, 2) + '\n',
  );

  // `latest/` is a moving alias: identical bytes, but SRI must not be pinned against it.
  const latestDir = join(out, 'latest');
  rmSync(latestDir, { recursive: true, force: true });
  mkdirSync(latestDir, { recursive: true });
  for (const name of Object.keys(files))
    copyFileSync(join(versionDir, name), join(latestDir, name));
  writeFileSync(
    join(latestDir, 'integrity.json'),
    JSON.stringify(
      manifest({
        pinned: false,
        note: 'latest/ changes on every release — pin SRI against the versioned directory instead.',
      }),
      null,
      2,
    ) + '\n',
  );

  // legacy flat copy (size budget, README importmap, e2e)
  copyFileSync(join(versionDir, 'zenith-runtime.js'), join(out, 'zenith-runtime.js'));
  copyFileSync(join(versionDir, 'zenith-runtime.js.map'), join(out, 'zenith-runtime.js.map'));
  // the flat copy's sourcemap comment points at its own sibling .map (same basename) — keep it valid

  return { version, versionDir, latestDir, files };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  try {
    const result = await buildBrowserBundles({
      ...(outIdx >= 0 ? { out: resolve(args[outIdx + 1]) } : {}),
      requireLockstep: args.includes('--require-lockstep'),
    });
    console.log(
      `Browser bundles v${result.version}: ${Object.keys(result.files).join(', ')} ` +
        `(+ latest/, integrity.json) — browser-bundles/${result.version}/ (#76)`,
    );
  } catch (err) {
    console.error(`❌ ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
