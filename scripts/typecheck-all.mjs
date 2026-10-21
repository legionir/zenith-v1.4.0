// Type-check every package WITHOUT emitting (#26, AUDIT.md §3.10).
//
// Why this exists: the old script ran `tsc --declaration
// --emitDeclarationOnly`, i.e. the "check" quietly wrote real `dist/*.d.ts`
// files. That had two failure modes: (a) `npm run typecheck` dirtied the
// tree, and (b) *stale* declarations from a previous run could mask type
// errors in downstream packages (they compiled against old dist types while
// src had already changed).
//
// How it avoids that: for each package we generate a temporary tsconfig under
// `.tsbuild/` (wiped at the start of every run) that extends the package's
// own tsconfig, forces `noEmit`, and maps every `@zenith/*` module specifier
// straight at the sibling package's `src` via `paths`. Type-checking therefore
// always reads the *current sources* of workspace dependencies — dist is
// never consulted and never written. `npm run build` remains the only thing
// that emits declarations.
//
// The generated configs are built by `typecheckConfigFor()` (exported and
// unit-tested in scripts/test/typecheck-all.test.mjs).
import { existsSync, readdirSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join, relative } from 'path';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';

// Always run the workspace-installed compiler — a stray global/newer tsc
// must not change what counts as an error (and `npx` would resolve per-cwd).
const requireFromHere = createRequire(import.meta.url);
const TSC_PATH = requireFromHere.resolve('typescript/bin/tsc');

export const TS_BUILD_DIR = '.tsbuild';

/**
 * نگاشت یکتای `@zenith/*` → src برای همهٔ passهای typecheck (هرگز dist).
 * زیرمسیرها باید همراه پکیج‌شان اضافه شوند (زیرمسیرِ ناموجود = شکست CI).
 */
export const SRC_PATHS = {
  // Every @zenith/<name> resolves to that package's src entry.
  '@zenith/*': ['../packages/*/src'],
  // Subpath exports that exist today (see vitest.config.ts #27).
  '@zenith/router/node': ['../packages/router/src/node.ts'],
  '@zenith/errors/internal': ['../packages/errors/src/internal.ts'],
  '@zenith/state/internal': ['../packages/state/src/internal.ts'],
  '@zenith/ssr/internal': ['../packages/ssr/src/internal.ts'],
  '@zenith/expressions/internal': ['../packages/expressions/src/internal.ts'],
  '@zenith/ssr/edge': ['../packages/ssr/src/edge.ts'],
  '@zenith/service-worker/strategies': ['../packages/service-worker/src/strategies.ts'],
  '@zenith/service-worker/sw': ['../packages/service-worker/src/sw.ts'],
  // #142 — زیرمسیرهای @zenith/schema (SPEC §۲.۲).
  '@zenith/schema/zod': ['../packages/schema/src/zod.ts'],
  '@zenith/schema/json-schema': ['../packages/schema/src/json-schema.ts'],
  // #120 — مسیر مشترک خواندن attribute (بودجهٔ ۴KB باندل اصلی، DEC-036 پیوست الف).
  '@zenith/schema/attr': ['../packages/schema/src/attr.ts'],
  '@zenith/storage/signal': ['../packages/storage/src/signal.ts'],
  // #57 — ورودی dual برنامهٔ CLI (بدون side-effectِ runCli ورودی اصلی).
  '@zenith/cli/program': ['../packages/cli/src/program.ts'],
  '@zenith/testing-e2e/browser': ['../packages/testing-e2e/src/browser.ts'],
  '@zenith/analytics/legacy': ['../packages/analytics/src/legacy.ts'],
  '@zenith/realtime/testing': ['../packages/realtime/src/testing.ts'],
  '@zenith/realtime/legacy': ['../packages/realtime/src/legacy.ts'],
  '@zenith/unplugin-zenith/vite': ['../packages/unplugin-zenith/src/vite.ts'],
  '@zenith/unplugin-zenith/rollup': ['../packages/unplugin-zenith/src/rollup.ts'],
  '@zenith/unplugin-zenith/webpack': ['../packages/unplugin-zenith/src/webpack.ts'],
  '@zenith/unplugin-zenith/esbuild': ['../packages/unplugin-zenith/src/esbuild.ts'],
  '@zenith/unplugin-zenith/rspack': ['../packages/unplugin-zenith/src/rspack.ts'],
};

/**
 * The temporary noEmit tsconfig for one package, as a plain object.
 * `extends` and relative paths are written from inside the repo root's
 * `.tsbuild/` directory; `rootDir` is pinned back to the package sources so
 * output-path computation (and error paths) match the package's own config.
 *
 * @param {string} dir package directory name (e.g. "state")
 */
export function typecheckConfigFor(dir, parent = 'packages') {
  return {
    extends: `../${parent}/${dir}/tsconfig.json`,
    compilerOptions: {
      noEmit: true,
      declaration: false,
      declarationMap: false,
      sourceMap: false,
      rootDir: '..',
      outDir: `../${TS_BUILD_DIR}/unused`,
      tsBuildInfoFile: `../${TS_BUILD_DIR}/${dir}.tsbuildinfo`,
      // Relative paths in `paths` (no baseUrl) resolve against this config's
      // own directory, i.e. the repo root's `.tsbuild/`.
      paths: SRC_PATHS,
    },
    include: [`../${parent}/${dir}/src/**/*.ts`],
  };
}

/**
 * #118/#120 — پیکربندی type-testها (`packages/<pkg>/test/**\/*.test-d.ts`).
 *
 * چرا pass جدا؟ `npm run typecheck` (job CI «Type-check») فقط `src/**` را
 * می‌دید و فایل‌های type-level (مثل هم‌ساختاری `Readable` در state با
 * `@zenith/shared`، یا برابری `ReturnType<typeof onGlobalReset>` با `Cleanup`)
 * هرگز کامپایل نمی‌شدند — یعنی شکستن ساختار تایپ‌ها می‌توانست بی‌سروصدا رد شود.
 * این pass همان فایل‌ها را با نگاشت src-resolved کامپایل می‌کند.
 */
export function typeTestConfigFor() {
  return {
    extends: '../tsconfig.base.json',
    compilerOptions: {
      noEmit: true,
      declaration: false,
      declarationMap: false,
      sourceMap: false,
      rootDir: '..',
      outDir: `../${TS_BUILD_DIR}/unused`,
      tsBuildInfoFile: `../${TS_BUILD_DIR}/type-tests.tsbuildinfo`,
      paths: SRC_PATHS,
    },
    include: ['../packages/*/test/**/*.test-d.ts'],
  };
}

/** فهرست فایل‌های type-test موجود در ورک‌اسپیس (مسیر نسبی به root). */
export function listTypeTestFiles(root = process.cwd()) {
  const packagesDir = join(root, 'packages');
  const out = [];
  let dirs = [];
  try {
    dirs = readdirSync(packagesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('tmp-'))
      .map((e) => e.name);
  } catch {
    return out;
  }
  const walk = (dir) => {
    let entries = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.test-d.ts')) out.push(relative(root, full));
    }
  };
  for (const pkg of dirs) walk(join(packagesDir, pkg, 'test'));
  return out.sort();
}

/**
 * Run tsc --noEmit for every package, from a repo root (cwd overridable for
 * tests). Returns { failed, checked, output }.
 *
 * @param {string} root repository root containing packages/
 */
export function runTypecheckAll(root = process.cwd()) {
  const buildDir = join(root, TS_BUILD_DIR);

  // Fresh temp dir on every run (#26 acceptance: stale artifacts can't hide
  // anything, and nothing survives the run).
  rmSync(buildDir, { recursive: true, force: true });
  mkdirSync(buildDir, { recursive: true });

  const dirs = ['packages', 'tools'].flatMap(parent => {
    const base = join(root, parent);
    if (!existsSync(base)) return [];
    return readdirSync(base, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && existsSync(join(base, entry.name, 'tsconfig.json')))
      .map(entry => ({ parent, name: entry.name }));
  }).sort((a, b) => `${a.parent}/${a.name}`.localeCompare(`${b.parent}/${b.name}`));

  let failed = 0;
  /** @type {string[]} */
  const errorOutput = [];

  for (const { parent, name: dir } of dirs) {
    console.log(`🔍 Type-checking ${parent}/${dir} (noEmit, src-resolved)…`);
    const cfgPath = join(buildDir, `${dir}.tsconfig.json`);
    writeFileSync(cfgPath, JSON.stringify(typecheckConfigFor(dir, parent), null, 2));

    const result = spawnSync(process.execPath, [TSC_PATH, '-p', cfgPath], {
      cwd: root,
      encoding: 'utf8',
    });

    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    if (result.status !== 0) {
      failed++;
      errorOutput.push(output);
      process.stdout.write(output);
    }
  }

  // ── pass دوم: type-testها (`packages/*/test/**/*.test-d.ts`) ──
  // اگر هیچ فایلی نباشد (fixtureها/ورک‌اسپیس بدون type-test) اجرا نمی‌شود تا
  // TS18003 («No inputs were found») گیت را بی‌دلیل قرمز نکند.
  const typeTests = listTypeTestFiles(root);
  let typeTestChecked = 0;
  if (typeTests.length > 0) {
    console.log(
      `🔬 Type-checking ${typeTests.length} type-test file(s) (expectTypeOf assertions)…`,
    );
    const cfgPath = join(buildDir, 'type-tests.tsconfig.json');
    writeFileSync(cfgPath, JSON.stringify(typeTestConfigFor(), null, 2));
    const result = spawnSync(process.execPath, [TSC_PATH, '-p', cfgPath], {
      cwd: root,
      encoding: 'utf8',
    });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    if (result.status !== 0) {
      failed++;
      errorOutput.push(output);
      process.stdout.write(output);
    }
    typeTestChecked = typeTests.length;
  }

  // The temp dir survives the run for debugging; it is wiped at the START of
  // every run, so nothing stale can ever mask an error (#26 acceptance).
  return {
    failed,
    checked: dirs.length,
    typeTests: typeTestChecked,
    output: errorOutput.join('\n'),
  };
}

// Only execute when run directly (so the functions above are testable).
if (process.argv[1] && relative(process.cwd(), process.argv[1]).startsWith('scripts')) {
  const { failed, checked } = runTypecheckAll();
  if (failed > 0) {
    console.error(`\n⚠️  ${failed} package(s) have type errors`);
    process.exit(1);
  }
  console.log(`\n🎉 All ${checked} packages type-checked successfully (0 files written).`);
}
