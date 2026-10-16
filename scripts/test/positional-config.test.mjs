// @vitest-environment jsdom
// scripts/test/positional-config.test.mjs
/* global document */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  auditPositionalConfig,
  loadAllowlist,
  isOptionsParamText,
} from '../positional-config-audit.mjs';
import { readFileSync } from 'node:fs';
import { resetDeprecationWarnings } from '../../packages/errors/src';
import { createSuspenseContext } from '../../packages/suspense/src';
import { enterTransition, leaveTransition, animateGroup } from '../../packages/transition/src';
import { processFetchWithCache } from '../../packages/data/src';

const ROOT = process.cwd();

/** یک فضای کاری موقت با package مشخص می‌سازد. */
function fixture(pkg, file, code) {
  const dir = mkdtempSync(join(tmpdir(), 'pos-config-'));
  mkdirSync(join(dir, 'packages', pkg, 'src'), { recursive: true });
  writeFileSync(join(dir, 'packages', pkg, 'src', file), code, 'utf8');
  return dir;
}

describe('#55 — positional config is frozen and new APIs take options objects', () => {
  beforeEach(() => {
    resetDeprecationWarnings();
    vi.restoreAllMocks();
  });

  it('the audit gate is green on the current workspace and every allowlist row is exercised', () => {
    const report = auditPositionalConfig({ root: ROOT });
    expect(report.signatures.length).toBeGreaterThan(500);
    expect(report.violations).toEqual([]);
    expect(report.stale).toEqual([]);
    expect(report.allowlisted).toBeGreaterThan(50);
  });

  it('the allowlist is category-based and every category documents why it is exempt', () => {
    const entries = loadAllowlist(ROOT);
    const categories = new Set(entries.map((e) => e.category));
    expect(categories.size).toBeGreaterThanOrEqual(5);
    for (const entry of entries) {
      expect(entry.category).toBeTruthy();
      expect(entry.reason.length).toBeGreaterThan(20);
    }
    const raw = JSON.parse(
      readFileSync(join(ROOT, 'scripts/positional-config.allowlist.json'), 'utf8'),
    );
    for (const category of raw.categories) {
      expect(typeof category.reason).toBe('string');
      expect(category.reason.length).toBeGreaterThan(20);
      expect(category.entries.length).toBeGreaterThan(0);
    }
  });

  it('flags a brand-new positional-config signature (gate goes red without an allowlist row)', () => {
    const dir = fixture(
      'demo',
      'api.ts',
      [
        'export function createWidget(host: string, width: number, height: number, label: string): void {',
        '  void host; void width; void height; void label;',
        '}',
        '',
        'export function createThing(host: string, options?: { width?: number }): void {',
        '  void host; void options;',
        '}',
        '',
        '/** @deprecated legacy */',
        'export function oldThing(a: string, b: number, c: number): void {',
        '  void a; void b; void c;',
        '}',
      ].join('\n'),
    );
    try {
      const report = auditPositionalConfig({ root: dir, allowlist: [] });
      expect(report.violations.map((v) => v.name)).toEqual(['createWidget']);
      expect(report.signatures.find((s) => s.name === 'createThing').optionsParam).toBe(true);
      expect(report.signatures.find((s) => s.name === 'oldThing').deprecated).toBe(true);
      expect(report.signatures.find((s) => s.name === 'oldThing').flagged).toBe(false);

      // با یک ردیف allowlist مستدل، همان امضا معاف می‌شود.
      const excused = auditPositionalConfig({
        root: dir,
        allowlist: [
          { pkg: 'demo', name: 'createWidget', category: 'fixture', reason: 'تست: عمداً مجاز' },
        ],
      });
      expect(excused.violations).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects a malformed allowlist (shape + reason are enforced)', () => {
    const dir = fixture('demo', 'api.ts', 'export const x = 1;\n');
    try {
      writeFileSync(
        join(dir, 'scripts-allowlist.json'),
        '{"categories":[{"id":"x","reason":"کوتاه"}]}\n',
      );
      expect(() => loadAllowlist(dir, 'scripts-allowlist.json')).toThrow(/reason/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('shares one options-parameter predicate with the ESLint rule `zenith/options-object`', () => {
    expect(isOptionsParamText('options?: FetchOptions')).toBe(true);
    expect(isOptionsParamText('opts: { ttl?: number }')).toBe(true);
    expect(isOptionsParamText('config: StoreConfig')).toBe(true);
    expect(isOptionsParamText('host: string')).toBe(false);
    expect(isOptionsParamText('count: number')).toBe(false);

    const eslintConfig = readFileSync(join(ROOT, 'eslint.config.mjs'), 'utf8');
    expect(eslintConfig).toMatch(/isOptionsParamText/);
    expect(eslintConfig).toMatch(/from '\.\/scripts\/positional-config-audit\.mjs'/);
    expect(eslintConfig).toContain('zenith/options-object');
    expect(eslintConfig).toMatch(/plugins: \{ zenith: zenithPlugin \}/);
  });

  it('ships `check:positional-config` as a CI script', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.scripts['check:positional-config']).toBe('node scripts/positional-config-audit.mjs');
  });

  it('createSuspenseContext accepts an options object and deprecates the positional form (ZEN-DEPR-065)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = createSuspenseContext({ timeoutMs: 0, onSettle: () => {} });
    expect(ctx.signal.get().loading).toBe(false);
    expect(warnSpy).not.toHaveBeenCalled();

    createSuspenseContext(10);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ZEN-DEPR-065'));
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('createSuspenseContext({ timeoutMs'),
    );
  });

  it('processFetchWithCache accepts { ttl } and deprecates the positional ttl (ZEN-DEPR-066)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // شبکه در تست زده نمی‌شود: پاسخ ساختگی JSON.
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: true, json: async () => ({ ok: 1 }) });
    const fresh = await processFetchWithCache('https://example.test/fresh-a', { ttl: 1 });
    expect(fresh).toEqual({ ok: 1 });
    expect(warnSpy).not.toHaveBeenCalled();

    const positional = await processFetchWithCache('https://example.test/fresh-b', 1);
    expect(positional).toEqual({ ok: 1 });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ZEN-DEPR-066'));
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('processFetchWithCache(url, { ttl })'),
    );
    fetchSpy.mockRestore();
  });

  it('enterTransition/leaveTransition accept { name, duration } and keep the positional overload working', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const enter = enterTransition(el, { name: 'fade', duration: 10 });
    enter();
    const leave = leaveTransition(el, { name: 'fade', duration: 10 });
    leave();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ZEN-DEPR-002'));

    resetDeprecationWarnings();
    warnSpy.mockClear();
    enterTransition(el, 'fade', 10)();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ZEN-DEPR-002'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('enterTransition(el, { name'));
    resetDeprecationWarnings();
    warnSpy.mockClear();
    leaveTransition(el, 'fade', 10)();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ZEN-DEPR-003'));
    el.remove();
  });

  it('animateGroup accepts { direction, name, duration, staggerDelay } with the same result', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const els = [document.createElement('div'), document.createElement('div')];
    els.forEach((el) => document.body.appendChild(el));

    await expect(
      animateGroup(els, { direction: 'enter', name: 'fade', duration: 10, staggerDelay: 1 }),
    ).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ZEN-DEPR-004'));

    resetDeprecationWarnings();
    warnSpy.mockClear();
    await expect(animateGroup(els, 'enter', 'fade', 10, 1)).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ZEN-DEPR-004'));
    els.forEach((el) => el.remove());
  });

  it('documented in API-CONVENTIONS: positional config is deprecated, the options object is the target', () => {
    const doc = readFileSync(join(ROOT, 'docs/API-CONVENTIONS.md'), 'utf8');
    expect(doc).toContain('ورودی تنظیمات همیشه در **یک** آرگومان `options` است');
    expect(doc).toContain('scripts/positional-config-audit.mjs');
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
