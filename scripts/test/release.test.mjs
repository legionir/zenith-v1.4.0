import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runRelease, parseReleaseArgs } from '../release.mjs';

function createMockWorkspace() {
  const root = mkdtempSync(join(tmpdir(), 'zenith-release-test-'));
  const pkgs = [
    {
      dir: 'errors',
      name: '@zenith/errors',
      version: '1.4.0',
      deps: {},
    },
    {
      dir: 'state',
      name: '@zenith/state',
      version: '1.4.0',
      deps: { '@zenith/errors': '1.4.0' },
    },
    {
      dir: 'runtime',
      name: '@zenith/runtime',
      version: '1.4.0',
      deps: { '@zenith/state': '1.4.0', '@zenith/errors': '1.4.0' },
    },
    {
      dir: 'demo',
      name: '@zenith/demo',
      version: '1.4.0',
      private: true,
      deps: {},
    },
  ];

  for (const p of pkgs) {
    const dirPath = join(root, 'packages', p.dir);
    mkdirSync(join(dirPath, 'dist'), { recursive: true });
    writeFileSync(
      join(dirPath, 'package.json'),
      JSON.stringify({
        name: p.name,
        version: p.version,
        private: p.private ?? false,
        dependencies: p.deps,
      }),
    );
  }
  return root;
}

describe('scripts/release.mjs safe release pipeline (#73)', () => {
  it('defaults to dryRun=true unless --publish is passed', () => {
    expect(parseReleaseArgs([]).dryRun).toBe(true);
    expect(parseReleaseArgs(['--dry-run']).dryRun).toBe(true);
    expect(parseReleaseArgs(['--publish', '--from', '@zenith/state'])).toMatchObject({
      dryRun: false,
      fromPkg: '@zenith/state',
    });
  });

  it('halts immediately when git working tree is dirty', () => {
    const root = createMockWorkspace();
    try {
      const res = runRelease({
        rootDir: root,
        exec: (cmd, args) => {
          if (cmd === 'git' && args[0] === 'status') {
            return { status: 0, stdout: ' M packages/state/src/index.ts\n', stderr: '' };
          }
          return { status: 0, stdout: '', stderr: '' };
        },
      });
      expect(res.ok).toBe(false);
      expect(res.stage).toBe('git-clean');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('halts when preflight test/build gate fails', () => {
    const root = createMockWorkspace();
    try {
      const res = runRelease({
        rootDir: root,
        exec: (cmd, args) => {
          if (cmd === 'git') return { status: 0, stdout: '', stderr: '' };
          if (cmd === 'npm' && args[0] === 'test') {
            return { status: 1, stdout: '', stderr: 'test failed' };
          }
          return { status: 0, stdout: '', stderr: '' };
        },
      });
      expect(res.ok).toBe(false);
      expect(res.stage).toBe('preflight:test');
      expect(res.published).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('publishes packages in topological order, skips private packages, and halts with --from resume command on partial failure', () => {
    const root = createMockWorkspace();
    try {
      const okRes = runRelease({
        rootDir: root,
        skipChecks: true,
        dryRun: true,
        exec: () => ({ status: 0, stdout: '', stderr: '' }),
      });
      expect(okRes.ok).toBe(true);
      expect(okRes.published).toEqual(['@zenith/errors', '@zenith/state', '@zenith/runtime']);
      expect(okRes.skipped.map((s) => s.name)).toEqual(['@zenith/demo']);

      // Simulate failure on @zenith/state — must halt before @zenith/runtime
      const failRes = runRelease({
        rootDir: root,
        skipChecks: false,
        dryRun: false,
        env: { GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'push', GITHUB_REF_TYPE: 'tag', GITHUB_REF: 'refs/tags/v1.4.0', ACTIONS_ID_TOKEN_REQUEST_URL: 'unit-fixture', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'unit-fixture' },
        exec: (cmd, args, opts) => {
          if (cmd === 'npm' && args[0] === '--version') return { status: 0, stdout: '11.21.1', stderr: '' };
          // Windows: cwd بک‌اسلش دارد — پیش از مقایسه نرمال شود.
          if (
            cmd === 'npm' &&
            args[0] === 'publish' &&
            opts.cwd.replace(/\\/g, '/').endsWith('/state')
          ) {
            return { status: 1, stdout: '', stderr: 'network timeout' };
          }
          return { status: 0, stdout: '', stderr: '' };
        },
      });
      expect(failRes.ok).toBe(false);
      expect(failRes.failedPackage).toBe('@zenith/state');
      expect(failRes.published).toEqual(['@zenith/errors']);
      expect(failRes.resumeCommand).toContain('--from @zenith/state');

      // Resume from @zenith/state
      const resumeRes = runRelease({
        rootDir: root,
        skipChecks: true,
        dryRun: true,
        fromPkg: '@zenith/state',
        exec: () => ({ status: 0, stdout: '', stderr: '' }),
      });
      expect(resumeRes.ok).toBe(true);
      expect(resumeRes.published).toEqual(['@zenith/state', '@zenith/runtime']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
