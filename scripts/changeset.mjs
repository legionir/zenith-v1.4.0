#!/usr/bin/env node
/**
 * #72 — Automated Changesets & Keep-a-Changelog Generator (`scripts/changeset.mjs`)
 *
 * Parses `.changeset/*.md` files, computes the lockstep SemVer bump across
 * all publishable `@zenith/*` and `zenith` packages (per `.changeset/config.json`),
 * and generates formatted Keep-a-Changelog entries.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BUMP_RANK = { patch: 1, minor: 2, major: 3 };

export function parseChangesetFile(content, filename = 'changeset.md') {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    throw new Error(`Invalid changeset frontmatter in ${filename}`);
  }
  const frontmatter = match[1].trim();
  const summary = match[2].trim();
  const releases = [];

  for (const line of frontmatter.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = trimmed.match(/^["']?([^"':]+)["']?\s*:\s*(patch|minor|major)$/);
    if (!m) {
      throw new Error(`Invalid release line "${trimmed}" in ${filename}`);
    }
    releases.push({ name: m[1].trim(), type: m[2] });
  }

  return { filename, releases, summary };
}

export function bumpSemver(version, bumpType) {
  const m = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) throw new Error(`Invalid semver: ${version}`);
  const major = Number(m[1]);
  const minor = Number(m[2]);
  const patch = Number(m[3]);
  if (bumpType === 'major') return `${major + 1}.0.0`;
  if (bumpType === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

export function readChangesets(rootDir = process.cwd()) {
  const dir = join(rootDir, '.changeset');
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md')
    .sort();
  return files.map((f) => parseChangesetFile(readFileSync(join(dir, f), 'utf8'), f));
}

export function computeLockstepReleasePlan(rootDir = process.cwd()) {
  const rootPkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
  const currentVersion = rootPkg.version;
  const changesets = readChangesets(rootDir);

  let highestBump = null;
  for (const cs of changesets) {
    for (const rel of cs.releases) {
      if (!highestBump || BUMP_RANK[rel.type] > BUMP_RANK[highestBump]) {
        highestBump = rel.type;
      }
    }
  }

  const nextVersion = highestBump ? bumpSemver(currentVersion, highestBump) : currentVersion;
  return {
    currentVersion,
    nextVersion,
    bumpType: highestBump,
    changesets,
  };
}

export function formatKeepAChangelogSection(version, dateStr, changesets) {
  const grouped = { major: [], minor: [], patch: [] };
  for (const cs of changesets) {
    let csType = 'patch';
    for (const r of cs.releases) {
      if (BUMP_RANK[r.type] > BUMP_RANK[csType]) csType = r.type;
    }
    const pkgList = cs.releases.map((r) => `\`${r.name}\``).join(', ');
    grouped[csType].push(`- ${pkgList}: ${cs.summary}`);
  }

  const lines = [`## [${version}] - ${dateStr}`, ''];
  if (grouped.major.length > 0) {
    lines.push('### Breaking Changes', '', ...grouped.major, '');
  }
  if (grouped.minor.length > 0) {
    lines.push('### Added', '', ...grouped.minor, '');
  }
  if (grouped.patch.length > 0) {
    lines.push('### Fixed', '', ...grouped.patch, '');
  }
  return lines.join('\n');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const plan = computeLockstepReleasePlan(process.cwd());
  console.log(
    `✅ changeset status (#72): current=${plan.currentVersion}, next=${plan.nextVersion} (${plan.changesets.length} pending changesets)`,
  );
}
