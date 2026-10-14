// packages/i18n/test/engine.test.ts — موتور #150 (createI18n/ICU/fallback/plugin).
//
// پوشش معیارهای پذیرش spec §۳.۱:
//   - plural فارسی/انگلیسی/عربی (+کلید دقیق =0)
//   - fallback زنجیره‌ای (locale → language → fallbackLocale)
//   - لینک‌های @: (با guard چرخه)
//   - نکتهٔ spec: تغییر locale واکنشی (dir/locale سیگنال‌ها) بدون rerender کامل
//   - گزینه‌ها: پیش‌فرض + مقدار نامعتبر (#52 → ZEN-1100 از schema)
//   - dispose idempotent (۶.۲)

import { describe, it, expect, beforeEach } from 'vitest';
import { effect } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import {
  createI18n,
  useI18n,
  i18nPlugin,
  __resetActiveI18n,
  I18N_DEFAULTS,
  resolveI18nOptions,
} from '../src/index';
import type { Messages } from '../src/index';

const en: Messages = {
  hello: 'Hello {name}',
  items: '{count, plural, =0 {No items} one {# item} other {# items}}',
  who: '{gender, select, male {He} female {She} other {They}}',
  price: 'Total: {p, number, currency}',
  save: 'Save',
  link: '@:save',
};

const fa: Messages = {
  hello: 'سلام {name}',
  items: '{count, plural, =0 {هیچ} one {# مورد} other {# مورد}}',
  who: '{gender, select, male {او} female {او} other {آنها}}',
  nested: { deep: 'عمیق {v}' },
  save: 'ذخیره',
};

const ar: Messages = {
  items:
    '{count, plural, =0 {لا شيء} one {# عنصر} two {# عنصرين} few {# عناصر} many {# عنصرًا} other {# عنصر}}',
};

beforeEach(() => {
  __resetActiveI18n(null);
  if (typeof localStorage !== 'undefined') localStorage.clear();
});

describe('#150 core engine — templates & ICU', () => {
  it('t() interpolates params with escapeParams on by default', () => {
    const i18n = createI18n({ locale: 'en', messages: { en } });
    expect(i18n.t('hello', { name: 'World' })).toBe('Hello World');
    expect(i18n.t('hello', { name: '<b>x</b>' })).toBe('Hello &lt;b&gt;x&lt;/b&gt;');
    i18n.dispose();
  });

  it('plural fa/en/ar with exact =N keys and cardinals', () => {
    const i18n = createI18n({
      locale: 'en',
      messages: { en, fa, ar },
      loadMessages: async () => ar,
    });
    expect(i18n.t('items', { count: 0 })).toBe('No items');
    expect(i18n.t('items', { count: 1 })).toBe('1 item');
    expect(i18n.t('items', { count: 5 })).toBe('5 items');
    expect(i18n.t('items', { count: 0 }, { locale: 'fa' })).toBe('هیچ');
    expect(i18n.t('items', { count: 7 }, { locale: 'fa' })).toContain('مورد');
    // numberingSystem تابع تنظیمات instance است (نه per-call) — نمونهٔ fa:
    const i18nFa = createI18n({
      locale: 'fa',
      messages: { fa },
      syncDocument: false,
      persist: false,
    });
    expect(i18nFa.t('items', { count: 7 })).toContain('۷');
    i18nFa.dispose();
    const arOut = i18n.t('items', { count: 2 }, { locale: 'ar' });
    expect(arOut).toContain('عنصرين');
    expect(i18n.t('items', { count: 3 }, { locale: 'ar' })).toContain('عناصر');
    expect(i18n.t('items', { count: 1 }, { locale: 'ar' })).toContain('عنصر');
    i18n.dispose();
  });

  it('select works with string keys and other-fallback', () => {
    const i18n = createI18n({ locale: 'en', messages: { en } });
    expect(i18n.t('who', { gender: 'male' })).toBe('He');
    expect(i18n.t('who', { gender: 'female' })).toBe('She');
    expect(i18n.t('who', { gender: 'nb' })).toBe('They');
    i18n.dispose();
  });

  it('number style "currency" uses per-instance defaultCurrency', () => {
    // instance ..en ⇒ defaultCurrency USD + numberingSystem latn:
    const i18nEn = createI18n({
      locale: 'en-US',
      messages: { en },
      syncDocument: false,
      persist: false,
    });
    expect(i18nEn.t('price', { p: 250000 })).toBe('Total: $250,000.00');
    i18nEn.dispose();
    // instance fa-IR ⇒ IRR + arabext (استنباط resolveI18nOptions):
    const i18nFa = createI18n({
      locale: 'fa-IR',
      messages: { en },
      syncDocument: false,
      persist: false,
    });
    const out = i18nFa.t('price', { p: 250000 });
    expect(out.includes('IRR') || out.includes('ریال')).toBe(true);
    expect(out).toContain('۲۵۰');
    i18nFa.dispose();
  });

  it('@: links resolve and cycle-safe (no infinite loop)', () => {
    const i18n = createI18n({
      locale: 'en',
      messages: { en, loop: { a: '@:loop.b', b: '@:loop.a' } },
    });
    expect(i18n.t('link')).toBe('Save');
    // چرخه: نباید hang کند؛ نتیجهٔ undefined ⇒ مسیر missing
    expect(i18n.tm('loop.a')).toBeUndefined();
    i18n.dispose();
  });

  it('ICU invalid template ⇒ ZEN-1312 warn + tolerant output', () => {
    const i18n = createI18n({
      locale: 'en',
      messages: { en: { bad: '{x, plural, one {inner {other}}' } },
      warnOnMissing: false,
    });
    expect(typeof i18n.t('bad', { x: 1 })).toBe('string');
    i18n.dispose();
  });
});

describe('#150 core engine — fallback & availability', () => {
  it('fallback chain: exact locale → language → fallbackLocale', () => {
    const i18n = createI18n({
      locale: 'fa-AF',
      fallbackLocale: ['en'],
      messages: { en, fa: { hello: 'سلام' } },
    });
    // nested فقط در فا؟ نه — در en؛ یعنی fallback به en می‌رود سپس خط missing→key
    expect(i18n.t('nested.deep', { v: 1 })).toBe('nested.deep');
    expect(i18n.t('hello', { name: '' })).toBe('سلام');
    expect(i18n.te('save')).toBe(true); // en
    i18n.dispose();
  });

  it('missing strategies: key / empty / throw(ZEN-1311)', () => {
    const i18n = createI18n({
      locale: 'en',
      messages: { en },
      missing: 'key',
      warnOnMissing: false,
    });
    expect(i18n.t('nope.key')).toBe('nope.key');
    expect(i18n.t('nope.key', {}, { default: 'FB' })).toBe('FB');
    i18n.dispose();
    const empty = createI18n({ locale: 'en', messages: { en }, missing: 'empty' });
    expect(empty.t('nope')).toBe('');
    empty.dispose();
    const thrower = createI18n({
      locale: 'en',
      messages: { en },
      missing: 'throw',
      warnOnMissing: false,
    });
    let code = '';
    try {
      thrower.t('nope');
    } catch (e) {
      code = String(e);
    }
    expect(code).toContain('ZEN-1311');
    thrower.dispose();
  });

  it('addMessages returns cleanup which restores the previous state', () => {
    const i18n = createI18n({ locale: 'en', messages: { en } });
    expect(i18n.te('new.key')).toBe(false);
    const cleanup = i18n.addMessages('en', { new: { key: 'added' } });
    expect(i18n.t('new.key')).toBe('added');
    cleanup();
    expect(i18n.te('new.key')).toBe(false);
    i18n.dispose();
  });
});

describe('#150 core engine — reactivity & intl formatters', () => {
  it('locale/dir signal-driven; setLocale switches dir reactively (rtl for fa)', async () => {
    const i18n = createI18n({
      locale: 'en',
      messages: { en, fa },
      persist: false,
      syncDocument: false,
    });
    expect(i18n.dir.get()).toBe('ltr');
    const dirs: string[] = [];
    const stop = effect(() => {
      dirs.push(i18n.dir.get());
    });
    await i18n.setLocale('fa');
    flushSync();
    expect(i18n.locale.get()).toBe('fa');
    expect(i18n.dir.get()).toBe('rtl');
    expect(dirs).toContain('rtl');
    stop();
    i18n.dispose();
  });

  it('setLocale lazy-loads via loadMessages; failure → ZEN-1314', async () => {
    const i18n = createI18n({
      locale: 'en',
      messages: { en },
      persist: false,
      syncDocument: false,
      loadMessages: async (l) =>
        l === 'de' ? { hello: 'Hallo {name}' } : Promise.reject(new Error('404')),
    });
    await i18n.setLocale('de');
    expect(i18n.t('hello', { name: 'A' })).toBe('Hallo A');
    let code = '';
    await i18n.setLocale('es').catch((e) => {
      code = String(e);
    });
    expect(code).toContain('ZEN-1314');
    expect(i18n.locale.get()).toBe('de');
    i18n.dispose();
  });

  it('ZEN-1313 when setLocale without loader on unknown locale', async () => {
    const i18n = createI18n({
      locale: 'en',
      messages: { en },
      syncDocument: false,
      persist: false,
    });
    let code = '';
    await i18n.setLocale('fr').catch((e) => {
      code = String(e);
    });
    expect(code).toContain('ZEN-1313');
    i18n.dispose();
  });

  it('n/d/rt/list use Intl with numberingSystem (fa ⇒ arabext)', () => {
    const i18n = createI18n({
      locale: 'fa',
      messages: { fa },
      syncDocument: false,
      persist: false,
    });
    expect(i18n.n(1234)).toContain('۱');
    expect(i18n.d(new Date(Date.UTC(2024, 2, 20))).length).toBeGreaterThan(3);
    expect(i18n.rt(-3, 'day').length).toBeGreaterThan(2);
    expect(i18n.list(['الف', 'ب']).length).toBeGreaterThan(2);
    i18n.dispose();
  });
});

describe('#150 options (#52 & §۶.۲) & dispose', () => {
  it('DEFAULTS frozen and resolveI18nOptions infers locale-dependent defaults', () => {
    expect(Object.isFrozen(I18N_DEFAULTS)).toBe(true);
    const faResolved = resolveI18nOptions({ locale: 'fa-IR' });
    expect(faResolved.calendar).toBe('persian');
    expect(faResolved.numberingSystem).toBe('arabext');
    expect(faResolved.defaultCurrency).toBe('IRR');
    const enResolved = resolveI18nOptions({ locale: 'en-US' });
    expect(enResolved.calendar).toBe('gregory');
    expect(enResolved.numberingSystem).toBe('latn');
  });

  it('invalid option ⇒ schema validation error at boundary', () => {
    expect(() =>
      createI18n({ locale: 'en', missing: 'nope' as unknown as undefined, syncDocument: false }),
    ).toThrow();
  });

  it('dispose idempotent & useI18n throws when no instance (ZEN-1313)', () => {
    const i18n = createI18n({
      locale: 'en',
      messages: { en },
      syncDocument: false,
      persist: false,
    });
    expect(useI18n()).toBe(i18n);
    i18n.dispose();
    i18n.dispose();
    expect(() => useI18n()).toThrow(/ZEN-1313/);
  });

  it('i18nPlugin installs and provides instance; cleanup disposes', () => {
    const provided = new Map<string, unknown>();
    const app = {
      provide: (k: string | symbol, v: unknown) => void provided.set(String(k), v),
    };
    const plugin = i18nPlugin({
      locale: 'en',
      messages: { en },
      syncDocument: false,
      persist: false,
    });
    const cleanup = plugin.install(app);
    expect(plugin.name).toBe('zenith:i18n');
    const i18n = provided.get('zenith:i18n');
    expect(i18n).toBeDefined();
    cleanup?.();
    expect(() => useI18n()).toThrow();
  });
});
