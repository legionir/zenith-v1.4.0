import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { runCli, createProgram } from '../src/program';
import { inspectProject } from '../src/lifecycle/doctor';
import { migrateSource } from '../src/lifecycle/migrations';
import { upgradeProject } from '../src/lifecycle/upgrade';
import { runnerInvocation, runLifecycle } from '../src/lifecycle/runner';
import { output, withOutputSession } from '../src/output';
import { CliFailure } from '../src/failure';

const directories: string[] = [];
function project(manifest: Record<string, unknown> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'zenith-cli-')); directories.push(root);
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'consumer', ...manifest })); return root;
}
function installed(root: string, name: string, manifest: Record<string, unknown> = {}) {
  const file = join(root, 'node_modules', name, 'package.json'); mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ name, version: '1.4.0', ...manifest })); return dirname(file);
}
function capture() {
  let stdout = '', stderr = '';
  vi.spyOn(process.stdout, 'write').mockImplementation(chunk => { stdout += String(chunk); return true; });
  vi.spyOn(process.stderr, 'write').mockImplementation(chunk => { stderr += String(chunk); return true; });
  return { stdout: () => stdout, stderr: () => stderr, envelope: () => JSON.parse(stdout) };
}
afterEach(() => { vi.restoreAllMocks(); for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

describe('CLI contract and JSON isolation', () => {
  it('registers all five real lifecycle commands without executing them', () => {
    const names = createProgram().commands.map(command => command.name());
    for (const name of ['dev', 'build', 'test', 'doctor', 'upgrade']) expect(names).toContain(name);
  });
  it.each([['--json', 'info'], ['info', '--json']])('emits one versioned JSON envelope for %j', async (...argv: string[]) => {
    const io = capture(); expect(await runCli(argv)).toBe(0);
    expect(io.stdout().trim().split('\n')).toHaveLength(1); expect(io.stderr()).toBe('');
    expect(io.envelope()).toMatchObject({ schemaVersion: 1, command: 'info', ok: true, exitCode: 0, data: { version: expect.any(String) } });
  });
  it('maps argument errors to 1, not a process.exit or unstructured stderr', async () => {
    const io = capture(); expect(await runCli(['--json', 'unknown-command'])).toBe(1);
    expect(io.envelope()).toMatchObject({ ok: false, exitCode: 1 }); expect(io.stderr()).toBe('');
  });
  it('keeps missing project/tool failures explicit', async () => {
    const root = project(); const io = capture(); expect(await runCli(['build', '--cwd', root, '--json'])).toBe(1);
    expect(io.envelope().errors.join(' ')).toContain('Install vite');
  });
  it('does not carry failure state into another invocation', async () => {
    const root = project(); const values: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(chunk => { values.push(String(chunk)); return true; });
    expect(await runCli(['doctor', '--cwd', join(root, 'missing'), '--json'])).toBe(1);
    expect(await runCli(['info', '--json'])).toBe(0); expect(values.map(value => JSON.parse(value).exitCode)).toEqual([1, 0]);
  });
  it('flushes system failures and nonserializable results as exit 2', async () => {
    const io = capture(); const code = await withOutputSession('failure', true, async () => { throw new CliFailure('filesystem unavailable', 2); });
    expect(code).toBe(2); expect(io.envelope()).toMatchObject({ ok: false, exitCode: 2, errors: ['filesystem unavailable'] });
  });
});

describe('doctor physical graph', () => {
  it('detects duplicate state even when versions are identical', () => {
    const root = project({ dependencies: { '@zenith/state': '^1.4.0', '@zenith/runtime': '^1.4.0' } }); installed(root, '@zenith/state');
    const runtime = installed(root, '@zenith/runtime', { dependencies: { '@zenith/state': '^1.4.0' } }); installed(runtime, '@zenith/state');
    const report = inspectProject(root); expect(report.stateCopies).toHaveLength(2); expect(report.findings).toContainEqual(expect.objectContaining({ code: 'DUPLICATE_STATE', level: 'error' }));
  });
  it('deduplicates symlink aliases to one real state installation', () => {
    const root = project({ dependencies: { '@zenith/state': '^1.4.0', '@zenith/runtime': '^1.4.0' } }); const state = installed(root, '@zenith/state');
    const runtime = installed(root, '@zenith/runtime', { dependencies: { '@zenith/state': '^1.4.0' } }); mkdirSync(join(runtime, 'node_modules/@zenith'), { recursive: true });
    symlinkSync(state, join(runtime, 'node_modules/@zenith/state'), process.platform === 'win32' ? 'junction' : 'dir');
    expect(inspectProject(root).stateCopies).toHaveLength(1);
  });
  it('finds incompatible engines, missing dependencies and version mismatches', () => {
    const root = project({ engines: { node: '<1' }, dependencies: { '@zenith/state': '^2.0.0', missing: '*' } }); installed(root, '@zenith/state');
    expect(inspectProject(root).findings.map(item => item.code)).toEqual(expect.arrayContaining(['NODE_ENGINE', 'DEPENDENCY_VERSION', 'MISSING_DEPENDENCY']));
  });
  it('reports installed versions and a valid project without mutation', async () => {
    const root = project({ dependencies: { '@zenith/state': '^1.4.0' } }); installed(root, '@zenith/state'); const before = readFileSync(join(root, 'package.json'), 'utf8'); const io = capture();
    expect(await runCli(['doctor', '--json', '--cwd', root])).toBe(0); expect(io.envelope().data.packages[0].version).toBe('1.4.0'); expect(readFileSync(join(root, 'package.json'), 'utf8')).toBe(before);
  });
});

describe('binding-aware migration and safe writes', () => {
  it('migrates only known const instances and preserves strings, comments and shadowed locals', () => {
    const source = `import { Resource as R } from '@zenith/resource';\nconst item = new R({ url: '/' });\nitem.destroy();\nfunction other(item: { destroy(): void }) { item.destroy(); }\nconst example = 'item.destroy()'; // item.destroy()\n`;
    const migrated = migrateSource(source, '/app/main.ts').source;
    expect(migrated).toContain('item.dispose();'); expect(migrated).toContain('function other(item: { destroy(): void }) { item.destroy(); }'); expect(migrated).toContain("'item.destroy()'; // item.destroy()");
    expect(migrateSource(migrated, '/app/main.ts').source).toBe(migrated);
  });
  it('does not migrate mutable or unrelated objects', () => {
    const source = `import { Resource } from '@zenith/resource'; let item = new Resource({}); item.destroy(); const local = { destroy() {} }; local.destroy();`;
    expect(migrateSource(source, '/app/main.ts').source).toBe(source);
  });
  it('updates notification imports/namespaces without renaming local bindings', () => {
    const source = `import { alert as notify, confirm } from '@zenith/notifications'; import * as n from '@zenith/notifications'; notify('x'); n.alert('x');`;
    const migrated = migrateSource(source, '/app/main.ts').source;
    expect(migrated).toContain('showAlert as notify'); expect(migrated).toContain('showConfirm as confirm'); expect(migrated).toContain('n.showAlert('); expect(migrated).toContain("notify('x')");
  });
  it('plans without mutation, writes backups, and is idempotent', () => {
    const root = project(); const file = join(root, 'main.ts'); const before = `import { Resource } from '@zenith/resource'; const x = new Resource({}); x.destroy();`;
    writeFileSync(file, before); expect(upgradeProject(root).applied).toBe(false); expect(readFileSync(file, 'utf8')).toBe(before);
    const report = upgradeProject(root, true); expect(report.applied).toBe(true); expect(readFileSync(file + '.zenith.bak', 'utf8')).toBe(before); expect(readFileSync(file, 'utf8')).toContain('x.dispose()');
    expect(upgradeProject(root, true).changes).toEqual([]);
  });
  it('refuses backup conflicts before writing any planned file', () => {
    const root = project(); const file = join(root, 'main.ts'); const before = `import { confirm } from '@zenith/notifications';`;
    writeFileSync(file, before); writeFileSync(file + '.zenith.bak', 'previous backup');
    expect(() => upgradeProject(root, true)).toThrow('Backup exists'); expect(readFileSync(file, 'utf8')).toBe(before); expect(readFileSync(file + '.zenith.bak', 'utf8')).toBe('previous backup');
  });
});

describe('real lifecycle subprocess ownership', () => {
  it('rejects recursive scripts and missing configs before launching', () => {
    const root = project({ scripts: { dev: 'zenith dev' } });
    expect(() => runnerInvocation('dev', { cwd: root })).toThrow('Recursive');
    expect(() => runnerInvocation('build', { cwd: root, config: 'missing.ts' })).toThrow('Config does not exist');
  });
  it.each(['dev', 'build', 'test'] as const)('runs the actual %s script and captures output into JSON', async name => {
    const root = project({ scripts: { [name]: 'node child.cjs' } }); writeFileSync(join(root, 'child.cjs'), "process.stdout.write('real-child-output'); process.stderr.write('child-diagnostic');"); const io = capture();
    const code = await withOutputSession(name, true, () => runLifecycle(name, { cwd: root, timeout: '10000' }));
    expect(code).toBe(0); expect(io.stderr()).toBe(''); expect(io.envelope().messages.join('')).toContain('real-child-output'); expect(io.envelope().errors.join('')).toContain('child-diagnostic');
  });
  it('maps child failure to 1 and a hung process deadline to 2, restoring signal listeners', async () => {
    const root = project({ scripts: { build: 'node child.cjs' } }); const child = join(root, 'child.cjs'); const listeners = process.listenerCount('SIGTERM');
    writeFileSync(child, 'process.exitCode = 7;');
    expect(await withOutputSession('build', false, () => runLifecycle('build', { cwd: root }))).toBe(1);
    writeFileSync(child, 'setInterval(() => {}, 1000);');
    expect(await withOutputSession('build', false, () => runLifecycle('build', { cwd: root, timeout: '100' }))).toBe(2);
    expect(process.listenerCount('SIGTERM')).toBe(listeners);
  });
});
it('does not report absent optional peers as required dependency failures', () => {
  const root = project({ peerDependencies: { jsdom: '^24.0.0' }, peerDependenciesMeta: { jsdom: { optional: true } } });
  expect(inspectProject(root).findings.filter(item => item.level === 'error')).toEqual([]);
});
it('checks a package dependency range and its distinct peer constraint', () => {
  const root = project({ dependencies: { '@zenith/state': '^1.4.0' }, peerDependencies: { '@zenith/state': '^2.0.0' } }); installed(root, '@zenith/state');
  expect(inspectProject(root).findings).toContainEqual(expect.objectContaining({ code: 'DEPENDENCY_VERSION', level: 'error' }));
});
it('never downgrades an installed project range to the bundled target', () => {
  const root = project({ dependencies: { '@zenith/state': '^99.0.0' } }); const before = readFileSync(join(root, 'package.json'), 'utf8');
  const report = upgradeProject(root, true); expect(report.manual.join(' ')).toContain('refusing'); expect(readFileSync(join(root, 'package.json'), 'utf8')).toBe(before);
});
it('migrates JavaScript and refuses to rewrite syntactically broken files', () => {
  expect(migrateSource("import { Resource } from '@zenith/resource'; const x = new Resource({}); x.destroy();", '/app/main.js').source).toContain('x.dispose()');
  expect(() => migrateSource("import { alert } from '@zenith/notifications'; const x = ;", '/app/main.ts')).toThrow('invalid syntax');
});
it('does not let child --json after the delimiter select parent JSON mode', async () => {
  const root = project({ scripts: { test: 'node child.cjs' } }); writeFileSync(join(root, 'child.cjs'), "process.stdout.write(JSON.stringify(process.argv.slice(2)));");
  const io = capture(); expect(await runCli(['test', '--cwd', root, '--', '--json'])).toBe(0); expect(io.stdout()).toContain('["--json"]'); expect(io.stdout()).not.toContain('schemaVersion');
});
it('emits a complete failure envelope instead of partial JSON for cyclic result data', async () => {
  const io = capture(); const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
  expect(await withOutputSession('serialization', true, async () => { output.result(cyclic); })).toBe(2);
  expect(io.envelope()).toMatchObject({ schemaVersion: 1, ok: false, exitCode: 2, data: null });
});
it('bounds captured child messages and exposes truncation explicitly', async () => {
  const io = capture(); await withOutputSession('capture', true, async () => { output.line('x'.repeat(300000)); output.error('late diagnostic'); });
  expect(io.envelope().truncated).toBe(true); expect(io.envelope().messages[0].length).toBe(256 * 1024);
});
it('isolates simultaneous output sessions instead of sharing command/error state', async () => {
  const lines: string[] = []; vi.spyOn(process.stdout, 'write').mockImplementation(chunk => { lines.push(String(chunk)); return true; });
  const root = project(); const codes = await Promise.all([runCli(['info', '--json']), runCli(['doctor', '--cwd', join(root, 'missing'), '--json'])]);
  expect(codes).toEqual([0, 1]); const envelopes = lines.map(line => JSON.parse(line));
  expect(envelopes.find(value => value.command === 'info')).toMatchObject({ exitCode: 0, errors: [] }); expect(envelopes.find(value => value.command === 'doctor')).toMatchObject({ exitCode: 1 });
});
