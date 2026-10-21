import { readFileSync, realpathSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { CliFailure } from '../failure';

export interface ProjectManifest {
  name?: string; version?: string; packageManager?: string;
  scripts?: Record<string, string>; engines?: { node?: string };
  dependencies?: Record<string, string>; devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>; peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}
export function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
export function readManifest(file: string): ProjectManifest {
  let parsed: unknown;
  try { parsed = JSON.parse(readFileSync(file, 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code) throw new CliFailure(`Cannot read manifest: ${file}`, 2); throw new CliFailure(`Invalid package JSON: ${file}`); }
  if (!object(parsed)) throw new CliFailure(`Manifest must be an object: ${file}`);
  for (const key of ['name', 'version', 'packageManager']) if (parsed[key] !== undefined && typeof parsed[key] !== 'string') throw new CliFailure(`Invalid ${key} in ${file}`);
  for (const key of ['scripts', 'dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const value = parsed[key]; if (value !== undefined && (!object(value) || Object.values(value).some(item => typeof item !== 'string'))) throw new CliFailure(`Invalid ${key} in ${file}`);
  }
  if (parsed.peerDependenciesMeta !== undefined && (!object(parsed.peerDependenciesMeta) || Object.values(parsed.peerDependenciesMeta).some(value => !object(value) || (value.optional !== undefined && typeof value.optional !== 'boolean')))) throw new CliFailure(`Invalid peerDependenciesMeta in ${file}`);
  if (parsed.engines !== undefined && (!object(parsed.engines) || (parsed.engines.node !== undefined && typeof parsed.engines.node !== 'string'))) throw new CliFailure(`Invalid engines in ${file}`);
  return parsed as ProjectManifest;
}
/** Resolve cwd without process.chdir(), so concurrent invocations cannot cross projects. */
export function projectAt(directory = '.'): { root: string; file: string; manifest: ProjectManifest } {
  const selected = resolve(directory);
  if (!existsSync(join(selected, 'package.json'))) throw new CliFailure(`No package.json in ${selected}. Use --cwd to select a project.`);
  const root = realpathSync(selected); const file = join(root, 'package.json');
  return { root, file, manifest: readManifest(file) };
}
const packageName = /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i;
/** Node's physical node_modules ancestry, including symlinks and pnpm real paths. */
export function resolvePackage(from: string, name: string): string | undefined {
  if (!packageName.test(name) || name === '.' || name === '..') throw new CliFailure(`Invalid dependency name: ${name}`);
  let cursor = resolve(from);
  for (;;) {
    const candidate = join(cursor, 'node_modules', name, 'package.json');
    if (existsSync(candidate)) return realpathSync(candidate);
    const parent = dirname(cursor); if (parent === cursor) return; cursor = parent;
  }
}
