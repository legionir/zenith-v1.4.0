// packages/i18n/src/directives.ts
//
// #150 موج ۲ — attributeهای `zen-t*` (برای موتور createApp/SPEC §۲.۸).
//
// قانون لایه (#48/#146): `@zenith/i18n` اجازهٔ وابستگی به @zenith/runtime /
// runtime-core را ندارد. بنابراین تعریف دایرکتیوها به‌صورت «duck-typed» در
// این فایل است (نه import تایپ از runtime-core) و پلاگین (`i18nPlugin`) آن‌ها را
// در زمان install با `app.directive(def)` ثبت می‌کند. تطبیق ساختاری کافی است:
// این تعریف‌ها subset‌ی از DirectiveDefinition موتور هستند.
//
// دایرکتیوها همگی واکنشی‌اند: Effect از @zenith/state می‌خواند و `i18n.t(...)`
// داخل آن locale را track می‌کند؛ با setLocale بدون rerender کامل، فقط متن‌ها
// به‌روزرسانی می‌شوند (پذیرش #150).
//
// گزینه‌های همراه (attribute):
//   zen-t="key"
//     zen-t-params='{"name":"علی"}' (JSON؛ نه expression — سند ببینید)
//     zen-t-count="3"            (عدد؛ برای plural)
//     zen-t-default="متن جایگزین" (رشتهٔ خام)
//   zen-t-html="key"             (حتماً sanitize؛ بدون sanitizeHtml همه‌چیز escape می‌شود)
//   zen-t-attr="title:key; aria-label:key2"  (با zen-t-params سازگار)
//   zen-locale                   (⇒ lang المان؛ واکنشی)
//   zen-dir="ltr|rtl|auto"       (auto ⇒ dir جاری i18n؛ واکنشی)
//
// SSR: تگ `<html lang dir>` و payload `__ZENITH_I18N__` در ssr/@render.ts (#174)
// ساخته می‌شود؛ رندر سروریِ درون‌تگ zen-t* در این engine فعلاً hook ندارد و
// server بدون تغییر markup را می‌گذراند — پس client-hydration mismatch نمی‌سازد.

import { effect } from '@zenith/state';
import { logger } from '@zenith/logger';
import { parseJsonAttr } from '@zenith/schema/attr';
import type { I18n, I18nParams, TCallOptions } from './types';

// ─────────────────────────────────────────────────────────────
// تایپ‌های ساختاری (subset ـ DirectiveDefinition/BindContext ـ runtime-core).
// ─────────────────────────────────────────────────────────────

export interface I18nDirectiveBindContext {
  /** مقدار خام attribute */
  readonly expr: string;
  /** نام کامل attribute (مثلاً `zen-t`) */
  readonly attrName: string;
}

export interface I18nDirectiveDefinition {
  name: string;
  priority?: number;
  structural?: boolean;
  prefixMatch?: boolean;
  bind(el: HTMLElement, ctx: I18nDirectiveBindContext): (() => void) | void;
}

/** ورودی ساختراهای دایرکتیو — sanitizeHtml اختیاری برای zen-t-html. */
export interface I18nDirectiveOptions {
  /**
   * sanitizer سفارشی برای zen-t-html (مثلاً sanitizeHTML از @zenith/security).
   * پیش‌فرض: escape کامل — بدون سانتیزر هیچ HTML‌ای رندر نمی‌شود (امن‌به‌پیش‌فرض).
   */
  sanitizeHtml?: (html: string) => string;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Escape کامل محتوای HTML (پیش‌فرض امن برای zen-t-html). */
export function escapeHtmlStrict(html: string): string {
  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** خواندن attribute همراه؛ نال اگر غایب. */
function companionAttr(el: HTMLElement, name: string): string | null {
  const v = el.getAttribute(name);
  return v === null ? null : v;
}

/**
 * #120 — خواندن tolerant JSON از attribute با گزارش خطای ZEN به logger.
 * پیاده‌سازی مشترک در `@zenith/schema` است (`parseJsonAttr`)؛ این wrapper فقط
 * سیاست لاگ i18n را تزریق می‌کند (هیچ `JSON.parse` مستقیمی در این فایل نمی‌ماند).
 */
function readJsonAttr<T>(el: HTMLElement, attrName: string, fallback: T): T {
  return parseJsonAttr<T>(el, attrName, {
    fallback,
    onError: (err) => {
      logger.warn(`[zenith:i18n] ${attrName}: ${err.message} — از مقدار پیش‌فرض استفاده شد.`);
    },
  });
}

/**
 * ورودی‌های مشترک zen-t را از attributeها می‌خواند:
 *   - zen-t-params: JSON آبجکت پیش‌فرض {}
 *   - zen-t-count:  JSON عدد|رشتهٔ عددی ⇒ params.count و TCallOptions.count
 *   - zen-t-default: رشته ⇒ TCallOptions.default
 */
function readTranslationInputs(el: HTMLElement): {
  key: string;
  params: () => I18nParams;
  callOpts: () => TCallOptions;
} {
  const key = companionAttr(el, 'zen-t') ?? companionAttr(el, 'zen-t-html') ?? '';
  const countAttr = companionAttr(el, 'zen-t-count');
  const defaultAttr = companionAttr(el, 'zen-t-default');

  const baseParams = readJsonAttr<I18nParams>(el, 'zen-t-params', {});
  let countParsed: number | undefined;
  if (countAttr !== null && countAttr.trim() !== '') {
    const num = Number(countAttr);
    if (Number.isFinite(num)) {
      countParsed = num;
    } else {
      logger.warn(`[zenith:i18n] zen-t-count: «${countAttr}» عدد نیست؛ نادیده گرفته شد.`);
    }
  }

  return {
    key,
    params: () => ({ ...baseParams, ...(countParsed !== undefined ? { count: countParsed } : {}) }),
    callOpts: () => ({
      ...(defaultAttr !== null ? { default: defaultAttr } : {}),
      ...(countParsed !== undefined ? { count: countParsed } : {}),
    }),
  };
}

// ─────────────────────────────────────────────────────────────
// سازندهٔ دایرکتیوها
// ─────────────────────────────────────────────────────────────

/**
 * ساخت تعریف‌های دایرکتیو zen-t* برای یک نمونهٔ I18n.
 * پلاگین (install) آن‌ها را با `app.directive(def)` ثبت و cleanupها را نگه می‌دارد.
 */
export function createI18nDirectives(
  i18n: I18n,
  options: I18nDirectiveOptions = {},
): I18nDirectiveDefinition[] {
  const sanitize = options.sanitizeHtml ?? escapeHtmlStrict;

  const zenT: I18nDirectiveDefinition = {
    name: 'zen-t',
    priority: 600,
    bind(el) {
      const { key, params, callOpts } = readTranslationInputs(el);
      if (!key) {
        logger.warn('[zenith:i18n] zen-t بدون کلید (مقدار attribute خالی است).');
        return;
      }
      const stop = effect(() => {
        try {
          el.textContent = i18n.t(key, params(), callOpts());
        } catch (err) {
          logger.warn(`[zenith:i18n] zen-t: خطا در ترجمهٔ «${key}»: ${(err as Error).message}`);
          el.textContent = '';
        }
      });
      return () => stop();
    },
  };

  const zenTHtml: I18nDirectiveDefinition = {
    name: 'zen-t-html',
    priority: 600,
    bind(el) {
      const { key, params, callOpts } = readTranslationInputs(el);
      if (!key) {
        logger.warn('[zenith:i18n] zen-t-html بدون کلید (مقدار attribute خالی است).');
        return;
      }
      const stop = effect(() => {
        try {
          // هر رندر مجدد sanitize می‌شود (پذیرش spec: zen-t-html با sanitize).
          el.innerHTML = sanitize(i18n.t(key, params(), callOpts()));
        } catch (err) {
          logger.warn(
            `[zenith:i18n] zen-t-html: خطا در ترجمهٔ «${key}»: ${(err as Error).message}`,
          );
          el.textContent = '';
        }
      });
      return () => stop();
    },
  };

  const zenTAttr: I18nDirectiveDefinition = {
    name: 'zen-t-attr',
    priority: 600,
    bind(el) {
      const spec = companionAttr(el, 'zen-t-attr') ?? '';
      const params = readJsonAttr<I18nParams>(el, 'zen-t-params', {});
      const pairs = spec
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const colon = part.indexOf(':');
          if (colon === -1) return null;
          const attr = part.slice(0, colon).trim();
          const key = part.slice(colon + 1).trim();
          return attr && key ? ([attr, key] as const) : null;
        })
        .filter((p): p is readonly [string, string] => p !== null);
      if (pairs.length === 0) {
        logger.warn(
          '[zenith:i18n] zen-t-attr: قالب نامعتبر؛ مثال درست: "title:app.title; aria-label:app.aria".',
        );
        return;
      }
      const stop = effect(() => {
        for (const [attr, key] of pairs) {
          try {
            el.setAttribute(attr, i18n.t(key, params));
          } catch (err) {
            logger.warn(`[zenith:i18n] zen-t-attr: «${key}»: ${(err as Error).message}`);
          }
        }
      });
      return () => stop();
    },
  };

  const zenLocale: I18nDirectiveDefinition = {
    name: 'zen-locale',
    priority: 200,
    bind(el) {
      // zen-locale بدون مقدار هم معتبر است (marker).
      const stop = effect(() => {
        el.setAttribute('lang', i18n.locale.get());
      });
      return () => stop();
    },
  };

  const zenDir: I18nDirectiveDefinition = {
    name: 'zen-dir',
    priority: 200,
    bind(el, ctx) {
      const mode = (ctx.expr ?? '').trim();
      const stop = effect(() => {
        const value =
          mode === 'auto' || mode === ''
            ? i18n.dir.get()
            : mode === 'ltr' || mode === 'rtl'
              ? mode
              : i18n.dir.get();
        el.setAttribute('dir', value);
      });
      return () => stop();
    },
  };

  return [zenT, zenTHtml, zenTAttr, zenLocale, zenDir];
}

// ─────────────────────────────────────────────────────────────
// expression globals — برای `$t/$te/$n/$d/$locale/$dir` (#150 §expression‌ها)
// کلیدهای state که `app.addState()` در mount به context تزریق می‌کند؛
// proxy context با پیشوند `$` حل می‌کند: مثلاً state['t'] ⇒ `$t(...)`.
// ─────────────────────────────────────────────────────────────

/**
 * ساخت رکورد state گلوبالی که در expressionها به `$t`/`$te`/... مپ می‌شود.
 * trend مقداردهی: t/te/n/d/rt/list = تابع بسته بر i18n؛ locale/dir = signal-box
 * (با برند ZENITH_READABLE، پس createEvalContext آن‌ها را .get() unwrap می‌کند
 * و reactive می‌شوند).
 */
export function i18nStateGlobals(i18n: I18n): Record<string, unknown> {
  return {
    t: (key: string, params?: I18nParams, o?: TCallOptions) => i18n.t(key, params, o),
    te: (key: string, locale?: string) => i18n.te(key, locale),
    n: (value: number, fmt?: string | Intl.NumberFormatOptions) => i18n.n(value, fmt),
    d: (value: number | Date, fmt?: string | Intl.DateTimeFormatOptions) => i18n.d(value, fmt),
    rt: (value: number, unit: Intl.RelativeTimeFormatUnit) => i18n.rt(value, unit),
    list: (items: readonly string[], o?: Intl.ListFormatOptions) => i18n.list(items, o),
    locale: i18n.locale,
    dir: i18n.dir,
  };
}
