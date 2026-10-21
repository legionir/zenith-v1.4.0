// packages/ssr/src/render-head.ts
//
// رندر head و useHead — استخراج مکانیکی از render.ts، بدون تغییر رفتار (#40).

import { renderManagedHead, type HeadManager } from '@zenith/head';
import { domAls } from './dom-context';
import { ZenithError, deprecate } from '@zenith/errors';
import type { SSRHeadInput, SSRI18nInput } from './render-serialize';


/**
 * #152 / #174: تبدیل ساختار `SSRHeadInput` به تگ‌های امن `<head>` با پشتیبانی از JSON-LD.
 */
/** گزینه‌های `renderSSRHead(head?, options?)` (#55: آبجکت گزینه‌ها). @public */
export interface RenderSSRHeadOptions {
  /** ورودی چندزبانگی برای `lang`/`dir` تگ `<html>`. */
  i18n?: SSRI18nInput;
  /** locale جایگزین وقتی `i18n` داده نشده است. */
  fallbackLocale?: string;
}

/** @public */
export function renderSSRHead(
  head?: SSRHeadInput | string | HeadManager,
  options?: RenderSSRHeadOptions,
): { headTags: string; htmlAttrs: string; bodyAttrs: string };
/** @public @deprecated #55 — امضای positional؛ از `renderSSRHead(head, { i18n, fallbackLocale })` استفاده کنید (ZEN-DEPR-107، حذف در ۲.۰). */
export function renderSSRHead(
  head?: SSRHeadInput | string | HeadManager,
  i18n?: SSRI18nInput,
  fallbackLocale?: string,
): { headTags: string; htmlAttrs: string; bodyAttrs: string };
export function renderSSRHead(
  head?: SSRHeadInput | string | HeadManager,
  i18nOrOptions?: SSRI18nInput | RenderSSRHeadOptions,
  legacyFallbackLocale?: string,
): { headTags: string; htmlAttrs: string; bodyAttrs: string } {
  // #55: هر دو شکل آرگومان دوم آبجکت‌اند؛ شکل جدید با کلیدهای
  // `i18n`/`fallbackLocale` (و `{}` خالی) و آرگومان سوم قدیمی از هم جدا
  // می‌شوند. (کلیدهای `SSRI18nInput` یعنی locale/dir/messages مجزا هستند؛
  // شکل قدیمِ `(…, undefined, locale)` با legacyFallbackLocale شناسایی
  // می‌شود تا locale گم نشود.)
  const isNewShape =
    legacyFallbackLocale === undefined &&
    (i18nOrOptions === undefined ||
      (typeof i18nOrOptions === 'object' &&
        i18nOrOptions !== null &&
        (Object.keys(i18nOrOptions).length === 0 ||
          'i18n' in i18nOrOptions ||
          'fallbackLocale' in i18nOrOptions)));
  if (!isNewShape) {
    deprecate(
      'ZEN-DEPR-107',
      'renderSSRHead(head, i18n, fallbackLocale)',
      'renderSSRHead(head, { i18n, fallbackLocale })',
    );
  }
  const i18n = isNewShape
    ? (i18nOrOptions as RenderSSRHeadOptions | undefined)?.i18n
    : (i18nOrOptions as SSRI18nInput | undefined);
  const fallbackLocale = isNewShape
    ? (i18nOrOptions as RenderSSRHeadOptions | undefined)?.fallbackLocale
    : legacyFallbackLocale;
  const effectiveLocale = i18n?.locale ?? fallbackLocale;
  const effectiveDir =
    i18n?.dir ??
    (effectiveLocale && /^(fa|ar|he|ur|ps|ckb|sd|ug|yi)\b/i.test(effectiveLocale)
      ? 'rtl'
      : effectiveLocale
        ? 'ltr'
        : undefined);

  if (typeof head === 'string' || !head) {
    const htmlMap: Record<string, string> = {};
    if (effectiveLocale) htmlMap.lang = effectiveLocale;
    if (effectiveDir) htmlMap.dir = effectiveDir;
    return {
      headTags: typeof head === 'string' ? head : '',
      htmlAttrs: renderManagedHead({ htmlAttrs: htmlMap }).htmlAttrs,
      bodyAttrs: '',
    };
  }

  const manager = 'resolve' in head ? head as HeadManager : undefined;
  const value = manager ? manager.resolve() : head as SSRHeadInput;
  const result = renderManagedHead(manager ?? value);
  result.htmlAttrs = renderManagedHead({ htmlAttrs: {
    ...(effectiveLocale ? { lang: effectiveLocale } : {}), ...(effectiveDir ? { dir: effectiveDir } : {}), ...(value.htmlAttrs ?? {}),
  } }).htmlAttrs;
  return result;
}

/** Legacy facade: explicit manager or the current isolated render request, never last-created global state. */
export function useHead(input: SSRHeadInput, head?: HeadManager) {
  const owner = head ?? domAls.getStore()?.head;
  if (!owner) throw new ZenithError({ code: 'ZEN-1501', category: 'SSR', message: 'useHead requires an explicit manager or isolated SSR request.' });
  return owner.push(input);
}

// ═══════════════════════════════════════════════════════════════════════════
// #156 & #157 — Node & Edge SSR Adapters (createNodeHandler, createFetchHandler)
