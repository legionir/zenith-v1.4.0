// #117 — گیت قرارداد API-CONVENTIONS:
//  1. سند وجود دارد، هر بخش قاعده یک مثال کد دارد و از docs/README لینک شده.
//  2. جدول «قاعده ↔ lint» هر قاعدهٔ سند را به کلید #159 یا گیت scripts نگاشت می‌کند.
//  3. جدول نگاشت نام، همهٔ ناهمگونی‌های فعلیِ اسکن‌شده از src را فهرست می‌کند.
//  4. یکی‌سازی‌های رفتاری همین #117: schedule alias منسوخ (ZEN-DEPR-025)،
//     installStatefulComponents alias منسوخ (ZEN-DEPR-026) — رجیستری errors.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const DOC = readFileSync(join(ROOT, 'docs/API-CONVENTIONS.md'), 'utf8');

/** برش یک بخش سطح-۲ (`## N.`) با پیکرهٔ خط — از «## ۵.» تا «## ۶.»، مثلاً. */
function section(major) {
  const lines = DOC.split('\n');
  const start = lines.findIndex((l) => l.startsWith(`## ${major}.`));
  const end = lines.findIndex((l, i) => i > start && /^## [۰-۹]+\./.test(l));
  return lines.slice(start, end === -1 ? undefined : end).join('\n');
}

function listSources(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) listSources(p, out);
    else if (
      e.endsWith('.ts') &&
      !e.endsWith('.d.ts') &&
      !p.includes('node_modules') &&
      !p.includes('/dist/')
    )
      out.push(p);
  }
  return out;
}

describe('#117 API-CONVENTIONS document', () => {
  it('covers all required rule areas', () => {
    for (const heading of [
      'createX',
      'registerX',
      'defineX',
      'bindX',
      'install(app)',
      'onX',
      'beforeX',
      'useX',
      'XOptions',
      'MaybeReactive',
      'toValue',
    ]) {
      expect(DOC, `missing rule mention: ${heading}`).toContain(heading);
    }
  });

  it('every numbered rule section has a code example', () => {
    // بخش‌های قاعدهٔ ۱.۱..۱.۶ (### زیر ۱.) باید بلوک کد ``` داشته باشند
    const sections = DOC.split(/^### /m).slice(1);
    const ruleSections = sections.filter((s) => /^۱\.[۰-۹]+/.test(s));
    expect(ruleSections.length).toBe(6);
    for (const s of ruleSections) {
      expect(s, `section "${s.split('\n')[0]}" has no code example`).toContain('```');
    }
    // قواعد ۲ و ۳ هم مثال دارند
    const reactive = DOC.split(/^## /m).find((s) => s.startsWith('۲.'));
    expect(reactive).toBeDefined();
    expect(reactive).toContain('```ts');
  });

  it('links from docs/README.md', () => {
    const readme = readFileSync(join(ROOT, 'docs/README.md'), 'utf8');
    expect(readme).toContain('API-CONVENTIONS.md');
  });

  it('has a rule↔lint mapping table covering every rule (lint keys or gates)', () => {
    const lintTable = section('۵');
    // هر ردیف جدول یا کلید @zenith/... (eslint-plugin #159) یا گیت scripts/ دارد
    const rows = lintTable
      .split('\n')
      .filter((l) => l.startsWith('|') && !l.includes('---') && !l.includes('قاعدهٔ سند'));
    expect(rows.length).toBeGreaterThanOrEqual(10);
    for (const r of rows) {
      expect(r).toMatch(/@zenith\/[a-z-]+|scripts\//);
    }
    // گیت‌های واقعیِ امروز باید در ستون سوم نام‌برده شوند
    expect(lintTable).toContain('cleanup-hygiene');
    expect(lintTable).toContain('error-hygiene');
  });

  it('name-mapping table lists the current nonconforming exports (scanned from src)', () => {
    // نمونه‌های الزامی جدول نگاشت (§۶)
    for (const name of [
      'schedule(',
      'installStatefulComponents()',
      'initAuth',
      'setupSW',
      'loadPreloadedState',
      'clearActions',
      'cleanupRouter',
      'processIf',
      'alert',
      'confirm',
      'registerSignal',
      'clearCache',
    ]) {
      expect(DOC, `mapping table missing: ${name}`).toContain(name);
    }
    // صحت اسکن: هر نامِ nonconformingِ واقعی در src باید در §۶ آمده باشد
    const files = listSources(join(ROOT, 'packages'));
    const setupVerb = /^(init|setup|load)[A-Z]/;
    const names = new Set();
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      for (const m of text.matchAll(
        /^export (?:async )?function ((?:init|setup|load|cleanup)[A-Z][A-Za-z]*|alert|confirm)\b/gm,
      )) {
        names.add(m[1]);
      }
    }
    const section6 = section('۶');
    for (const n of names) {
      expect(section6, `mapping §6 missing scanned export: ${n}`).toContain(n);
    }
    expect([...names].some((n) => setupVerb.test(n))).toBe(true); // صحت خودِ اسکن
  });
});

describe('#117 behavioral unifications', () => {
  it('DEPRECATION_CODES registers ZEN-DEPR-025 (schedule→scheduleEffect) and 026 (stateful install)', async () => {
    const { DEPRECATION_CODES } = await import('@zenith/errors');
    expect(DEPRECATION_CODES['ZEN-DEPR-025']).toMatchObject({
      api: 'schedule() (@zenith/scheduler)',
      replacement: 'scheduleEffect()',
      removedIn: '2.0.0',
    });
    expect(DEPRECATION_CODES['ZEN-DEPR-026']).toMatchObject({
      api: 'installStatefulComponents()',
      replacement: 'Zen.use(ZenithStatefulPlugin)',
      removedIn: '2.0.0',
    });
  });

  it('scheduler exports schedule as a @deprecated wrapper over scheduleEffect', () => {
    const src = readFileSync(join(ROOT, 'packages/scheduler/src/scheduler.ts'), 'utf8');
    expect(src).toMatch(/@deprecated[^\n]*scheduleEffect/);
    expect(src).toContain("deprecate('ZEN-DEPR-025', 'schedule()', 'scheduleEffect()')");
  });

  it('stateful has a single implementation path (plugin canonical, alias delegates)', () => {
    const src = readFileSync(join(ROOT, 'packages/stateful/src/index.ts'), 'utf8');
    expect(src).toContain(
      "deprecate('ZEN-DEPR-026', 'installStatefulComponents()', 'Zen.use(ZenithStatefulPlugin)')",
    );
    // یک نقطهٔ ثبت مشترک؛ دیگر حلقهٔ تکراری در install وجود ندارد
    const registerPoints = src.match(/registerCustomDirective\(directive\.name/g) || [];
    expect(registerPoints).toHaveLength(1);
  });
});
