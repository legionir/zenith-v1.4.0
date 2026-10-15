#!/usr/bin/env node
/**
 * #77 — NPM Scope & Package Naming Validator + Migration Planner
 *
 * Verifies that every workspace package has a valid, approved package name
 * (`@zenith/<slug>`, `zenith`, or `zenith-vscode`), and provides a
 * deterministic scope-migration planner (`planScopeMigration`) if the
 * `@zenith` npm organization requires fallback to an alternate scope
 * (e.g. `@zenithjs`).
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ALLOWED_UNSCOPED = new Set(['zenith', 'zenith-vscode']);
const EXPECTED_SCOPE = '@zenith/';

export function checkWorkspacePackageNames(rootDir = process.cwd()) {
  const packagesDir = join(rootDir, 'packages');
  const errors = [];
  const packages = [];
  const seenNames = new Set();

  for (const dir of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const pkgJsonPath = join(packagesDir, dir.name, 'package.json');
    if (!existsSync(pkgJsonPath)) continue;
    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
    const name = pkg.name;

    if (!name || typeof name !== 'string') {
      errors.push(`packages/${dir.name}/package.json is missing a valid "name" field.`);
      continue;
    }

    if (seenNames.has(name)) {
      errors.push(`Duplicate package name "${name}" in packages/${dir.name}.`);
    }
    seenNames.add(name);

    const isScoped = name.startsWith(EXPECTED_SCOPE);
    const isAllowedUnscoped = ALLOWED_UNSCOPED.has(name);
    if (!isScoped && !isAllowedUnscoped) {
      errors.push(
        `packages/${dir.name} has unapproved name "${name}". Expected "${EXPECTED_SCOPE}${dir.name}" or an allowed unscoped name.`,
      );
    }

    packages.push({
      dir: dir.name,
      name,
      private: Boolean(pkg.private),
      version: pkg.version,
    });
  }

  return {
    ok: errors.length === 0,
    errors,
    packages,
  };
}

export function planScopeMigration(rootDir = process.cwd(), targetScope = '@zenithjs') {
  const normalizedScope = targetScope.replace(/\/+$/, '');
  const { packages } = checkWorkspacePackageNames(rootDir);
  return packages.map((p) => {
    if (p.name.startsWith(EXPECTED_SCOPE)) {
      const slug = p.name.slice(EXPECTED_SCOPE.length);
      return { dir: p.dir, from: p.name, to: `${normalizedScope}/${slug}` };
    }
    if (p.name === 'zenith') {
      return { dir: p.dir, from: p.name, to: `${normalizedScope}/zenith` };
    }
    return { dir: p.dir, from: p.name, to: p.name };
  });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const res = checkWorkspacePackageNames(process.cwd());
  if (!res.ok) {
    for (const err of res.errors) {
      console.error(`❌ [npm-scope] ${err}`);
    }
    process.exit(1);
  }
  console.log(`✅ npm-scope (#77): ${res.packages.length} workspace package names verified.`);
}
