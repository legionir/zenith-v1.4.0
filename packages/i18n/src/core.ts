// packages/i18n/src/core.ts — createI18n (#150, SPEC NEW-PKG §۳.۱).
//
// چندزبانگی واقعی: locale واکنشی (Signal)، dir محاسبه‌ای، پیام‌ها با fallback
// زنجیره‌ای، لینک‌های @:، قالب عدد/تاریخ/نسبی/فهرست با Intl، بارگذاری تنبل
// (setLocale → Promise)، sync <html lang/dir>، persist در storage (اختیاری).

import { signal, computed, ZENITH_READABLE } from '@zenith/state';
import type { Cleanup } from '@zenith/shared';
import { createCache } from '@zenith/cache';
import { logger } from '@zenith/logger';
import { createReservedError, deprecate } from '@zenith/errors';
import { formatTemplate, icuInvalid, type FormatHooks } from './icu';
import { createI18nDirectives, i18nStateGlobals } from './directives';
import {
  i18nOptionsSchema,
  resolveI18nOptions,
  languageOf,
  type ResolvedI18nOptions,
} from './options';
import type {
  I18n,
  I18nOptions,
  I18nParams,
  Messages,
  TCallOptions,
  DetectContext,
  SsrI18nData,
} from './types';

/** escape HTML در پارامترهای رشته‌ای (پیش‌فرض فعال). */
const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

/** mid-path حل کلید `a.b.c` در درخت Messages. */
function lookupPath(messages: Messages, path: string): string | Messages | undefined {
  const parts = path.split('.');
  let cur: string | Messages | undefined = messages;
  for (const part of parts) {
    if (cur === undefined || typeof cur === 'string') return undefined;
    if (typeof cur !== 'object' || cur === null) return undefined;
    cur = (cur as Messages)[part];
  }
  return cur;
}

function mergeMessages(base: Messages, extra: Messages): Messages {
  const out: Record<string, string | Messages> = { ...base };
  for (const [k, v] of Object.entries(extra)) {
    const prev = out[k];
    out[k] =
      typeof v === 'string' || typeof prev !== 'object' || prev === null
        ? v
        : (mergeMessages(prev as Messages, v as Messages) as Messages);
  }
  return out as Messages;
}

/** OK flag: آیا locale در نقشهٔ پیام‌ها حضور (یا fallback عمومی‌اش) هست؟ */
function hasLocale(map: Map<string, Messages>, locale: string): boolean {
  return map.has(locale) || map.has(languageOf(locale));
}

// ── Instance registry (useI18n) ──

let activeI18n: I18n | null = null;
const i18nByApp = new WeakMap<object, I18n>();

/**
 * دسترسی آخر به instance فعلی — از context برنامه (app.use(i18nPlugin))
 * یا آخرین createI18n. هدف: در directive/expression بتوان instance یافت.
 */
export function useI18n(): I18n {
  if (!activeI18n) {
    throw createReservedError('ZEN-1313', { details: { locale: '(none — no instance)' } });
  }
  return activeI18n;
}

/** صرفاً برای plugin ثبت خودکار — app و instance را گره می‌زند. */
export function bindI18nToApp(app: object, i18n: I18n): void {
  i18nByApp.set(app, i18n);
}

/** @internal برای تست‌ها: خنثی‌سازی ثبت سطح-ماژول. */
export function __resetActiveI18n(next: I18n | null): void {
  activeI18n = next;
}

// ── createI18n ──

/**
 * ساخت i18n. نکته‌ها:
 * - schema اعتبارسنجی اول (+ مقادیر نامعتبر ⇒ ZEN-1100-ish از schema) سپس
 *   resolve i18nOptions.
 * - preload: detect + messages.first? locale شروع همان opts.locale است، مگر
 *   از طریق detectLocale بعداً تعویض شود (در plugin or user call).
 * - timeZone: ثابت از options (SSR: 'UTC').
 */
export function createI18n(input: I18nOptions = {}): I18n {
  // #52: مرز اعتبارسنجی با schema (ورودی نامعتبر ⇒ ZEN-1100 category validation)
  i18nOptionsSchema.resolve(input);
  const opts: ResolvedI18nOptions = resolveI18nOptions(input);

  // ── وضعیت واکنشی ──
  // localeSig/availableSig: سیگنال‌های داخلی (reactive tracking واقعی در
  // effectها). برای API عمومی، wrapper با .subscribe(fn) — هماهنگ با قرارداد
  // تست wave5-batch1 — ساخته می‌شود تا تغییر locale/dir «فقط هنگام تغییر» به
  // subscriberها اطلاع برسد (بدون اینکه effect در ساخت، initial push بدهد).
  const localeSig = signal<string>(opts.locale);
  const availableSig = signal<readonly string[]>(localesFromMessages(opts.messages, opts.locale));
  const messagesByLocale = new Map<string, Messages>(
    Object.entries(opts.messages) as Array<[string, Messages]>,
  );
  for (const loc of localesFromMessages({}, opts.locale)) {
    if (!hasLocale(messagesByLocale, loc)) {
      // locale آغازین بدون پیام هم در فهرست قرار می‌گیرد تا te() معنادار بماند.
      messagesByLocale.set(loc, {});
    }
  }

  // ── کش‌ها ──
  const intlCache = createCache<string>({ maxSize: 128 });
  const templateCache = createCache<string>({ maxSize: 512 });

  // ── fallback chain ──
  const fallbackChain: readonly string[] = Array.isArray(opts.fallbackLocale)
    ? opts.fallbackLocale
    : [opts.fallbackLocale];

  function effectiveChain(localeCode: string): string[] {
    const chain = [localeCode, languageOf(localeCode), ...fallbackChain];
    for (const fb of fallbackChain) chain.push(languageOf(fb));
    return [...new Set(chain.filter((x) => x && x.length > 0))] as string[];
  }

  // ── dir ──
  // dirFor: محاسبهٔ اجباری و همگام برای fireLocaleChange (computed در state
  // batch می‌شود و بلافاصله پس از set مقدار قدیمی می‌دهد). dirSig برای
  // effect-tracking عمومی (zen-t در wave2) استفاده می‌شود.
  function dirFor(localeCode: string): 'rtl' | 'ltr' {
    const lang = languageOf(localeCode);
    return opts.rtlLocales.some((r) => r === lang || lang.startsWith(`${r}-`)) ? 'rtl' : 'ltr';
  }
  const dirSig = computed((): 'rtl' | 'ltr' => dirFor(localeSig.get()));

  // ── همگام حین setLocale با اسناد ──
  function syncDocument(localeCode: string, direction: 'rtl' | 'ltr'): void {
    if (!opts.syncDocument) return;
    if (typeof document === 'undefined') return;
    document.documentElement.lang = localeCode;
    document.documentElement.dir = direction;
  }

  // ── persist ──
  function persistLocale(localeCode: string): void {
    if (opts.persist === false) return;
    if (typeof localStorage === 'undefined') return; // SSR/Node
    try {
      (localStorage as Storage).setItem(opts.persist, localeCode);
    } catch {
      /* storage ممکن است غیرفعال باشد (private mode) — non-fatal */
    }
  }

  // ── صندوق‌های subscription (change-only semantics) ──
  const localeSubs = new Set<(v: string) => void>();
  const dirSubs = new Set<(v: 'rtl' | 'ltr') => void>();
  const availableSubs = new Set<(v: readonly string[]) => void>();
  let lastDir = dirFor(opts.locale);
  // موج ۲ (§۶.۲): dispose idempotent؛ متدهای Mutable پس از dispose warn+no-op.
  let disposed = false;
  function warnIfDisposed(api: string): boolean {
    if (disposed) logger.warn(`[zenith:i18n] ${api} بعد از dispose() نادیده گرفته شد (no-op).`);
    return disposed;
  }
  function fireLocaleChange(): void {
    const v = localeSig.get();
    for (const fn of [...localeSubs]) fn(v);
    const d = dirFor(v);
    if (!Object.is(d, lastDir)) {
      lastDir = d;
      for (const fn of [...dirSubs]) fn(d);
    }
  }
  let lastAvailable = availableSig.get();
  function fireAvailableChange(): void {
    const v = availableSig.get();
    if (v === lastAvailable) return;
    lastAvailable = v;
    for (const fn of [...availableSubs]) fn(v);
  }

  /** مکان‌یاب پیام در fallback چزنز (با @: link). */
  function resolveTemplate(key: string, localeCode: string, seen: Set<string>): string | undefined {
    if (seen.has(`${localeCode}:${key}`)) return undefined; // چرخهٔ لینک‌ها
    seen.add(`${localeCode}:${key}`);
    for (const lc of effectiveChain(localeCode)) {
      const msgs = messagesByLocale.get(lc);
      if (!msgs) continue;
      const raw = lookupPath(msgs, key);
      if (raw === undefined) continue;
      if (typeof raw !== 'string') return undefined; // شاخهٔ میانی — مسیر باید برگ برسد
      if (raw.startsWith('@:')) {
        const linkedKey = raw.slice(2).trim();
        if (!linkedKey) return undefined;
        return resolveTemplate(linkedKey, localeCode, seen);
      }
      return raw;
    }
    return undefined;
  }

  function locateMessage(key: string, localeCode: string): string | undefined {
    return resolveTemplate(key, localeCode, new Set());
  }

  // ── formatters با Intl و کش ──
  function numberFormatter(
    localeCode: string,
    fmt?: string | Intl.NumberFormatOptions,
  ): Intl.NumberFormat {
    const cacheKey = `n:${localeCode}:${typeof fmt === 'string' ? fmt : JSON.stringify(fmt ?? null)}`;
    const hit = intlCache.get(cacheKey);
    if (hit !== undefined) return hit as unknown as Intl.NumberFormat;
    const options =
      typeof fmt === 'string'
        ? (opts.numberFormats[fmt] ??
          (fmt === 'currency' ? { style: 'currency', currency: opts.defaultCurrency } : {}))
        : (fmt ?? {});
    const full: Intl.NumberFormatOptions = {
      ...options,
      ...(options.numberingSystem === undefined ? { numberingSystem: opts.numberingSystem } : {}),
    };
    intlCache.set(cacheKey, new Intl.NumberFormat(localeCode, full) as unknown as string);
    return intlCache.get(cacheKey) as unknown as Intl.NumberFormat;
  }

  function dateFormatter(
    localeCode: string,
    fmt?: string | Intl.DateTimeFormatOptions,
  ): Intl.DateTimeFormat {
    const cacheKey = `d:${localeCode}:${typeof fmt === 'string' ? fmt : JSON.stringify(fmt ?? null)}`;
    const hit = intlCache.get(cacheKey);
    if (hit !== undefined) return hit as unknown as Intl.DateTimeFormat;
    const options =
      typeof fmt === 'string'
        ? (opts.dateFormats[fmt] ??
          (fmt === 'short'
            ? { dateStyle: 'short' }
            : fmt === 'long'
              ? { dateStyle: 'long' }
              : fmt === 'full'
                ? { dateStyle: 'full' }
                : fmt === 'medium'
                  ? { dateStyle: 'medium' }
                  : {}))
        : (fmt ?? {});
    const full: Intl.DateTimeFormatOptions = {
      ...options,
      ...(options.timeZone === undefined ? { timeZone: opts.timeZone } : {}),
      ...(options.numberingSystem === undefined ? { numberingSystem: opts.numberingSystem } : {}),
      ...(options.calendar === undefined ? { calendar: opts.calendar } : {}),
    };
    intlCache.set(cacheKey, new Intl.DateTimeFormat(localeCode, full) as unknown as string);
    return intlCache.get(cacheKey) as unknown as Intl.DateTimeFormat;
  }

  function relativeTimeFormatter(localeCode: string): Intl.RelativeTimeFormat {
    const cacheKey = `rt:${localeCode}`;
    const hit = intlCache.get(cacheKey);
    if (hit !== undefined) return hit as unknown as Intl.RelativeTimeFormat;
    intlCache.set(
      cacheKey,
      new Intl.RelativeTimeFormat(localeCode, {
        numeric: 'auto',
        numberingSystem: opts.numberingSystem,
      } as Intl.RelativeTimeFormatOptions) as unknown as string,
    );
    return intlCache.get(cacheKey) as unknown as Intl.RelativeTimeFormat;
  }

  function listFormatter(localeCode: string, o?: Intl.ListFormatOptions): Intl.ListFormat {
    const cacheKey = `l:${localeCode}:${JSON.stringify(o ?? null)}`;
    const hit = intlCache.get(cacheKey);
    if (hit !== undefined) return hit as unknown as Intl.ListFormat;
    intlCache.set(
      cacheKey,
      new Intl.ListFormat(
        localeCode,
        o ?? { style: 'long', type: 'conjunction' },
      ) as unknown as string,
    );
    return intlCache.get(cacheKey) as unknown as Intl.ListFormat;
  }

  // ── hook برای icu ──
  function makeHooks(localeCode: string): FormatHooks {
    const escape = (v: unknown): string =>
      opts.escapeParams && typeof v === 'string' ? escapeHtml(v) : String(v);
    return {
      n(value: number, fmt?: string): string {
        return numberFormatter(localeCode, fmt).format(value);
      },
      d(value: Date | number, fmt?: string): string {
        return dateFormatter(localeCode, fmt).format(
          value instanceof Date ? value : new Date(value),
        );
      },
      plural(count: number): string {
        const cacheKey = `pr:${localeCode}`;
        let pr = intlCache.get(cacheKey) as unknown as Intl.PluralRules | undefined;
        if (pr === undefined) {
          pr = new Intl.PluralRules(localeCode);
          intlCache.set(cacheKey, pr as unknown as string);
        }
        return pr.select(count);
      },
      formatCount(count: number): string {
        // # در plural با numberingSystem فعلی (arabext برای fa)
        const cacheKey = `nc:${localeCode}`;
        let nf = intlCache.get(cacheKey) as unknown as Intl.NumberFormat | undefined;
        if (nf === undefined) {
          nf = new Intl.NumberFormat(localeCode, { numberingSystem: opts.numberingSystem });
          intlCache.set(cacheKey, nf as unknown as string);
        }
        return nf.format(count);
      },
      formatParam(value: unknown): string {
        return escape(value);
      },
      onInvalid(message: string, err?: unknown): string {
        const detail = icuInvalid(message, err as Record<string, unknown> | undefined);
        logger.warn(
          `[Zenith i18n] ${detail.code}: ICU format problem at locale=${localeCode}: ${message}`,
        );
        return '';
      },
    };
  }

  // ── missing strategy ──
  function missingFor(key: string, localeCode: string, o?: TCallOptions): string {
    if (opts.missing === 'throw') {
      throw createReservedError('ZEN-1311', {
        details: { key, locale: localeCode },
      });
    }
    if (opts.missing === 'empty') return '';
    if (opts.warnOnMissing) {
      logger.warn(
        `[Zenith i18n] ZEN-1311 missing key "${key}" (locale=${localeCode}, fallback to key)`,
      );
    }
    // 'key'
    if (o?.default !== undefined) return o.default;
    return key;
  }

  // ── localeها — sync ──
  function updateAvailable(): void {
    const fromMap = [...messagesByLocale.keys()];
    const chain = effectiveChain(localeSig.get());
    for (const c of chain) if (!fromMap.includes(c)) fromMap.push(c);
    availableSig.set(fromMap.sort());
    fireAvailableChange();
  }

  // ── API عمومی ──
  // #150-wave2: برند ZENITH_READABLE روی هر سه جعبه تا createEvalContext
  // (runtime-core) هنگام تزریق در state — مثل addState(i18nStateGlobals(i18n)) —
  // آن‌ها را به‌صورت واکنشی unwrap کند (`$locale`/`$dir` بدون `.get()`).
  const i18n: I18n = {
    locale: {
      [ZENITH_READABLE]: true as const,
      get: () => localeSig.get(),
      peek: () => localeSig.peek(),
      set: (v: string) => {
        localeSig.set(v);
        fireLocaleChange();
      },
      subscribe: (fn: (v: string) => void) => {
        localeSubs.add(fn);
        return () => {
          localeSubs.delete(fn);
        };
      },
    },
    dir: {
      [ZENITH_READABLE]: true as const,
      get: () => dirSig.get(),
      peek: () => dirSig.get(),
      subscribe: (fn: (v: 'rtl' | 'ltr') => void) => {
        dirSubs.add(fn);
        return () => {
          dirSubs.delete(fn);
        };
      },
    },
    availableLocales: {
      [ZENITH_READABLE]: true as const,
      get: () => availableSig.get(),
      peek: () => availableSig.get(),
      subscribe: (fn: (v: readonly string[]) => void) => {
        availableSubs.add(fn);
        return () => {
          availableSubs.delete(fn);
        };
      },
    },

    t(key: string, params: I18nParams = {}, o?: TCallOptions): string {
      const localeCode = o?.locale ?? localeSig.get();
      let template = locateMessage(key, localeCode);
      if (template === undefined) return missingFor(key, localeCode, o);
      const cacheKey = `tpl:${localeCode}:${key}:${template.length}`;
      if (template.startsWith('@:')) {
        template = templateCache.get(cacheKey) ?? template;
      }
      const hooks = makeHooks(localeCode);
      return formatTemplate(template, params, hooks);
    },

    te(key: string, localeOrOptions?: string | { locale?: string }): boolean {
      if (typeof localeOrOptions === 'string') {
        deprecate('ZEN-DEPR-069', 'te(key, locale)', 'te(key, { locale })');
      }
      const localeOverride = typeof localeOrOptions === 'string' ? localeOrOptions : localeOrOptions?.locale;
      return locateMessage(key, localeOverride ?? localeSig.get()) !== undefined;
    },

    tm(key: string, localeOrOptions?: string | { locale?: string }): string | undefined {
      if (typeof localeOrOptions === 'string') {
        deprecate('ZEN-DEPR-069', 'tm(key, locale)', 'tm(key, { locale })');
      }
      const localeOverride = typeof localeOrOptions === 'string' ? localeOrOptions : localeOrOptions?.locale;
      return locateMessage(key, localeOverride ?? localeSig.get());
    },

    n(value: number, fmt?: string | Intl.NumberFormatOptions): string {
      return numberFormatter(localeSig.get(), fmt).format(value);
    },

    d(date: Date | number, fmt?: string | Intl.DateTimeFormatOptions): string {
      return dateFormatter(localeSig.get(), fmt).format(
        date instanceof Date ? date : new Date(date),
      );
    },

    rt(value: number, unit: Intl.RelativeTimeFormatUnit): string {
      return relativeTimeFormatter(localeSig.get()).format(value, unit);
    },

    list(items: readonly string[], o?: Intl.ListFormatOptions): string {
      return listFormatter(localeSig.get(), o).format([...items]);
    },

    async setLocale(nextLocale: string): Promise<void> {
      if (warnIfDisposed('setLocale')) return;
      const current = localeSig.get();
      if (nextLocale === current) return;
      if (hasLocale(messagesByLocale, nextLocale)) {
        localeSig.set(nextLocale);
        fireLocaleChange();
        syncDocument(nextLocale, lastDir);
        persistLocale(nextLocale);
        updateAvailable();
        return;
      }
      if (opts.loadMessages) {
        try {
          const loaded = await opts.loadMessages(nextLocale);
          messagesByLocale.set(nextLocale, loaded);
        } catch (err) {
          throw createReservedError('ZEN-1314', {
            details: { locale: nextLocale },
            cause: err,
          });
        }
        localeSig.set(nextLocale);
        fireLocaleChange();
        syncDocument(nextLocale, lastDir);
        persistLocale(nextLocale);
        updateAvailable();
        return;
      }
      // بدون loader و locale ناشناخته ⇒ ZEN-1313
      throw createReservedError('ZEN-1313', { details: { locale: nextLocale } });
    },

    addMessages(newLocale: string, msgs: Messages, o?: { merge?: boolean }): Cleanup {
      if (warnIfDisposed('addMessages')) return () => {};
      const merge = o?.merge !== false;
      const prev = messagesByLocale.get(newLocale);
      if (merge && prev) {
        messagesByLocale.set(newLocale, mergeMessages(prev, msgs));
      } else {
        messagesByLocale.set(newLocale, msgs);
      }
      updateAvailable();
      return () => {
        // بازگشت به وضع قبلی (merge→prev، غیر merge→حذف)
        if (prev) messagesByLocale.set(newLocale, prev);
        else messagesByLocale.delete(newLocale);
        updateAvailable();
      };
    },

    detectLocale(ctx?: DetectContext): string | undefined {
      return detectFromSources(opts, ctx);
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      activeI18n = activeI18n === i18n ? null : activeI18n;
      messagesByLocale.clear();
      intlCache.clear?.();
      templateCache.clear?.();
      localeSubs.clear();
      dirSubs.clear();
      availableSubs.clear();
    },
  };

  activeI18n = i18n;
  syncDocument(opts.locale, lastDir);
  return i18n;
}

function localesFromMessages(messages: Record<string, Messages>, fallback: string): string[] {
  const list = Object.keys(messages ?? {});
  if (!list.includes(fallback)) list.push(fallback);
  return list;
}

// ── detect ──

/**
 * تشخیص locale از منابع به ترتیب opts.detect؛ ctx برای SSR (query/cookies).
 * در مرورگر به URL/document/localStorage/path تکیه می‌کند.
 */
export function detectFromSources(
  opts: Pick<ResolvedI18nOptions, 'detect' | 'detectKey' | 'persist'>,
  ctx?: DetectContext,
): string | undefined {
  for (const src of opts.detect) {
    const hit =
      src === 'query'
        ? queryLocale(opts, ctx)
        : src === 'cookie'
          ? cookieLocale(opts, ctx)
          : src === 'storage'
            ? storageLocale(opts)
            : src === 'navigator'
              ? navigatorLocale()
              : src === 'path'
                ? pathLocale(ctx)
                : undefined;
    if (hit) return hit;
  }
  return undefined;
}

function queryLocale(
  opts: Pick<ResolvedI18nOptions, 'detectKey'>,
  ctx?: DetectContext,
): string | undefined {
  if (ctx?.query?.[opts.detectKey]) return ctx.query[opts.detectKey];
  if (typeof location !== 'undefined' && location.search) {
    const params = new URLSearchParams(location.search);
    const hit = params.get(opts.detectKey);
    if (hit) return hit;
  }
  if (typeof document !== 'undefined' && document.URL.includes(`?`)) {
    try {
      return new URL(document.URL).searchParams.get(opts.detectKey) ?? undefined;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

function cookieLocale(
  opts: Pick<ResolvedI18nOptions, 'detectKey'>,
  ctx?: DetectContext,
): string | undefined {
  if (ctx?.cookies?.[opts.detectKey]) return ctx.cookies[opts.detectKey];
  if (typeof document !== 'undefined' && document.cookie) {
    for (const part of document.cookie.split(';')) {
      const [k, ...rest] = part.trim().split('=');
      if (k === opts.detectKey) return decodeURIComponent(rest.join('='));
    }
  }
  if (ctx?.headers) {
    const cookieHeader = ctx.headers['cookie'] ?? ctx.headers['Cookie'];
    if (cookieHeader) {
      for (const part of String(cookieHeader).split(';')) {
        const [k, ...rest] = part.trim().split('=');
        if (k === opts.detectKey) return decodeURIComponent(rest.join('='));
      }
    }
  }
  return undefined;
}

function storageLocale(opts: Pick<ResolvedI18nOptions, 'persist'>): string | undefined {
  if (opts.persist === false) return undefined;
  if (typeof localStorage === 'undefined') return undefined;
  try {
    return (localStorage as Storage).getItem(opts.persist) ?? undefined;
  } catch {
    return undefined;
  }
}

function navigatorLocale(): string | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return navigator.languages?.[0] ?? navigator.language ?? undefined;
}

function pathLocale(ctx?: DetectContext): string | undefined {
  if (ctx?.pathname) {
    const first = ctx.pathname.split('/').filter(Boolean)[0];
    if (first && /^[a-z]{2}(-[A-Za-z]{2,})?$/.test(first)) return first;
  }
  if (typeof location !== 'undefined' && location.pathname) {
    const first = location.pathname.split('/').filter(Boolean)[0];
    if (first && /^[a-z]{2}(-[A-Za-z]{2,})?$/.test(first)) return first;
  }
  return undefined;
}

// ── plugin ──

/**
 * پلاگین `app.use(i18nPlugin(opts))` — instance را با key عمومی provid می‌کند.
 * در directive های بعدی (§۳.۱ wave 2) از همین key خوانده می‌شود.
 */
// ─────────────────────────────────────────────────────────────
// SSR payload (`window.__ZENITH_I18N__` #174) — مصرف در سمت client.
// ─────────────────────────────────────────────────────────────

/**
 * دادهٔ سریال‌شدهٔ SSR چندزبانگی را از `window.__ZENITH_I18N__` می‌خواند.
 * بدون تغییر در window باقی می‌ماند تا چنداپ روی یک صفحه هم‌زمان کار کنند؛
 * برای پاک‌سازی «بعد از مصرف» به‌صورت اختیاری `clearSsrI18nData` را صدا بزنید
 * (مانند الگوی hydrate.ts؛ پلاگین به‌صورت پیش‌فرض پس از مصرف پاک می‌کند).
 * در محیط غیر-Browser یا وقتی payload نامعتبر باشد null برمی‌گرداند (SSR-safe).
 */
export function readSsrI18nData(): SsrI18nData | null {
  if (typeof window === 'undefined') return null;
  const raw = (window as unknown as Record<string, unknown>)['__ZENITH_I18N__'];
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const data = raw as SsrI18nData;
  const localeValid = typeof data.locale === 'string' && data.locale.length >= 2;
  const dirValid = data.dir === undefined || data.dir === 'rtl' || data.dir === 'ltr';
  const messagesValid =
    data.messages === undefined ||
    (typeof data.messages === 'object' && data.messages !== null && !Array.isArray(data.messages));
  return localeValid || dirValid || messagesValid ? data : null;
}

/** پاک‌سازی `window.__ZENITH_I18N__` پس از مصرف (جلوگیری از رشد حافظه/replay). */
export function clearSsrI18nData(): void {
  if (typeof window === 'undefined') return;
  delete (window as unknown as Record<string, unknown>)['__ZENITH_I18N__'];
}

/**
 * پلاگین رسمی `app.use(i18nPlugin(options))`.
 *
 * در install این کارها انجام می‌شود (موج ۲):
 *   1. `createI18n(opts)` و `provide('zenith:i18n', i18n)`؛
 *   2. اگر `window.__ZENITH_I18N__` (#174) موجود باشد: پیام‌های SSR در موتور
 *      seed می‌شوند و locale همان‌جا با مسیر sync (بدون fetch) تنظیم می‌شود تا
 *      hydration mismatch و درخواست اضافه نسازد؛ سپس payload پاک می‌شود.
 *   3. دایرکتیوهای zen-t* با `app.directive(...)` ثبت می‌شوند (اگر موتور
 *      registry داشته باشد؛ duck-typed — بدون import لایهٔ runtime).
 *   4. expression گلوبال‌ها با `app.addState({...})` تزریق می‌شوند
 *      (`$t/$te/$n/$d/$rt/$list/$locale/$dir`).
 *   5. detectLocale خودکار (اگر payload SSR نخورد باشد).
 *
 * Cleanup: دایرکتیوها unregister و موتور dispose می‌شود.
 */
export function i18nPlugin(opts: I18nOptions = {}) {
  return {
    name: 'zenith:i18n',
    install(app: {
      provide?: (key: string | symbol, value: unknown) => void;
      directive?: (def: unknown) => (() => void) | void;
      addState?: (values: Record<string, unknown>, options?: { overwrite?: boolean }) => unknown;
      dispose?: () => void;
    }) {
      const i18n = createI18n(opts);
      app?.provide?.('zenith:i18n', i18n);
      bindI18nToApp(app as object, i18n);

      const cleanups: (() => void)[] = [];

      // ۲) SSR seeding — قبل از هر detect/loader تا fetch صورت نگیرد.
      const ssrData = readSsrI18nData();
      if (ssrData) {
        if (ssrData.messages) {
          for (const [loc, msgs] of Object.entries(ssrData.messages)) {
            i18n.addMessages(loc, msgs);
          }
        }
        // locale سرور = منبع حقیقت در UX؛ با مسیر sync ثبت می‌شود (پیام‌ها حالا
        // از messages موجودند ⇒ loadMessages صدا زده نمی‌شود).
        if (ssrData.locale) {
          void i18n.setLocale(ssrData.locale).catch(() => {});
        }
        clearSsrI18nData();
      }

      // ۳) دایرکتیوها — zen-t/zen-t-html/zen-t-attr/zen-locale/zen-dir.
      if (typeof app?.directive === 'function') {
        for (const def of createI18nDirectives(i18n, { sanitizeHtml: opts.sanitizeHtml })) {
          const c = app.directive(def);
          if (typeof c === 'function') cleanups.push(c);
        }
      }

      // ۴) expression globals — در mount به context تزریق می‌شوند.
      if (typeof app?.addState === 'function') {
        app.addState(i18nStateGlobals(i18n));
      }

      // ۵) auto-detect — فقط اگر SSR locale نداده بود (ترتیب: SSR ⇒ detect).
      if (!ssrData?.locale) {
        const detect = i18n.detectLocale();
        if (detect) void i18n.setLocale(detect).catch(() => {});
      }

      return () => {
        for (const c of cleanups) {
          try {
            c();
          } catch {
            // cleanup نباید خطا پرتاب کند
          }
        }
        i18n.dispose();
      };
    },
  };
}
