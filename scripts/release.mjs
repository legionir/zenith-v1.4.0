#!/usr/bin/env node
/**
 * #73 — Safe Dependency-Ordered Release Pipeline (`scripts/release.mjs`)
 *
 * Replaces the legacy unsafe loop with:
 *  1) Topological dependency ordering via `getTopologicalOrder()` (`package-order.mjs`)
 *  2) Mandatory preflight checks:
 *     - Clean git working tree (`git status --porcelain`)
 *     - Lockstep version consistency (DEC-029)
 *     - Build / test / lint / publint gates
 *     - `npm pack --dry-run` verification for every publishable package
 *  3) Safe `--dry-run` mode (default unless `--publish` is explicitly passed)
 *  4) Fail-fast on first publish error with exact `--from <pkg>` resume instructions
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getPackageOrder } from './package-order.mjs';

export function parseReleaseArgs(argv = process.argv.slice(2)) {
  let dryRun = true;
  let skipChecks = false;
  let allowDirty = false;
  let provenance = false;
  let fromPkg = null;
  let registry = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--publish') {
      dryRun = false;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--provenance') {
      provenance = true;
    } else if (arg === '--skip-checks') {
      skipChecks = true;
    } else if (arg === '--allow-dirty') {
      allowDirty = true;
    } else if (arg === '--from' && argv[i + 1]) {
      fromPkg = argv[++i];
    } else if (arg.startsWith('--from=')) {
      fromPkg = arg.slice('--from='.length);
    } else if (arg === '--registry' && argv[i + 1]) {
      registry = argv[++i];
    } else if (arg.startsWith('--registry=')) {
      registry = arg.slice('--registry='.length);
    }
  }

  return { dryRun, skipChecks, allowDirty, provenance, fromPkg, registry };
}

function defaultExec(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    cwd: opts.cwd ?? process.cwd(),
    encoding: 'utf8',
    stdio: opts.stdio ?? 'pipe',
  });
  return {
    status: res.status ?? 1,
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
  };
}

export function runRelease(options = {}) {
  const rootDir = options.rootDir ?? process.cwd();
  const packagesDir = join(rootDir, 'packages');
  const exec = options.exec ?? defaultExec;
  const log = options.log ?? (() => {});
  const dryRun = options.dryRun ?? true;
  const skipChecks = options.skipChecks ?? false;
  const allowDirty = options.allowDirty ?? false;
  const fromPkg = options.fromPkg ?? null;
  const registry = options.registry ?? null;

  // 1. Check clean git working tree
  if (!allowDirty) {
    const gitStatus = exec('git', ['status', '--porcelain'], { cwd: rootDir });
    if (gitStatus.status !== 0 || gitStatus.stdout.trim().length > 0) {
      return {
        ok: false,
        stage: 'git-clean',
        published: [],
        skipped: [],
        error: 'Git working tree is not clean. Commit or stash changes before releasing.',
      };
    }
  }

  // 2. Topological package order
  const orderedDirs = getPackageOrder({ packagesDir });
  const publishable = [];
  const skipped = [];

  for (const dir of orderedDirs) {
    const pkgJsonPath = join(packagesDir, dir, 'package.json');
    if (!existsSync(pkgJsonPath)) continue;
    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
    if (pkg.private) {
      skipped.push({ dir, name: pkg.name, reason: 'private' });
      continue;
    }
    publishable.push({ dir, name: pkg.name, version: pkg.version, path: join(packagesDir, dir) });
  }

  // 3. Verify lockstep versions across @zenith/* and zenith (DEC-029)
  const coreVersions = new Set(
    publishable
      .filter((p) => p.name.startsWith('@zenith/') || p.name === 'zenith')
      .map((p) => p.version),
  );
  if (coreVersions.size > 1) {
    return {
      ok: false,
      stage: 'version-check',
      published: [],
      skipped,
      error: `Lockstep version mismatch across publishable packages: ${[...coreVersions].join(', ')}`,
    };
  }

  // 4. Preflight quality gates (lint, typecheck, test, build, publint)
  if (!skipChecks) {
    const gates = [
      ['npm', ['run', 'lint']],
      ['npm', ['run', 'typecheck']],
      ['npm', ['test']],
      ['npm', ['run', 'build']],
      ['npm', ['run', 'publint']],
    ];
    for (const [cmd, args] of gates) {
      const gateName = args.join(' ');
      log(`Running preflight gate: ${cmd} ${gateName}`);
      const res = exec(cmd, args, { cwd: rootDir });
      if (res.status !== 0) {
        return {
          ok: false,
          stage: `preflight:${gateName}`,
          published: [],
          skipped,
          error: `Preflight gate "${cmd} ${gateName}" failed.`,
        };
      }
    }
  }

  // 5. Filter by --from <pkg> if resuming a partial release
  let startIdx = 0;
  if (fromPkg) {
    startIdx = publishable.findIndex((p) => p.name === fromPkg || p.dir === fromPkg);
    if (startIdx === -1) {
      return {
        ok: false,
        stage: 'from-package',
        published: [],
        skipped,
        error: `Resume target package "${fromPkg}" not found in publishable packages.`,
      };
    }
  }

  const targetPackages = publishable.slice(startIdx);

  // 6. Verify dist/ and npm pack --dry-run before publishing any package
  for (const pkg of targetPackages) {
    const distPath = join(pkg.path, 'dist');
    const outPath = join(pkg.path, 'out');
    if (!existsSync(distPath) && !existsSync(outPath)) {
      return {
        ok: false,
        stage: 'dist-check',
        published: [],
        skipped,
        error: `Package ${pkg.name} is missing build output (dist/ or out/). Run "npm run build" first.`,
      };
    }
    const packRes = exec('npm', ['pack', '--dry-run'], { cwd: pkg.path });
    if (packRes.status !== 0) {
      return {
        ok: false,
        stage: 'pack-check',
        published: [],
        skipped,
        error: `npm pack --dry-run failed for ${pkg.name}.`,
      };
    }
  }

  // 7. Publish in topological order (stopping immediately on first failure)
  const published = [];
  const useProvenance = Boolean(
    options.provenance || (process.env.ACTIONS_ID_TOKEN_REQUEST_URL && !registry),
  );

  for (const pkg of targetPackages) {
    const publishArgs = ['publish', '--access', 'public'];
    if (dryRun) publishArgs.push('--dry-run');
    if (useProvenance && !dryRun) publishArgs.push('--provenance');
    if (registry) publishArgs.push('--registry', registry);

    log(`${dryRun ? '[DRY-RUN] ' : ''}Publishing ${pkg.name}@${pkg.version}...`);
    const pubRes = exec('npm', publishArgs, { cwd: pkg.path });
    if (pubRes.status !== 0) {
      const resumeCmd = `node scripts/release.mjs ${dryRun ? '--dry-run ' : '--publish '}--from ${pkg.name}`;
      return {
        ok: false,
        stage: 'publish',
        failedPackage: pkg.name,
        published,
        skipped,
        resumeCommand: resumeCmd,
        error: `Failed to publish ${pkg.name}. Halting immediately to prevent inconsistent downstream state. Resume with: ${resumeCmd}`,
      };
    }
    published.push(pkg.name);
  }

  return {
    ok: true,
    dryRun,
    published,
    skipped,
  };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const parsed = parseReleaseArgs(process.argv.slice(2));
  const result = runRelease({
    ...parsed,
    log: (msg) => console.log(msg),
  });
  if (!result.ok) {
    console.error(`❌ Release aborted at [${result.stage}]: ${result.error}`);
    process.exit(1);
  }
  console.log(
    `✅ Release ${result.dryRun ? '(dry-run) ' : ''}completed: ${result.published.length} packages processed in topological order.`,
  );
}
