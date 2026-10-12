// #7 (AUDIT CLI-03): zenith create نباید اجازهٔ directory traversal بدهد.
// تست دو لایه:
//  1) واحد: validateProjectName برای ورودی‌های مخرب/مجاز.
//  2) یکپارچگی: بیلد واقعی CLI با esbuild و اجرای `create <name>` در cwd
//     موقت — باید با کد خروج غیرصفر رد شود و هیچ فایل بیرون cwd نوشته نشود.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { build } from 'esbuild';
import { mkdtempSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateProjectName } from '../src/validate-project-name';

// packages/cli/test → repo root is three levels up
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const BAD_NAMES = [
  '../evil',
  '../../evil',
  '/etc/passwd-dir',
  'a/b',
  '..\\evil',
  'C:\\evil',
  '',
  'x'.repeat(101),
  'con',
  'NUL.txt',
  'com1',
  '.hidden',
  'name with space',
  'путь', // غیرلاتین
];

const GOOD_NAMES = ['my-app', 'app_1', 'App.v2', 'z1', 'my.dots.ok'];

describe('validateProjectName (#7)', () => {
  it('rejects traversal, absolute, separator, reserved, empty and over-long names', () => {
    for (const name of BAD_NAMES) {
      expect(
        validateProjectName(name, '/home/user/projects'),
        `must reject: ${name}`,
      ).not.toBeNull();
    }
  });

  it('accepts conventional project names', () => {
    for (const name of GOOD_NAMES) {
      expect(validateProjectName(name, '/home/user/projects'), `must accept: ${name}`).toBeNull();
    }
  });

  it('error messages are actionable (mention what is wrong)', () => {
    expect(validateProjectName('../x', '/p')).toMatch(/separator|traversal|escapes/i);
    expect(validateProjectName('/etc/x', '/p')).toMatch(/absolute/i);
    expect(validateProjectName('', '/p')).toMatch(/empty/i);
    expect(validateProjectName('con', '/p')).toMatch(/reserved/i);
  });

  it('defense-in-depth: resolved path must stay under cwd', () => {
    // حتی اگر الگو روزی شل شود، لنگهٔ resolve جلوی فرار را می‌گیرد
    const err = validateProjectName('..', '/tmp');
    expect(err).not.toBeNull();
  });
});

describe('zenith create CLI integration (#7)', () => {
  let cliPath: string;
  let sandbox: string;
  let cliDir: string;

  beforeAll(async () => {
    sandbox = mkdtempSync(join(tmpdir(), 'zenith-cli-'));
    cliDir = join(sandbox, 'cli-dist');
    cliPath = join(cliDir, 'zenith.mjs');
    await build({
      entryPoints: [join(ROOT, 'packages/cli/src/index.ts')],
      outfile: cliPath,
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: 'node18',
      // commander (CJS) uses require() internally; ESM output needs a real require.
      banner: {
        js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
      },
      plugins: [
        {
          name: 'cli-alias',
          setup(esbuild) {
            esbuild.onResolve({ filter: /^@zenith\/cli\// }, (args) => ({
              path: join(ROOT, 'packages/cli/src', args.path.slice('@zenith/cli/'.length) + '.ts'),
            }));
            esbuild.onResolve({ filter: /^@zenith\/[^/]+$/ }, (args) => ({
              path: join(ROOT, 'packages', args.path.slice('@zenith/'.length), 'src/index.ts'),
            }));
          },
        },
      ],
    });
  });

  afterAll(() => {
    rmSync(sandbox, { recursive: true, force: true });
  });

  function runCreate(cwd: string, name: string) {
    try {
      const out = execFileSync(process.execPath, [cliPath, 'create', name], {
        cwd,
        encoding: 'utf8',
        stdio: 'pipe',
      });
      return { code: 0, out };
    } catch (e: any) {
      return { code: e.status as number, out: String(e.stdout ?? '') + String(e.stderr ?? '') };
    }
  }

  it.each([
    ['../evil', 'traversal parent'],
    ['a/b', 'nested separator'],
    ['..\\evil', 'windows separator'],
  ])('rejects %s (%s) with non-zero exit and writes nothing outside cwd', (name) => {
    const projectRoot = join(sandbox, 'run-' + name.replace(/[^a-z]/gi, '_'));
    mkdirSync(projectRoot, { recursive: true });
    const { code, out } = runCreate(projectRoot, name);
    expect(code, out).not.toBe(0);
    expect(out).toMatch(/\[ERROR\].*Invalid project name/);
    // هیچ چیزی بیرون projectRoot ساخته نشود
    expect(existsSync(join(sandbox, 'evil'))).toBe(false);
    expect(existsSync(join(projectRoot, 'a'))).toBe(false);
    // خود projectRoot هم باید خالی بماند (CLI فقط درون آن کار می‌کرد)
    expect(readdirSync(projectRoot)).toEqual([]);
  });

  it('accepts a valid name and creates the project inside cwd', () => {
    const projectRoot = join(sandbox, 'run-ok');
    mkdirSync(projectRoot, { recursive: true });
    const { code, out } = runCreate(projectRoot, 'my-app');
    expect(code, out).toBe(0);
    expect(existsSync(join(projectRoot, 'my-app', 'package.json'))).toBe(true);
  });
});
