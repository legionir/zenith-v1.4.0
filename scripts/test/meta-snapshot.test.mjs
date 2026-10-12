// #142 — گیت CI: اسنپ‌شات zenith.meta.json تازه است و ساختار ثابت دارد
// (SPEC §۲.۲ «ابزار تولید zenith.meta.json در CI با snapshot»).
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';

const META = 'docs/meta/zenith.meta.json';
const CUSTOM = 'docs/meta/html.customData.json';

describe('zenith.meta.json snapshot gate (#142)', () => {
  it('snapshot files exist', () => {
    expect(existsSync(META), META).toBe(true);
    expect(existsSync(CUSTOM), CUSTOM).toBe(true);
  });

  it('regenerating from the seed produces identical bytes (--check is green)', () => {
    expect(() =>
      execFileSync(process.execPath, ['scripts/gen-zenith-meta.mjs', '--check'], {
        stdio: 'pipe',
      }),
    ).not.toThrow();
  });

  it('manifest structure is the fixed ZenithMetaDoc shape, sorted by name', () => {
    const doc = JSON.parse(readFileSync(META, 'utf8'));
    expect(doc.$schema).toBe('./zenith.meta.schema.json');
    expect(doc.version).toBe(1);
    expect(doc.generatedFrom).toBe('defineDirectiveMeta registry');
    expect(Array.isArray(doc.directives)).toBe(true);
    const names = doc.directives.map((d) => d.name);
    expect(names).toEqual([...names].sort());
    for (const d of doc.directives) {
      expect(d.name).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
      expect(typeof d.description).toBe('string');
      expect(d.description.length).toBeGreaterThan(0);
    }
  });

  it('html.customData is valid VS Code HTML data format', () => {
    const data = JSON.parse(readFileSync(CUSTOM, 'utf8'));
    expect(data.version).toBe(1);
    expect(Array.isArray(data.tags)).toBe(true);
    const meta = JSON.parse(readFileSync(META, 'utf8'));
    for (const d of meta.directives) {
      const attr = data.globalAttributes[d.name];
      expect(attr, `customData entry for ${d.name}`).toBeTruthy();
      expect(attr.description.kind).toBe('markdown');
      expect(attr.description.value).toContain(d.description);
    }
  });
});
