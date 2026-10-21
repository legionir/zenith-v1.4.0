// Tests for the LICENSE policy (#68, #51).
// Root MIT license file, an identical copy in every workspace package (so
// every npm tarball carries it) and in every distributable tool (so VSIX/ZIP
// artifacts carry it too), and the sync script's --check mode.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';

const rootLicense = readFileSync('LICENSE', 'utf8');

// #51: tools/ are private workspaces, not npm libraries — but they ship
// distributables, so the LICENSE policy covers them explicitly instead of
// silently skipping them.
const dirs = ['packages', 'tools'].flatMap((parent) =>
  readdirSync(parent, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    // ردّ دریکتوری گذرای scaffold موازی تست new-package (#172)
    .filter((d) => !(parent === 'packages' && d.name === 'tmp-scaffold-verify'))
    .filter((d) => existsSync(join(parent, d.name, 'package.json')))
    .map((d) => join(parent, d.name)),
);

describe('LICENSE (#68)', () => {
  it('root LICENSE is the MIT text with a copyright line', () => {
    expect(rootLicense).toContain('MIT License');
    expect(rootLicense).toMatch(/Copyright \(c\) \d{4} Zenith Team/);
  });

  it.each(dirs)('%s carries an identical LICENSE', (dir) => {
    const p = join(dir, 'LICENSE');
    expect(existsSync(p), p).toBe(true);
    expect(readFileSync(p, 'utf8')).toBe(rootLicense);
  });

  it('every workspace declares license MIT', () => {
    for (const dir of dirs) {
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
      expect(pkg.license, dir).toBe('MIT');
    }
  });

  it('sync script --check passes on a fresh tree', () => {
    expect(() =>
      execFileSync(process.execPath, ['scripts/sync-license.mjs', '--check'], { stdio: 'pipe' }),
    ).not.toThrow();
  });

  it('npm pack includes the LICENSE (state)', () => {
    // Deterministic: --json reports the tarball inventory regardless of the
    // inherited loglevel (a parent `npm test --silent` otherwise suppresses
    // npm's stderr notices). "packages/state" without ./ would be read as a
    // git spec, so the path form matters.
    // Windows: npm یک shim نوع npm.cmd است و spawn مستقیم آن در Nodeهای جدید
    // بدون shell رد میشود (status=null / ENOENT). مسیر مطمئن: env.npm_execpath
    // (تحت vitest شل نصب‌شدهٔ npm موجود است) + اجرای مستقیم node روی آن؛
    // fallback: shell:true.
    const npmArgs = ['pack', '--dry-run', '--json', './packages/state'];
    const r = process.env.npm_execpath
      ? spawnSync(process.execPath, [process.env.npm_execpath, ...npmArgs], { encoding: 'utf8' })
      : spawnSync('npm', npmArgs, { encoding: 'utf8', shell: true });
    expect(r.status).toBe(0);
    const packed = JSON.parse(r.stdout);
    expect(
      packed[0].files.some((f) => f.path === 'LICENSE'),
      'LICENSE in tarball',
    ).toBe(true);
  });
});
