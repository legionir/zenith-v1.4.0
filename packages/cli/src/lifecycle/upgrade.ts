import { readdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, existsSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { minVersion, validRange, lt, major } from 'semver';
import { randomUUID } from 'node:crypto';
import { CliFailure } from '../failure';
import { projectAt, object } from './project';
import { dependencyVersion } from '../templates/versions';
import { migrateSource } from './migrations';

export interface UpgradeChange { path: string; migrations: string[]; }
export interface UpgradeReport { root: string; applied: boolean; changes: UpgradeChange[]; backups: string[]; manual: string[]; }
interface PlannedFile { file: string; before: string; after: string; migrations: string[]; }
const excluded = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.cache', '.venv', '.arena']);
/** Default is a read-only plan; --write uses exclusive backups and rolls back partial application. */
export function upgradeProject(directory = '.', write = false): UpgradeReport {
  const { root, file } = projectAt(directory); const plan: PlannedFile[] = []; const manual: string[] = [];
  const before = readFileSync(file, 'utf8'); const pkg: unknown = JSON.parse(before); const versions: string[] = [];
  if (!object(pkg)) throw new CliFailure('Invalid package.json.');
  for (const key of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const entries = pkg[key]; if (!object(entries)) continue;
    for (const [name, current] of Object.entries(entries)) {
      if (!name.startsWith('@zenith/') && name !== 'zenith') continue;
      if (typeof current !== 'string' || /^(workspace:|file:|link:|git|https?:|npm:)/.test(current)) { manual.push(`${name}: preserve non-registry range ${String(current)}.`); continue; }
      let next: string; try { next = dependencyVersion(name); } catch { manual.push(`${name}: no bundled target version; select manually.`); continue; }
      const oldVersion = validRange(current) ? minVersion(current) : null; const nextVersion = minVersion(next);
      if (!oldVersion || !nextVersion || lt(nextVersion, oldVersion) || major(nextVersion) !== major(oldVersion)) { manual.push(`${name}: refusing a downgrade, unknown range, or unapproved major change (${current} → ${next}).`); continue; }
      if (next !== current) { entries[name] = next; versions.push(`${name}: ${current} → ${next}`); }
    }
  }
  if (versions.length) plan.push({ file, before, after: JSON.stringify(pkg, null, 2) + '\n', migrations: versions });
  const queue = [root]; let scanned = 0;
  for (let i = 0; i < queue.length; i++) for (const entry of readdirSync(queue[i]!, { withFileTypes: true })) {
    if (++scanned > 20000) throw new CliFailure('Upgrade exceeds the 20,000-entry safety limit. Narrow --cwd.');
    const target = join(queue[i]!, entry.name); if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) { if (!excluded.has(entry.name) && !entry.name.startsWith('.zenith-upgrade-')) queue.push(target); continue; }
    if (!entry.isFile() || !['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'].includes(extname(target)) || /\.d\.[cm]?ts$/.test(target)) continue;
    if (statSync(target).size > 1024 * 1024) { manual.push(`${relative(root, target)}: source exceeds 1 MiB; migrate manually.`); continue; }
    const source = readFileSync(target, 'utf8'); const result = migrateSource(source, target);
    if (result.source !== source) plan.push({ file: target, before: source, after: result.source, migrations: result.changes });
  }
  const report: UpgradeReport = { root, applied: false, changes: plan.map(item => ({ path: relative(root, item.file), migrations: item.migrations })), backups: [], manual };
  if (!write || !plan.length) return report;
  // All conflicts are checked before touching even the first file.
  for (const item of plan) if (existsSync(item.file + '.zenith.bak')) throw new CliFailure(`Backup exists: ${relative(root, item.file)}.zenith.bak. Move it before applying again.`);
  const applied: PlannedFile[] = []; const createdBackups: string[] = [];
  try {
    for (const item of plan) {
      if (readFileSync(item.file, 'utf8') !== item.before) throw new CliFailure(`Concurrent edit: ${relative(root, item.file)}. Re-run the plan.`);
      const backup = item.file + '.zenith.bak'; writeFileSync(backup, item.before, { flag: 'wx', mode: statSync(item.file).mode }); createdBackups.push(backup);
      const temporary = item.file + `.zenith-upgrade-${randomUUID()}`;
      try {
        writeFileSync(temporary, item.after, { flag: 'wx', mode: statSync(item.file).mode });
        if (readFileSync(item.file, 'utf8') !== item.before) throw new CliFailure(`Concurrent edit: ${relative(root, item.file)}.`);
        renameSync(temporary, item.file); applied.push(item);
      } finally { if (existsSync(temporary)) unlinkSync(temporary); }
    }
  } catch (error) {
    let incomplete = false;
    for (const item of applied.reverse()) {
      try { if (readFileSync(item.file, 'utf8') === item.after) renameSync(item.file + '.zenith.bak', item.file); else incomplete = true; } catch { incomplete = true; }
    }
    for (const backup of createdBackups) if (existsSync(backup) && !applied.some(item => item.file + '.zenith.bak' === backup)) { try { unlinkSync(backup); } catch { incomplete = true; } }
    if (incomplete) throw new CliFailure('Upgrade interrupted by concurrent edits; preserved .zenith.bak files for manual recovery.', 2);
    throw error;
  }
  report.applied = true; report.backups = createdBackups.map(backup => relative(root, backup)); return report;
}
