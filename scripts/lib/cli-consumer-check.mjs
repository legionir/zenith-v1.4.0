// Final-validation fixture only. Called on an installed tarball consumer, never on source aliases.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export function checkInstalledCli(project, cliBin) {
  const invoke = (args, cwd = project, expected = 0) => {
    const result = spawnSync(process.execPath, [cliBin, ...args, '--json'], { cwd, encoding: 'utf8', timeout: 20000, maxBuffer: 8 * 1024 * 1024 });
    if (result.error) throw result.error;
    assert.equal(result.status, expected, `${args.join(' ')}: ${result.stdout}\n${result.stderr}`);
    const json = JSON.parse(result.stdout); assert.equal(json.schemaVersion, 1); assert.equal(json.exitCode, expected); assert.equal(json.ok, expected === 0); assert.equal(result.stderr, ''); return json;
  };
  assert.equal(invoke(['info']).command, 'info');
  invoke(['not-a-command'], project, 1);
  const doctor = invoke(['doctor']); assert.equal(doctor.data.stateCopies.length, 1);
  // Generate every actual scaffold without modifying its manifest or using source aliases.
  for (const kind of ['spa', 'ssr', 'pwa', 'dashboard', 'minimal']) {
    const name = `cli-fixture-${kind}`; const result = invoke(['create', name, '--no-git', '--template', kind]);
    assert.equal(result.data.template, kind); const root = join(project, name); const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    assert.equal(pkg.scripts.test, 'vitest run'); assert.ok(existsSync(join(root, 'test/state.test.ts'))); assert.ok(existsSync(join(root, 'src/main.ts')));
    assert.ok(!JSON.stringify(pkg).includes('workspace:')); if (kind === 'ssr') assert.ok(existsSync(join(root, 'server/index.ts')));
  }
  const lifecycle = join(project, 'cli-process-fixture'); mkdirSync(lifecycle);
  writeFileSync(join(lifecycle, 'package.json'), JSON.stringify({ name: 'process-fixture', scripts: { dev: 'node child.cjs', build: 'node child.cjs', test: 'node child.cjs' } }));
  writeFileSync(join(lifecycle, 'child.cjs'), "process.stdout.write('installed-child-output');");
  for (const command of ['dev', 'build', 'test']) { const result = invoke([command, '--cwd', lifecycle]); assert.equal(result.data.childExitCode, 0); assert.ok(result.messages.join('').includes('installed-child-output')); }
  writeFileSync(join(lifecycle, 'child.cjs'), 'process.exitCode = 7;');
  assert.equal(invoke(['build', '--cwd', lifecycle], project, 1).data.childExitCode, 7);
  writeFileSync(join(lifecycle, 'child.cjs'), 'setInterval(() => {}, 1000);');
  assert.equal(invoke(['build', '--cwd', lifecycle, '--timeout', '100'], project, 2).data.timedOut, true);
  const filename = join(lifecycle, 'main.ts'); const old = "import { Resource } from '@zenith/resource'; const x = new Resource({ url: '/' }); x.destroy();";
  writeFileSync(filename, old); invoke(['upgrade', '--cwd', lifecycle]); assert.equal(readFileSync(filename, 'utf8'), old);
  invoke(['upgrade', '--cwd', lifecycle, '--write']); assert.ok(readFileSync(filename, 'utf8').includes('x.dispose()')); assert.equal(readFileSync(filename + '.zenith.bak', 'utf8'), old);
  assert.equal(invoke(['upgrade', '--cwd', lifecycle]).data.changes.length, 0);
}
