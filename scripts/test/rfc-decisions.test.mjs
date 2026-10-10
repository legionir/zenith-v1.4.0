import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

// #175 (RFC): هر ۸ تصمیم باز NEW-PACKAGES-SPEC باید ADR داشته باشد
// (تصمیم، دلیل، پیامد) + لینک issueهای تحت‌تأثیر، و SPEC با تصمیم‌ها همگام شود.
// AGENT-INSTRUCTIONS §4: ADRها در docs/decisions/ (DEC-NNN) — بدنۀ issue «docs/adr/»
// نوشته بود؛ دستورالعمل (مقدم بر issue، §1 بندر امنیتی) و رویهٔ موجود مخزن مقدم است.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEC = join(ROOT, 'docs', 'decisions');
const spec = readFileSync(join(ROOT, 'NEW-PACKAGES-SPEC.md'), 'utf8');

const RFC_DECISIONS = [
  'DEC-020-error-code-space.md',
  'DEC-021-readable-shared.md',
  'DEC-022-adapter-edge-deferred.md',
  'DEC-023-ui-component-order.md',
  'DEC-024-charts-icons-community.md',
  'DEC-025-runtime-core-split-parity.md',
  'DEC-026-lockstep-150-removal-200.md',
  'DEC-027-node-floor-dual-format.md',
];

describe('RFC #175 — eight open design decisions are closed with ADRs', () => {
  it.each(RFC_DECISIONS)('%s exists with MADR sections and issue links', (file) => {
    const path = join(DEC, file);
    expect(existsSync(path), path).toBe(true);
    const text = readFileSync(path, 'utf8');
    expect(text).toMatch(/^# DEC-\d+: /m);
    expect(text).toMatch(/پذیرفته/);
    expect(text).toMatch(/## زمینه/);
    expect(text).toMatch(/## گزینه‌ها/);
    expect(text).toMatch(/## تصمیم و دلیل/);
    expect(text).toMatch(/## پیامدها/);
    // «لینک به issueهای تحت‌تأثیر» — حداقل یک شمارهٔ issue
    expect(text).toMatch(/#\d{2,3}/);
  });

  it('DEC numbering has no duplicates and reaches 027', () => {
    const files = readdirSync(DEC).filter((f) => f.startsWith('DEC-'));
    const nums = files.map((f) => parseInt(f.slice(4, 7), 10));
    expect(new Set(nums).size).toBe(nums.length);
    expect(Math.max(...nums)).toBe(27);
  });

  it('error-space ADR formalizes ZEN-DEPR registry (DEC-019) and hands ranges to #171', () => {
    const text = readFileSync(join(DEC, 'DEC-020-error-code-space.md'), 'utf8');
    expect(text).toContain('ZEN-DEPR');
    expect(text).toContain('DEC-019');
    expect(text).toContain('#171');
  });

  it('Readable ADR builds on the Symbol.for brand (DEC-009) and mandates a type test', () => {
    const text = readFileSync(join(DEC, 'DEC-021-readable-shared.md'), 'utf8');
    expect(text).toContain('DEC-009');
    expect(text).toContain('Symbol.for');
    expect(text).toMatch(/expectTypeOf|tsd|تست نوع/);
    expect(text).toContain('#141');
  });

  it('adapter-edge ADR applies the spec contingency: deferred until ssr DOM-impl abstraction (#92)', () => {
    const text = readFileSync(join(DEC, 'DEC-022-adapter-edge-deferred.md'), 'utf8');
    expect(text).toContain('linkedom');
    expect(text).toMatch(/AsyncLocalStorage|async_hooks/);
    expect(text).toMatch(/به تعویق|موکول|deferred/);
    expect(text).toContain('#92');
  });

  it('runtime-core ADR requires parity tests before any move (#148)', () => {
    const text = readFileSync(join(DEC, 'DEC-025-runtime-core-split-parity.md'), 'utf8');
    expect(text).toMatch(/parity|برابری/);
    expect(text).toContain('#148');
  });

  it('node-floor ADR keeps engines ≥18.19 from #14/DEC-007 (no bump to 20)', () => {
    const text = readFileSync(join(DEC, 'DEC-027-node-floor-dual-format.md'), 'utf8');
    expect(text).toContain('18.19');
    expect(text).toContain('DEC-007');
    expect(text).toMatch(/ESM/);
  });

  it('NEW-PACKAGES-SPEC risk list is annotated with the closing ADR for each item', () => {
    const start = spec.indexOf('### ریسک‌ها و تصمیم‌های باز');
    expect(start).toBeGreaterThan(-1);
    let body = spec.slice(start);
    const rest = body.indexOf('\n---');
    if (rest >= 0) body = body.slice(0, rest);
    for (const n of ['020', '021', '022', '023', '024', '025', '026', '027']) {
      expect(body, `DEC-${n} referenced in spec risk list`).toContain(`DEC-${n}`);
    }
  });

  it('ARCHITECTURE.md links the new RFC ADRs', () => {
    const arch = readFileSync(join(ROOT, 'ARCHITECTURE.md'), 'utf8');
    expect(arch).toMatch(/DEC-02[0-7]/);
  });
});
