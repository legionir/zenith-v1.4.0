import { dirname, join, relative } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { satisfies, validRange } from 'semver';
import ts from 'typescript';
import { CliFailure } from '../failure';
import { projectAt, readManifest, resolvePackage, type ProjectManifest } from './project';

export interface DoctorFinding { code: string; level: 'error' | 'warning' | 'info'; message: string; path?: string; }
export interface DoctorReport { root: string; node: string; findings: DoctorFinding[]; packages: Array<{ name: string; version: string; path: string }>; stateCopies: string[]; }
function declarations(pkg: ProjectManifest): Array<[string, string, boolean]> {
  const result = new Map<string, [string, string, boolean]>();
  const add = (name: string, range: string, optional: boolean) => {
    const key = `${name}\0${range}`; const previous = result.get(key);
    result.set(key, [name, range, optional && (!previous || previous[2])]);
  };
  for (const group of [pkg.dependencies, pkg.devDependencies]) for (const [name, range] of Object.entries(group ?? {})) if (!pkg.optionalDependencies?.[name]) add(name, range, false);
  for (const [name, range] of Object.entries(pkg.peerDependencies ?? {})) add(name, range, pkg.peerDependenciesMeta?.[name]?.optional === true);
  for (const [name, range] of Object.entries(pkg.optionalDependencies ?? {})) add(name, range, true);
  return [...result.values()];
}
function pluginInConfig(file: string): boolean {
  const text = readFileSync(file, 'utf8'); const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const locals = new Set<string>(); let namespace: string | undefined; let used = false;
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== '@zenith/vite-plugin') continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const item of bindings.elements) if ((item.propertyName ?? item.name).text === 'zenithPlugin') locals.add(item.name.text);
    if (bindings && ts.isNamespaceImport(bindings)) namespace = bindings.name.text;
  }
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      if (ts.isIdentifier(expression) && locals.has(expression.text)) used = true;
      if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression) && expression.expression.text === namespace && expression.name.text === 'zenithPlugin') used = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(source); return used;
}
/** Read-only inspection of the installed physical graph, not just lockfile versions. */
export function inspectProject(directory = '.'): DoctorReport {
  const { root, file, manifest } = projectAt(directory);
  const report: DoctorReport = { root, node: process.versions.node, findings: [], packages: [], stateCopies: [] };
  const add = (code: string, level: DoctorFinding['level'], message: string, path?: string) => report.findings.push({ code, level, message, ...(path ? { path } : {}) });
  const nodeCheck = (pkg: ProjectManifest, location: string) => {
    const range = pkg.engines?.node;
    if (range && (!validRange(range) || !satisfies(process.versions.node, range))) add('NODE_ENGINE', 'error', `Node ${process.versions.node} does not satisfy ${range}.`, location);
  };
  if (!satisfies(process.versions.node, '>=18.19.0')) add('NODE_MINIMUM', 'error', 'Zenith CLI requires Node >=18.19.');
  nodeCheck(manifest, file);
  const queue: Array<{ file: string; manifest: ProjectManifest; root: boolean }> = [{ file, manifest, root: true }]; const visited = new Set([file]);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i]!;
    // Transitive dev dependencies are not part of an installed package's graph.
    const pkg = current.root ? current.manifest : { ...current.manifest, devDependencies: undefined };
    for (const [name, range, optional] of declarations(pkg)) {
      const resolved = resolvePackage(dirname(current.file), name);
      if (!resolved) { if (!optional) add('MISSING_DEPENDENCY', 'error', `${name} is not installed (required by ${current.manifest.name ?? current.file}).`, current.file); continue; }
      const dependency = readManifest(resolved);
      if (dependency.name && dependency.name !== name) { add('PACKAGE_ALIAS', 'warning', `${name} resolves to ${dependency.name}.`, resolved); }
      if (validRange(range) && (!dependency.version || !satisfies(dependency.version, range, { includePrerelease: true }))) add('DEPENDENCY_VERSION', 'error', `${name}@${dependency.version ?? 'unknown'} does not satisfy ${range}.`, resolved);
      if (visited.has(resolved)) continue;
      visited.add(resolved); if (visited.size > 10000) throw new CliFailure('Dependency graph exceeds the 10,000-package safety limit. Narrow --cwd.');
      report.packages.push({ name, version: dependency.version ?? 'unknown', path: resolved }); nodeCheck(dependency, resolved);
      if (name === '@zenith/state' || dependency.name === '@zenith/state') report.stateCopies.push(resolved);
      queue.push({ file: resolved, manifest: dependency, root: false });
    }
  }
  if (report.stateCopies.length > 1) add('DUPLICATE_STATE', 'error', `${report.stateCopies.length} physical @zenith/state copies found; deduplicate even if versions match.`);
  if (report.packages.some(pkg => pkg.name === '@zenith/vite-plugin')) {
    const config = ['ts', 'mts', 'cts', 'js', 'mjs', 'cjs'].map(extension => join(root, `vite.config.${extension}`)).find(existsSync);
    if (!config) add('VITE_CONFIG', 'warning', 'No Vite config found; ensure zenithPlugin() is configured.');
    else if (!pluginInConfig(config)) add('VITE_PLUGIN', 'warning', 'Could not verify a static zenithPlugin() call; inspect dynamic configuration manually.', config);
  }
  const locks = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'].filter(name => existsSync(join(root, name)));
  if (locks.length > 1) add('MULTIPLE_LOCKFILES', 'warning', `Multiple lockfiles: ${locks.join(', ')}.`);
  add('PROJECT', 'info', `${report.packages.length} installed packages inspected; ${report.stateCopies.length} physical state copies.`);
  report.packages.sort((a, b) => a.name.localeCompare(b.name) || a.path.localeCompare(b.path)); report.stateCopies.sort();
  for (const finding of report.findings) if (finding.path) finding.path = relative(root, finding.path) || 'package.json';
  return report;
}
