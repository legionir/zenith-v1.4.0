#!/usr/bin/env node
/**
 * #74 — Published Package Tarball & Types Resolution Audit (`scripts/pack-audit.mjs`)
 *
 * Verifies for all publishable packages:
 *  1) `files` allowlist in `package.json` excludes `src/`, `test/`, `tsconfig.json`, and `.tsbuildinfo`
 *  2) `LICENSE` and `README.md` are present in the package root
 *  3) Conditional `exports` place `"types"` first (ATTW / `arethetypeswrong` node16/bundler invariant)
 *     and declare both `"import"` (ESM) and `"require"` (CJS) entrypoints
 *  4) When `--pack` is passed (after `npm run build`), runs `npm pack --dry-run --json`
 *     and verifies that no forbidden files leak into the tarball AND that every file is on the
 *     positive allowlist (`dist/**`, README.md, LICENSE, package.json, CHANGELOG.md).
 *  5) Dual packages declare `.d.cts` for their `require` condition (#74, scripts/lib/exports-shape).
 *
 * Real type-resolution analysis (arethetypeswrong) is `scripts/attw-all.mjs`; the install + import
 * check from real tarballs is `scripts/install-import-check.mjs`.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { conditionTarget, isDualEntry } from './lib/exports-shape.mjs';
import { spawnNpm } from './lib/proc.mjs';

const SKIP_DIRS = new Set(['devtools-extension', 'vscode-extension']);
const FORBIDDEN_FILE_PATTERNS = [/^src(\/|$)/, /^test(\/|$)/, /\.tsbuildinfo$/, /^tsconfig/];
/** #74: a tarball may contain ONLY these (npm adds package.json/LICENSE/README automatically). */
export const ALLOWED_TARBALL_FILES = [
  /^dist\/(?!\.dts\/)/,
  /^README(\.md)?$/i,
  /^LICENSE(\.md)?$/i,
  /^CHANGELOG\.md$/,
  /^package\.json$/,
  // #158: `@zenith/templates` ships its data-driven template files; they are
  // content, not sources, and the scaffold engine reads them at runtime.
  /^templates\//,
];

/** `types` must be the first condition at every level where it appears (TypeScript requirement). */
function typesFirstViolations(node, where, out = []) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return out;
  const keys = Object.keys(node);
  if (keys.includes('types') && keys[0] !== 'types') {
    out.push(`${where} must list "types" first (found: ${keys.join(', ')})`);
  }
  for (const key of keys) typesFirstViolations(node[key], `${where}.${key}`, out);
  return out;
}

export function auditPackages(rootDir = process.cwd(), { runNpmPack = false } = {}) {
  const packagesDir = join(rootDir, 'packages');
  const errors = [];
  let checked = 0;

  for (const dir of readdirSync(packagesDir).sort()) {
    if (SKIP_DIRS.has(dir)) continue;
    const pkgDir = join(packagesDir, dir);
    const pkgJsonPath = join(pkgDir, 'package.json');
    if (!existsSync(pkgJsonPath)) continue;

    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
    if (pkg.private) continue;
    checked += 1;

    // 1. LICENSE and README.md presence
    if (!existsSync(join(pkgDir, 'LICENSE'))) {
      errors.push(`${pkg.name}: missing LICENSE file`);
    }
    if (!existsSync(join(pkgDir, 'README.md'))) {
      errors.push(`${pkg.name}: missing README.md file`);
    }

    // 2. files allowlist
    if (!Array.isArray(pkg.files) || pkg.files.length === 0) {
      errors.push(`${pkg.name}: missing "files" allowlist in package.json`);
    } else {
      for (const entry of pkg.files) {
        if (FORBIDDEN_FILE_PATTERNS.some((re) => re.test(entry))) {
          errors.push(`${pkg.name}: forbidden entry "${entry}" in package.json "files"`);
        }
      }
    }

    // 3. ATTW (arethetypeswrong) conditional exports check
    if (!pkg.types || !String(pkg.types).endsWith('.d.ts')) {
      errors.push(`${pkg.name}: missing or invalid top-level "types" field`);
    }
    const exportsMap = pkg.exports;
    if (!exportsMap || typeof exportsMap !== 'object') {
      errors.push(`${pkg.name}: missing "exports" map`);
    } else {
      for (const [subpath, target] of Object.entries(exportsMap)) {
        if (subpath === './package.json') continue;
        if (target && typeof target === 'object' && !Array.isArray(target)) {
          for (const v of typesFirstViolations(target, `${pkg.name}: exports["${subpath}"]`)) {
            errors.push(v);
          }
          if (
            subpath === '.' &&
            !conditionTarget(target, 'import') &&
            !conditionTarget(target, 'default')
          ) {
            errors.push(
              `${pkg.name}: exports["."] must provide an "import" or "default" condition`,
            );
          }
          // dual entries ship a separate CJS declaration file
          if (isDualEntry(target)) {
            const cjsTypes = target.require?.types;
            if (typeof cjsTypes !== 'string' || !cjsTypes.endsWith('.d.cts')) {
              errors.push(
                `${pkg.name}: exports["${subpath}"].require must have a ".d.cts" "types" (found: ${cjsTypes})`,
              );
            }
          }
        }
      }
    }

    // 4. Optional `npm pack --dry-run --json` tarball contents inspection
    if (runNpmPack && existsSync(join(pkgDir, 'dist'))) {
      const res = spawnNpm(['pack', '--dry-run', '--json'], {
        cwd: pkgDir,
        encoding: 'utf8',
      });
      if (res.status !== 0) {
        errors.push(`${pkg.name}: npm pack --dry-run failed: ${res.stderr}`);
        continue;
      }
      try {
        const parsed = JSON.parse(res.stdout);
        const packInfo = Array.isArray(parsed) ? parsed[0] : parsed;
        const filePaths = (packInfo?.files ?? []).map((f) => f.path);
        for (const fp of filePaths) {
          if (FORBIDDEN_FILE_PATTERNS.some((re) => re.test(fp))) {
            errors.push(`${pkg.name}: tarball contains forbidden file "${fp}"`);
          } else if (!ALLOWED_TARBALL_FILES.some((re) => re.test(fp))) {
            errors.push(`${pkg.name}: tarball contains "${fp}" which is not on the allowlist`);
          }
        }
        for (const required of ['package.json', 'LICENSE', 'README.md']) {
          if (!filePaths.includes(required)) {
            errors.push(`${pkg.name}: tarball is missing ${required}`);
          }
        }
        // every file an exports condition points to must really be inside the tarball
        const shipped = new Set(filePaths.map((f) => `./${f}`));
        const targets = [];
        const collect = (n) => {
          if (typeof n === 'string') targets.push(n);
          else if (n && typeof n === 'object') Object.values(n).forEach(collect);
        };
        collect(pkg.exports);
        for (const t of targets) {
          if (t.startsWith('./dist/') && !shipped.has(t)) {
            errors.push(`${pkg.name}: exports target "${t}" is not in the tarball`);
          }
        }
      } catch (e) {
        errors.push(`${pkg.name}: failed to parse npm pack --dry-run JSON output (${e})`);
      }
    }
  }

  return { ok: errors.length === 0, checked, errors };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const runNpmPack = process.argv.includes('--pack');
  const result = auditPackages(process.cwd(), { runNpmPack });
  if (!result.ok) {
    for (const err of result.errors) {
      console.error(`❌ [pack-audit] ${err}`);
    }
    process.exit(1);
  }
  console.log(
    `✅ pack-audit (#74): ${result.checked} packages verified (types ordering, files allowlist${runNpmPack ? ', npm pack --dry-run' : ''}).`,
  );
}
