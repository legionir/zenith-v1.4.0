#!/usr/bin/env node
/**
 * #140 — `.d.ts` ↔ bundle export parity.
 *
 * The build produces JS with esbuild and declarations with tsc (two independent paths),
 * so nothing guaranteed that what `index.d.ts` promises is what the bundle really exports.
 * For every package in `packages/` this script compares THREE sets of VALUE export names
 * (types/interfaces are erased at runtime and excluded):
 *
 *   1. the exports of the `types` entry, via the TypeScript compiler API (checker),
 *   2. the keys of the ESM entry (`exports["."].import`), loaded with `import()`,
 *   3. the keys of the CJS entry (`exports["."].require`), loaded with `require()` (if declared).
 *
 * Any missing or extra name exits 1 and is listed. Run after `npm run build`.
 * Packages that touch the DOM at import time get a minimal jsdom window installed first.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import ts from 'typescript';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(HERE, '..');

/** Names of value (runtime) exports declared by a `.d.ts` entry, via the compiler checker. */
export function dtsValueExports(dtsPath) {
  const program = ts.createProgram([dtsPath], {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true,
    noEmit: true,
    types: [],
  });
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(dtsPath);
  if (!source) throw new Error(`cannot read ${dtsPath}`);
  const moduleSymbol = checker.getSymbolAtLocation(source);
  if (!moduleSymbol) return new Set(); // a script-style d.ts without exports
  const names = new Set();
  for (const sym of checker.getExportsOfModule(moduleSymbol)) {
    const resolved = sym.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(sym) : sym;
    // `export { type X }` / `export type { X }` are erased even when X is a class or enum.
    const typeOnly = (sym.declarations ?? []).every(
      (d) => ts.isExportSpecifier(d) && (d.isTypeOnly || d.parent.parent.isTypeOnly === true),
    );
    // Classes/enums/functions/variables are values; pure interfaces/type aliases are not.
    if (!typeOnly && resolved.flags & ts.SymbolFlags.Value) names.add(sym.name);
  }
  return names;
}

function ensureDomGlobals(root) {
  if (globalThis.window) return;
  const req = createRequire(path.join(root, 'package.json'));
  const { JSDOM } = req('jsdom');
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost/',
  });
  const { window } = dom;
  globalThis.window = window;
  for (const key of ['document', 'navigator', 'HTMLElement', 'Element', 'Node', 'CustomEvent']) {
    if (!(key in globalThis)) globalThis[key] = window[key];
  }
}

/**
 * Evaluates a CJS bundle to read its export keys WITHOUT resolving its externals.
 * Workspace deps that are ESM-only (DEC-027) cannot be `require()`d, which is a separate
 * concern from "does the bundle export what the .d.ts declares"; every bare specifier is
 * therefore replaced by an inert callable Proxy that absorbs any top-level use.
 */
function evaluateCjsWithStubs(file) {
  const makeStub = () => {
    const stub = new Proxy(function () {}, {
      get: (_t, key) => (key === Symbol.toPrimitive ? () => '' : key === 'then' ? undefined : stub),
      apply: () => stub,
      construct: () => stub,
    });
    return stub;
  };
  const module = { exports: {} };
  const requireStub = (id) => (id.startsWith('node:') ? createRequire(file)(id) : makeStub());
  const wrapper = new Function('module', 'exports', 'require', fs.readFileSync(file, 'utf8'));
  wrapper(module, module.exports, requireStub);
  return module.exports;
}

function diff(expected, actual) {
  return {
    missing: [...expected].filter((n) => !actual.has(n)).sort(),
    extra: [...actual].filter((n) => !expected.has(n)).sort(),
  };
}

/** Compares one package directory; returns an array of mismatch records (empty = OK). */
export async function checkPackageParity(pkgDir) {
  const manifest = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
  const entry = manifest.exports?.['.'];
  if (!entry || typeof entry !== 'object' || !entry.types) return null; // not a library entry
  const abs = (rel) => path.resolve(pkgDir, rel);
  // A package whose `bin` IS its entry is an executable (e.g. @zenith/cli): importing it runs
  // the program instead of exposing an API, so there is nothing to compare at runtime.
  const bins =
    typeof manifest.bin === 'string' ? [manifest.bin] : Object.values(manifest.bin ?? {});
  if (bins.some((b) => entry.import && abs(b) === abs(entry.import))) return null;
  const problems = [];
  const dts = abs(entry.types);
  if (!fs.existsSync(dts)) return null; // not built
  const expected = dtsValueExports(dts);

  const targets = [];
  if (entry.import) targets.push(['ESM', abs(entry.import)]);
  if (entry.require) targets.push(['CJS', abs(entry.require)]);
  for (const [format, file] of targets) {
    if (!fs.existsSync(file)) {
      problems.push({
        pkg: manifest.name,
        format,
        kind: 'file',
        names: [path.relative(pkgDir, file)],
      });
      continue;
    }
    let actual;
    try {
      const mod =
        format === 'ESM' ? await import(pathToFileURL(file).href) : evaluateCjsWithStubs(file);
      actual = new Set(Object.keys(mod).filter((k) => k !== 'default' && k !== '__esModule'));
    } catch (err) {
      problems.push({
        pkg: manifest.name,
        format,
        kind: 'load',
        names: [String(err?.message ?? err)],
      });
      continue;
    }
    // `default` is a CJS/ESM interop artefact, not a declared named export.
    const exp = new Set([...expected].filter((n) => n !== 'default'));
    const { missing, extra } = diff(exp, actual);
    if (missing.length)
      problems.push({ pkg: manifest.name, format, kind: 'missing', names: missing });
    if (extra.length) problems.push({ pkg: manifest.name, format, kind: 'extra', names: extra });
  }
  return problems;
}

export async function checkDtsJsParity(root = DEFAULT_ROOT) {
  ensureDomGlobals(root);
  const packagesDir = path.join(root, 'packages');
  const mismatches = [];
  let checkedPackages = 0;
  for (const name of fs.readdirSync(packagesDir).sort()) {
    const pkgDir = path.join(packagesDir, name);
    if (!fs.existsSync(path.join(pkgDir, 'package.json'))) continue;
    const result = await checkPackageParity(pkgDir);
    if (result === null) continue;
    checkedPackages++;
    mismatches.push(...result);
  }
  return { checkedPackages, mismatches };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { checkedPackages, mismatches } = await checkDtsJsParity();
  if (checkedPackages === 0) {
    console.error('❌ no built packages found — run `npm run build` first.');
    process.exit(1);
  }
  if (mismatches.length > 0) {
    console.error('❌ .d.ts ↔ bundle export parity mismatches (#140):');
    for (const m of mismatches) {
      const what =
        m.kind === 'missing'
          ? 'declared in .d.ts but NOT exported at runtime'
          : m.kind === 'extra'
            ? 'exported at runtime but NOT declared in .d.ts'
            : m.kind === 'file'
              ? 'entry file missing'
              : 'failed to load';
      console.error(`  - ${m.pkg} [${m.format}] ${what}: ${m.names.join(', ')}`);
    }
    process.exit(1);
  }
  console.log(
    `✅ .d.ts ↔ ESM ↔ CJS export parity verified across ${checkedPackages} packages (#140).`,
  );
}
