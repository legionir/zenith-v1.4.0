import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('Vite peer installation contract (#13)', () => {
  it.each(['5.4.21', '6.4.2', '7.3.6', '8.3.4'])(
    'npm rejects incompatible or unpatched Vite %s with ERESOLVE',
    (version) => {
      const dir = mkdtempSync(join(tmpdir(), 'zenith-invalid-vite-peer-'));
      try {
        const manifest = JSON.parse(readFileSync('packages/vite-plugin/package.json', 'utf8'));
        // Isolate the actual Vite peer range from unpublished @zenith registry
        // dependencies. This is a peer-metadata fixture, NOT a consumer bundle test.
        const plugin = join(dir, 'plugin');
        const vite = join(dir, 'vite');
        mkdirSync(plugin);
        mkdirSync(vite);
        writeFileSync(
          join(plugin, 'package.json'),
          JSON.stringify({
            name: manifest.name,
            version: manifest.version,
            peerDependencies: { vite: manifest.peerDependencies.vite },
          }),
        );
        writeFileSync(join(vite, 'package.json'), JSON.stringify({ name: 'vite', version }));
        const runNpm = (args, cwd = dir) =>
          process.env.npm_execpath
            ? spawnSync(process.execPath, [process.env.npm_execpath, ...args], {
                cwd,
                encoding: 'utf8',
                timeout: 15_000,
              })
            : spawnSync('npm', args, { cwd, encoding: 'utf8', timeout: 15_000, shell: true });
        for (const pkg of [plugin, vite]) {
          const packed = runNpm(
            ['pack', '--json', '--ignore-scripts', '--pack-destination', dir],
            pkg,
          );
          expect(packed.status, packed.stderr).toBe(0);
        }
        writeFileSync(
          join(dir, 'package.json'),
          JSON.stringify({
            private: true,
            dependencies: {
              [manifest.name]: `file:./zenith-vite-plugin-${manifest.version}.tgz`,
              vite: `file:./vite-${version}.tgz`,
            },
          }),
        );
        const result = runNpm([
          'install',
          '--package-lock-only',
          '--ignore-scripts',
          '--strict-peer-deps',
          '--offline',
          '--no-audit',
          '--no-fund',
        ]);
        expect(result.error).toBeUndefined();
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain('ERESOLVE');
        expect(result.stderr).toContain(manifest.peerDependencies.vite);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );
});
