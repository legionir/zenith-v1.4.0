// packages/ssr/src/render-context.ts
//
// کانتکست و گزینه‌های رندر — استخراج مکانیکی از render.ts،
// بدون تغییر رفتار (#40).

import { getSSRAppOwnership } from './dom-context';
import type { ActionFn, App } from '@zenith/runtime';
import type { HeadManager } from '@zenith/head';
import type { ServerComponent } from './server-component';
import type { SSRDOMInstance } from './dom-types';
import type { SSRHeadInput, SSRI18nInput } from './render-serialize';


// ── AsyncLocalStorage for thread-safe DOM isolation ──

/**
 * BUG-22 FIX (v1.2.2): provider function برای EffectContext. در هر call،
 * EffectContext مخصوص async context فعلی (via domAls) را برمی‌گرداند.
 * اگر خارج از domAls.run() فراخوانی شود (مثلاً در client-side)، null
 * برمی‌گرداند و signal.ts به fallback ماژول-level برمی‌گردد.
 *
 * effectContext روی domGlobals به‌صورت lazy ذخیره می‌شود (اولین call آن
 * را می‌سازد، callهای بعدی همان را برمی‌گرداند) تا بین effectهای یک درخواست
 * state به اشتراک گذاشته شود اما بین درخواست‌ها ایزوله بماند.
 */
/** Request-owned factory inputs. The signal also closes when rendering finishes. @public */
export interface SSRAppContext {
  document: Document;
  state: Record<string, unknown>;
  head: HeadManager;
  route?: string;
  signal: AbortSignal;
}

// A factory must never hand a disposed or concurrently mounted App to another
// render. Weak membership does not retain completed Apps.
export const { factoryApps, activeApps } = getSSRAppOwnership();

export interface RenderOptions {
  /** Cancel pending rendering; no DOM/App work starts after cancellation. */
  signal?: AbortSignal;
  route?: string;
  serializeState?: boolean;
  /** Response-owned CSP nonce for JSON-LD and hydration output. */
  nonce?: string;
  /** #92 / #148 / #174: نمونهٔ مستقل App یا کارخانهٔ per-request (`() => App`) */
  app?: App | ((context: SSRAppContext) => App | Promise<App>);
  /** #92: کامپوننت‌های سرور اختصاصی این درخواست (بدون نشت به سایر درخواست‌ها) */
  serverComponents?: Record<string, ServerComponent | ServerComponent['render']>;
  /** #92: اکشن‌های اختصاصی این درخواست */
  actions?: Record<string, ActionFn>;
  /** #92: زبان/locale اختصاصی این درخواست */
  locale?: string;
  /** #174: ورودی `<head>` اختصاصی این درخواست */
  head?: SSRHeadInput | string | HeadManager;
  /** #174: وضعیت چندزبانگی (`i18n`) اختصاصی این درخواست */
  i18n?: SSRI18nInput;
  /** #92: سازندهٔ DOM سفارشی برای محیط‌های Edge بدون jsdom */
  createDOM?: (html: string, url: string) => SSRDOMInstance;
  /** #91: مهلت زمانی رندر SSR به میلی‌ثانیه (در صورت عبور، خطای ZEN-1801 پرتاب می‌شود) */
  timeout?: number;
  /** #91: نام مستعار مهلت زمانی رندر SSR (میلی‌ثانیه) */
  renderTimeoutMs?: number;
  /** #91: فعال‌سازی کش قالب‌های parse‌شده و استخر JSDOM (پیش‌فرض: true) */
  cacheTemplates?: boolean;
}
