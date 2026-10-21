// Tests for scripts/cleanup-hygiene.mjs (#116 / DEC-032).
// Synthetic fixtures + a real-repo acceptance assertion.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  checkCleanupHygiene,
  BEHAVIORAL_ALLOWLIST,
  PROCESS_NAME_ALLOWLIST,
  LIFECYCLE_HOOK_ALLOWLIST,
} from '../cleanup-hygiene.mjs';

let tmp;
beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), 'zen-cleanup-'));
});
afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

/**
 * می‌سازد: root/packages/<pkg>/src/<file> با متن داده‌شده.
 * read همان callback گیت است: مسیر repo-relative (`packages/x/src/y.ts`).
 */
function makeFixture(root, files) {
  const readMap = new Map();
  for (const [relRepo, text] of Object.entries(files)) {
    const abs = join(root, relRepo);
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, text);
    readMap.set(relRepo, text);
  }
  return (relp) => readMap.get(relp) ?? '';
}

const pkgs = (root) => join(root, 'packages');

describe('checkCleanupHygiene — rule 1b: on* registration APIs return Cleanup (#118/DEC-032)', () => {
  it('passes an exported on* returning Cleanup and flags one returning void', () => {
    const root = join(tmp, 'r1b-on');
    const read = makeFixture(root, {
      'packages/foo/src/index.ts': [
        'export function onThing(cb: () => void): () => void { return () => void cb; }',
        'export function onOther(cb: () => void): void { void cb; }',
      ].join('\n'),
    });
    const { errors, processChecked } = checkCleanupHygiene(pkgs(root), read);
    expect(processChecked).toBe(2);
    expect(errors).toEqual([
      expect.stringContaining('packages/foo/src/index.ts: onOther — نوع بازگشتی "void"'),
    ]);
  });

  it('honours the lifecycle-hook allowlist (register-only hooks in a scope) and requires the DEC-032 comment', () => {
    expect(Object.keys(LIFECYCLE_HOOK_ALLOWLIST['packages/runtime-core/src/index.ts'])).toEqual([
      'onMount',
      'onUnmount',
      'onUpdate',
    ]);
    // هر سه ردیف allowlist این فایل باید وجود داشته باشند (ردیف بی‌استفاده گیت را قرمز می‌کند).
    const lifecycleHooks = ['onMount', 'onUnmount', 'onUpdate']
      .map((n) => `export function ${n}(fn: () => void): void { void fn; }`)
      .join('\n');
    const withComment = makeFixture(join(tmp, 'r1b-life'), {
      'packages/runtime-core/src/index.ts': [
        '// DEC-032: lifecycle hooks are scope-bound, not unsubscribe handles.',
        lifecycleHooks,
      ].join('\n'),
    });
    expect(checkCleanupHygiene(pkgs(join(tmp, 'r1b-life')), withComment).errors).toEqual([]);

    const withoutComment = makeFixture(join(tmp, 'r1b-life2'), {
      'packages/runtime-core/src/index.ts': lifecycleHooks + '\n',
    });
    const res = checkCleanupHygiene(pkgs(join(tmp, 'r1b-life2')), withoutComment);
    expect(res.errors).toEqual([expect.stringContaining('DEC-032')]);
  });

  it('flags a stale lifecycle-allowlist file (hook renamed away)', () => {
    const read = makeFixture(join(tmp, 'r1b-life3'), {
      'packages/runtime-core/src/index.ts': '// DEC-032\nexport const x = 1;\n',
    });
    const res = checkCleanupHygiene(pkgs(join(tmp, 'r1b-life3')), read);
    expect(res.errors.some((e) => e.includes('LIFECYCLE_HOOK_ALLOWLIST'))).toBe(true);
  });
});

describe('checkCleanupHygiene — rule 1: process*/bind* return Cleanup', () => {
  it('passes an exported process* with explicit () => void return', () => {
    const root = join(tmp, 'r1-ok');
    const read = makeFixture(root, {
      'packages/foo/src/index.ts':
        'export function processThing(el: Element): () => void { return () => void el; }\n',
    });
    const { errors, processChecked } = checkCleanupHygiene(pkgs(root), read);
    expect(errors).toEqual([]);
    expect(processChecked).toBe(1);
  });

  it('RED: flags a process* with no explicit return type', () => {
    const root = join(tmp, 'r1-void');
    const read = makeFixture(root, {
      'packages/foo/src/index.ts': 'export function processThing(el: Element) { void el; }\n',
    });
    const { errors } = checkCleanupHygiene(pkgs(root), read);
    expect(errors.some((e) => e.includes('processThing') && e.includes('نوع بازگشتی'))).toBe(true);
  });

  it('RED: flags a process* returning a non-Cleanup type', () => {
    const root = join(tmp, 'r1-wrong');
    const read = makeFixture(root, {
      'packages/foo/src/index.ts':
        'export function processThing(el: Element): Promise<string> { void el; return Promise.resolve("x"); }\n',
    });
    const { errors } = checkCleanupHygiene(pkgs(root), read);
    expect(errors.some((e) => e.includes('Promise<string>'))).toBe(true);
  });

  it('accepts Cleanup alias and *Controller return types', () => {
    const root = join(tmp, 'r1-alias');
    const read = makeFixture(root, {
      'packages/foo/src/index.ts':
        'export type Cleanup = () => void;\n' +
        'export interface FooController { (): void; dispose(): void; }\n' +
        'export function processA(el: Element): Cleanup { void el; return () => {}; }\n' +
        'export function processB(el: Element): FooController { void el; return Object.assign(() => {}, { dispose() {} }) as FooController; }\n',
    });
    const { errors, processChecked } = checkCleanupHygiene(pkgs(root), read);
    expect(errors).toEqual([]);
    expect(processChecked).toBe(2);
  });

  it('honors PROCESS_NAME_ALLOWLIST (Promise data utility)', () => {
    const root = join(tmp, 'r1-exempt');
    const read = makeFixture(root, {
      'packages/data/src/fetcher.ts':
        '// #116: نام process* اشتباه نام‌گذاری‌شده؛ utility داده است\n' +
        'export async function processFetchWithCache(url: string): Promise<unknown> { return url; }\n',
    });
    const { errors, processChecked } = checkCleanupHygiene(pkgs(root), read);
    expect(errors).toEqual([]);
    expect(processChecked).toBe(0); // allowlisted ⇒ نه counted و نه خطا
  });

  it('RED: PROCESS_NAME_ALLOWLIST file without a #116 comment fails (self-documenting)', () => {
    const root = join(tmp, 'r1-exempt-nocomment');
    const read = makeFixture(root, {
      'packages/data/src/fetcher.ts':
        'export async function processFetchWithCache(url: string): Promise<unknown> { return url; }\n',
    });
    const { errors } = checkCleanupHygiene(pkgs(root), read);
    expect(errors.some((e) => e.includes('PROCESS_NAME_ALLOWLIST') && e.includes('#116'))).toBe(
      true,
    );
  });

  it('handles nested-paren parameter lists before reading the return type', () => {
    const root = join(tmp, 'r1-nested');
    const read = makeFixture(root, {
      'packages/foo/src/index.ts':
        'export function processThing(cb: ((x: number) => void), el: Element): () => void { void cb; void el; }\n',
    });
    const { errors } = checkCleanupHygiene(pkgs(root), read);
    expect(errors).toEqual([]);
  });

  it('ignores a bind*/process* name appearing in a comment, only matches real exports', () => {
    const root = join(tmp, 'r1-comment');
    const read = makeFixture(root, {
      'packages/foo/src/index.ts': '// export function processFake() {}\nexport const x = 1;\n',
    });
    const { processChecked } = checkCleanupHygiene(pkgs(root), read);
    expect(processChecked).toBe(0);
  });
});

describe('checkCleanupHygiene — rule 2: destroy/cancel/stop must be alias or allowlist', () => {
  it('RED: flags a non-alias destroy member', () => {
    const root = join(tmp, 'r2-bad');
    const read = makeFixture(root, {
      'packages/foo/src/thing.ts':
        'export class Thing {\n  destroy(): void {}\n  dispose(): void {}\n}\n',
    });
    const { errors, membersChecked } = checkCleanupHygiene(pkgs(root), read);
    expect(membersChecked).toBe(1);
    expect(errors.some((e) => e.includes('"destroy"') && e.includes('alias'))).toBe(true);
  });

  it('passes a proper deprecated alias: @deprecated + deprecate(ZEN-DEPR, x.destroy()) + dispose', () => {
    const root = join(tmp, 'r2-ok');
    const read = makeFixture(root, {
      'packages/foo/src/thing.ts':
        "import { deprecate } from '@zenith/errors';\n" +
        'export class Thing {\n' +
        '  /** @deprecated use dispose() */\n' +
        '  destroy(): void {\n' +
        "    deprecate('ZEN-DEPR-099', 'Thing.destroy()');\n" +
        '    this.dispose();\n' +
        '  }\n' +
        '  dispose(): void {}\n' +
        '}\n',
    });
    const { errors, membersChecked } = checkCleanupHygiene(pkgs(root), read);
    expect(membersChecked).toBe(1);
    expect(errors).toEqual([]);
  });

  it('RED: @deprecated present but no matching deprecate(ZEN-DEPR, x.destroy()) call', () => {
    const root = join(tmp, 'r2-nodepr');
    const read = makeFixture(root, {
      'packages/foo/src/thing.ts':
        'export class Thing {\n  /** @deprecated */\n  destroy(): void {}\n  dispose(): void {}\n}\n',
    });
    const { errors } = checkCleanupHygiene(pkgs(root), read);
    expect(errors.some((e) => e.includes('"destroy"'))).toBe(true);
  });

  it('RED: alias-shaped but the file has no dispose()', () => {
    const root = join(tmp, 'r2-nodispose');
    const read = makeFixture(root, {
      'packages/foo/src/thing.ts':
        "import { deprecate } from '@zenith/errors';\n" +
        'export class Thing {\n' +
        '  /** @deprecated */\n' +
        "  destroy(): void { deprecate('ZEN-DEPR-098', 'Thing.destroy()'); }\n" +
        '}\n',
    });
    const { errors } = checkCleanupHygiene(pkgs(root), read);
    expect(errors.some((e) => e.includes('"destroy"'))).toBe(true);
  });

  it('accepts a behavioral allowlist member when the file also cites DEC-032', () => {
    const root = join(tmp, 'r2-allow');
    const read = makeFixture(root, {
      'packages/transition/src/transition.ts':
        '// DEC-032: cancel یک لغو run-scoped است، نه چرخهٔ عمر\n' +
        'export class TransitionRun {\n  cancel(): void {}\n}\n',
    });
    // clone allowlist entry so the guard's relRepo key matches exactly
    const { errors, membersChecked } = checkCleanupHygiene(pkgs(root), read);
    expect(membersChecked).toBe(1);
    expect(errors).toEqual([]);
  });

  it('RED: allowlist member but file lacks the DEC-032 comment', () => {
    const root = join(tmp, 'r2-allow-nocomment');
    const read = makeFixture(root, {
      'packages/transition/src/transition.ts': 'export class T {\n  cancel(): void {}\n}\n',
    });
    const { errors } = checkCleanupHygiene(pkgs(root), read);
    expect(errors.some((e) => e.includes('DEC-032'))).toBe(true);
  });

  it('RED: a stale allowlist row (file present but no member with that name) fails', () => {
    const root = join(tmp, 'r2-stale');
    const read = makeFixture(root, {
      // allowlist expects `cancel` in transition.ts, but file only has dispose
      'packages/transition/src/transition.ts':
        '// DEC-032\nexport class T {\n  dispose(): void {}\n}\n',
    });
    const { errors } = checkCleanupHygiene(pkgs(root), read);
    expect(errors.some((e) => e.includes('ردیف allowlist') && e.includes('cancel'))).toBe(true);
  });
});

describe('checkCleanupHygiene — real repo (#116 acceptance)', () => {
  it('current repo passes the gate', () => {
    const { errors } = checkCleanupHygiene(join(process.cwd(), 'packages'), (relp) =>
      readFileSync(join(process.cwd(), relp), 'utf8'),
    );
    if (errors.length) throw new Error('cleanup-hygiene violations:\n  ' + errors.join('\n  '));
    expect(errors).toEqual([]);
  });

  it('allowlists are self-consistent (no empty rows)', () => {
    // sanity: every allowlist entry is a non-empty member map
    for (const [file, members] of Object.entries(BEHAVIORAL_ALLOWLIST)) {
      expect(Object.keys(members).length, file).toBeGreaterThan(0);
    }
    for (const [file, fns] of Object.entries(PROCESS_NAME_ALLOWLIST)) {
      expect(Object.keys(fns).length, file).toBeGreaterThan(0);
    }
  });
});
