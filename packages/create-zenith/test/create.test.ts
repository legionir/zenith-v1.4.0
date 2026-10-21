import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CreateCLIError,
  DEFAULTS,
  detectPackageManager,
  getCreateVersion,
  parseCreateArgs,
  runCreate,
  type SpawnHost,
} from '../src/program';

function silent() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out: (line: string): void => {
      out.push(line);
    },
    err: (line: string): void => {
      err.push(line);
    },
    outLines: out,
    errLines: err,
  };
}

function okSpawn(calls: { cmd: string; args: readonly string[]; cwd: string }[]): SpawnHost {
  return {
    run: (cmd, args, cwd) => {
      calls.push({ cmd, args, cwd });
      return { status: 0 };
    },
  };
}

describe('create-zenith argv', () => {
  it('parses names, kinds and flags with documented defaults', () => {
    const plan = parseCreateArgs(['my-app'], '/cwd');
    expect(plan).toMatchObject({
      name: 'my-app',
      kind: 'spa',
      install: true,
      git: true,
      force: false,
      dryRun: false,
      json: false,
      cwd: '/cwd',
    });
    expect(plan.pm).toBe('npm');
    expect(parseCreateArgs(['a', '-t', 'ssr'], '/cwd').kind).toBe('ssr');
    expect(parseCreateArgs(['a', '--template=pwa'], '/cwd').kind).toBe('pwa');
    expect(parseCreateArgs(['a', '--pwa'], '/cwd').kind).toBe('pwa');
    expect(parseCreateArgs(['a', '--no-install', '--no-git'], '/cwd')).toMatchObject({
      install: false,
      git: false,
    });
    expect(parseCreateArgs(['a', '--pm', 'bun'], '/cwd').pm).toBe('bun');
    expect(DEFAULTS.template).toBe('spa');
    expect(getCreateVersion()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('rejects usage errors with exit 1 (no partial run)', () => {
    for (const argv of [
      [],
      ['a', 'b'],
      ['a', '--template', 'nope'],
      ['a', '--pwa', '--template', 'ssr'],
      ['a', '--pm', 'frobnicate'],
      ['a', '--nope'],
      ['../out'],
      ['a', '--js'],
    ]) {
      expect(() => parseCreateArgs(argv, '/cwd'), JSON.stringify(argv)).toThrow(CreateCLIError);
    }
    try {
      parseCreateArgs([], '/cwd');
      expect.unreachable();
    } catch (error) {
      expect((error as CreateCLIError).exitCode).toBe(1);
    }
  });
  it('prints help and version to stdout with exit 0', () => {
    for (const argv of [['--help'], ['-h'], ['--version'], ['-V']]) {
      const io = silent();
      expect(runCreate(argv, { ...io, cwd: '/cwd' })).toBe(0);
      expect(io.outLines.join('\n').length).toBeGreaterThan(0);
      expect(io.errLines).toEqual([]);
    }
  });
});

describe('create-zenith package-manager detection', () => {
  it('prefers the flag, then the user agent, then lockfiles', () => {
    expect(detectPackageManager({ pm: 'yarn', cwd: '/cwd' })).toBe('yarn');
    expect(detectPackageManager({ cwd: '/cwd', userAgent: 'pnpm/9.0.0' })).toBe('pnpm');
    expect(detectPackageManager({ cwd: '/cwd', userAgent: 'bun/1.0.0' })).toBe('bun');
    expect(detectPackageManager({ cwd: process.cwd(), userAgent: '' })).toBe('npm');
  });
});

describe('create-zenith runs', () => {
  it('dry-run plans with zero writes, zero installs and zero git', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cz-dry-'));
    try {
      const io = silent();
      const calls: { cmd: string; args: readonly string[]; cwd: string }[] = [];
      const code = runCreate(['demo', '--dry-run', '--json'], {
        ...io,
        cwd: dir,
        spawn: okSpawn(calls),
      });
      expect(code).toBe(0);
      expect(calls).toEqual([]);
      expect(readdirSync(dir)).toEqual([]);
      const result = JSON.parse(io.outLines.join('\n'));
      expect(result).toMatchObject({ name: 'demo', template: 'spa', dryRun: true });
      expect(result.files.length).toBeGreaterThan(5);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('scaffolds for real, installs with an argv array (no shell) and inits git', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cz-real-'));
    try {
      const io = silent();
      const calls: { cmd: string; args: readonly string[]; cwd: string }[] = [];
      const code = runCreate(['shop', '--pm', 'pnpm', '--json'], {
        ...io,
        cwd: dir,
        spawn: okSpawn(calls),
      });
      expect(code).toBe(0);
      expect(existsSync(join(dir, 'shop', 'package.json'))).toBe(true);
      expect(existsSync(join(dir, 'shop', 'server', 'index.ts'))).toBe(false);
      expect(JSON.parse(readFileSync(join(dir, 'shop', 'package.json'), 'utf8')).name).toBe('shop');
      expect(calls).toContainEqual({
        cmd: 'pnpm',
        args: ['install'],
        cwd: join(dir, 'shop'),
      });
      expect(calls).toContainEqual({
        cmd: 'git',
        args: ['init', '--quiet'],
        cwd: join(dir, 'shop'),
      });
      const result = JSON.parse(io.outLines.join('\n'));
      expect(result).toMatchObject({ installed: true, git: true, pm: 'pnpm' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('keeps files but exits 2 when install fails; exits 1 on existing dirs', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cz-fail-'));
    try {
      const failing: SpawnHost = {
        run: (cmd) => ({ status: cmd === 'git' ? 0 : 1 }),
      };
      const io = silent();
      const code = runCreate(['kept', '--no-git'], { ...io, cwd: dir, spawn: failing });
      expect(code).toBe(2);
      expect(existsSync(join(dir, 'kept', 'package.json'))).toBe(true);
      expect(io.errLines.join('\n')).toContain('Install failed');

      const io2 = silent();
      expect(runCreate(['kept'], { ...io2, cwd: dir, spawn: failing })).toBe(1);
      const io3 = silent();
      expect(runCreate(['kept', '--force', '--no-install', '--no-git'], { ...io3, cwd: dir, spawn: failing })).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('never writes outside cwd and rejects bad names', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cz-trav-'));
    try {
      for (const name of ['../escape', '/abs', 'a/b', 'con']) {
        const io = silent();
        expect(runCreate([name], { ...io, cwd: dir })).toBe(1);
      }
      expect(readdirSync(dir)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
