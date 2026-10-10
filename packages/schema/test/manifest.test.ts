// #142 —DirectiveMeta / zenith.meta.json / html.customData.json (SPEC §۲.۲ و §۰.۳).
import { describe, it, expect } from 'vitest';
import {
  defineDirectiveMeta,
  getRegisteredDirectiveMetas,
  toDirectiveManifest,
  toHtmlCustomData,
} from '../src/index';
import { RESERVED_ERROR_CODES } from '@zenith/errors';

function errOf(fn: () => unknown): any {
  try {
    fn();
  } catch (e) {
    return e;
  }
  throw new Error('expected throw');
}

describe('defineDirectiveMeta', () => {
  it('kebab-case name + description ⇒ ثبت و فریز عمیق', () => {
    const meta = defineDirectiveMeta({
      name: 'zen-chart',
      description: 'نمودار اختیاری',
      values: ['bar', 'line'],
      docs: 'https://zenith.dev/docs/chart',
    });
    expect(meta.name).toBe('zen-chart');
    expect(Object.isFrozen(meta)).toBe(true);
    expect(Object.isFrozen(meta.values)).toBe(true);
    expect(getRegisteredDirectiveMetas().some((m) => m.name === 'zen-chart')).toBe(true);
  });

  it('نام غیر kebab یا description خالی ⇒ ZEN-1001 از کاتالوگ (#171)', () => {
    const e1 = errOf(() => defineDirectiveMeta({ name: 'ZenChart', description: 'x' }));
    expect(e1.code).toBe('ZEN-1001');
    expect(RESERVED_ERROR_CODES['ZEN-1001']).toBeDefined();
    const e2 = errOf(() => defineDirectiveMeta({ name: 'zen-x', description: '' }));
    expect(e2.code).toBe('ZEN-1001');
    expect(e2.message).toMatch(/^\[ZEN-1001]/);
  });

  it('خروجی از ورودی بیرونی copy است (mutate کردن input رجیستری را خراب نمی‌کند)', () => {
    const input: any = { name: 'zen-copy', description: 'اولیه' };
    const frozen = defineDirectiveMeta(input);
    input.description = 'دستکاری‌شده';
    expect(frozen.description).toBe('اولیه');
  });
});

describe('toDirectiveManifest / toHtmlCustomData', () => {
  it('manifest ساختار ثابت ZenithMetaDoc دارد و مرتب‌شده است', () => {
    const input = [
      { name: 'zen-b', description: 'B' },
      { name: 'zen-a', description: 'A' },
    ];
    const doc = toDirectiveManifest(input);
    expect(doc.$schema).toBe('./zenith.meta.schema.json');
    expect(doc.version).toBe(1);
    expect(doc.generatedFrom).toBe('defineDirectiveMeta registry');
    expect(doc.directives.map((d) => d.name)).toEqual(['zen-a', 'zen-b']);
    // کپی عمیق: mutate خروجی روی source اثر ندارد (snapshot پایدار در CI).
    (doc.directives[0] as { description: string }).description = 'X';
    expect(input[1]!.description).toBe('A');
  });

  it('نام تکراری در ورودی manifest ⇒ throw', () => {
    expect(() =>
      toDirectiveManifest([
        { name: 'zen-dup', description: 'A' },
        { name: 'zen-dup', description: 'B' },
      ]),
    ).toThrow(/ZEN-1001/);
  });

  it('html.customData فرمت VS Code را می‌سازد (markdown + references)', () => {
    const data = toHtmlCustomData([
      {
        name: 'zen-tabs',
        description: 'تب‌ها',
        syntax: '<div zen-tabs>',
        values: ['lazy'],
        attributes: ['zen-tabs-lazy'],
        docs: 'https://zenith.dev/docs/tabs',
      },
    ]);
    expect(data.version).toBe(1);
    expect(data.tags).toEqual([]);
    const attr = data.globalAttributes['zen-tabs']!;
    expect(attr.description.kind).toBe('markdown');
    expect(attr.description.value).toContain('zen-tabs');
    expect(attr.description.value).toContain('lazy');
    expect(attr.references?.[0]?.url).toBe('https://zenith.dev/docs/tabs');
  });
});

// یادداشت snapshot: اسنپ‌شات واقعی zenith.meta.json در CI با
// scripts/gen-zenith-meta.mjs ساخته و در docs/meta/zenith.meta.json ذخیره
// می‌شود (گیت: test/meta-snapshot.test.mjs در scripts/test).
