// packages/runtime/src/attributes.ts
//
// FEATURE (v1.0.0): تعاریف TypeScript برای HTML attribute های Zenith.
//
// این فایل یک interface فراهم می‌کند که کاربران می‌توانند برای extend کردن
// HTML attribute types در پروژه‌های TypeScript استفاده کنند. این کار باعث
// می‌شود IDE ها و tsc بتوانند zen-* attribute ها را بشناسند.

/**
 * FEATURE (v1.0.0): Interface برای تمام attribute های Zenith.
 *
 * این attribute ها توسط runtime walker پردازش می‌شوند. کاربر می‌تواند
 * این interface را برای extend کردن HTML attribute types در TypeScript
 * استفاده کند.
 *
 * @example
 *   import type { ZenithAttributes } from '@zenith/runtime';
 *
 *   function MyComponent(props: ZenithAttributes & { children?: React.ReactNode }) {
 *     return <div {...props} />;
 *   }
 */
export interface ZenithAttributes {
  // ── DOM Directives ──

  /** رندر متن واکنش‌گرا. value: Expression string (مثلاً "$user.name"). */
  'zen-text'?: string;
  /** رندر HTML با Sanitizer. value: Expression string. */
  'zen-html'?: string;
  /** رندر HTML بدون Sanitizer (Trusted content). value: Expression string. */
  'zen-html-trusted'?: string;
  /** رندر شرطی (حذف از DOM اگر false). value: Expression string (boolean). */
  'zen-if'?: string;
  /** toggle visibility با display:none. value: Expression string (boolean). */
  'zen-show'?: string;
  /** رندر لیست با keyed diffing. value: "item in $items" یا "(item, index) in $items". */
  'zen-for'?: string;
  /** کلید آیتم در zen-for. value: Expression string (مثلاً "item.id"). */
  'zen-key'?: string;
  /**
   * FEATURE (v1.0.0): Fast path برای zen-for.
   *
   * وقتی وجود داشته باشد، per-item Signal ساخته نمی‌شود و در تغییر لیست
   * full re-render انجام می‌شود. مناسب برای لیست‌های فقط‌خواندنی.
   *
   * value: empty string (مثلاً `zen-static=""`).
   */
  'zen-static'?: '' | 'true' | string;
  /** Two-way binding برای input/textarea/select. value: Expression path (مثلاً "$user.name"). */
  'zen-model'?: string;
  /** اتصال Expression به attribute. نام attribute بعد از colon می‌آید (مثلاً "zen-bind:class"). */
  'zen-bind:class'?: string;
  'zen-bind:src'?: string;
  'zen-bind:href'?: string;
  'zen-bind:value'?: string;
  'zen-bind:disabled'?: string;
  'zen-bind:checked'?: string;
  'zen-bind:readonly'?: string;
  'zen-bind:required'?: string;
  'zen-bind:style'?: string;

  // ── Event Directives ──

  /** bind یک action به رویداد. value: نام action. */
  'zen-action'?: string;
  /** stopPropagation روی رویداد. value: "true". */
  'zen-stop-propagation'?: string;
  /** preventDefault روی رویداد. value: "true". */
  'zen-prevent-default'?: string;

  // ── Component Directives ──

  /** تعریف کامپوننت سفارشی. value: نام کامپوننت. */
  'zen-component'?: string;
  /** prop برای کامپوننت. نام prop بعد از colon می‌آید. */
  'zen-props'?: string;

  // ── Data Directives ──

  /** fetch از URL و ذخیره در state name. value: URL Expression. */
  'zen-fetch'?: string;
  /** اتصال Resource به DOM. value: URL Expression. */
  'zen-resource'?: string;
  /** نام state برای zen-fetch/zen-resource. value: نام state. */
  'zen-state'?: string;

  // ── Transition Directives ──

  /** نام transition برای enter/leave. value: نام transition. */
  'zen-transition'?: string;
  /** انیمیشن Web Animations API. value: preset یا keyframes. */
  'zen-animate'?: string;

  // ── Structural Directives ──

  /** جابجایی عنصر به container دیگر. value: CSS selector. */
  'zen-portal'?: string;
  /** lazy-load با IntersectionObserver. value: Expression (تابع callback). */
  'zen-intersection'?: string;
  /** bind عنصر DOM به یک Signal. value: نام Signal در state. */
  'zen-ref'?: string;
  /** حذف attribute برای visible شدن (ضد FOUC). value: empty. */
  'zen-cloak'?: '' | 'true' | string;

  // ── Routing Directives ──

  /** تعریف route در zen-router. value: مسیر. */
  'zen-route'?: string;
  /** outlet برای zen-router. value: empty. */
  'zen-outlet'?: string;
  /** link برای SPA navigation. value: مسیر. */
  'zen-link'?: string;

  // ── Form Directives ──

  /** تعریف form با schema. value: نام schema. */
  'zen-form'?: string;
  /** field در form. value: نام field. */
  'zen-field'?: string;
  /** submit action برای form. value: نام action. */
  'zen-submit'?: string;
  /** validator برای field. value: نام validator. */
  'zen-validate'?: string;

  // ── Stateful Component Attributes ──

  /** config برای <zen-resource-view> و <zen-auth-view>. value: نام متغیر در state. */
  config?: string;
  /** action برای <zen-action-button>. value: نام action. */
  action?: string;
  /** متن loading برای <zen-action-button>. value: متن. */
  'loading-text'?: string;
  /** متن empty state برای <zen-resource-view>. value: متن. */
  'empty-text'?: string;
  /** متن retry برای <zen-resource-view>. value: متن. */
  'retry-text'?: string;

  // ── Virtual List Attributes ──

  /** ارتفاع آیتم در virtual-list. value: عدد (px). */
  'zen-item-height'?: string;
  /** buffer برای virtual-list. value: عدد. */
  'zen-buffer'?: string;
  /** dynamic heights برای virtual-list. value: "true". */
  'zen-dynamic-heights'?: string;

  // ── Misc ──

  /** html slot برای کامپوننت. value: نام slot. */
  'zen-html-slot'?: string;
  /** store binding. value: نام store. */
  'zen-store'?: string;
  /** auth binding. value: نام auth instance. */
  'zen-auth'?: string;
}

/**
 * FEATURE (v1.0.0): Utility type برای bind attribute های generic.
 *
 * اجازه می‌دهد `zen-bind:<attr>` برای هر attribute‌ای استفاده شود.
 */
export type ZenBindAttribute = `zen-bind:${string}`;

/**
 * FEATURE (v1.0.0): همه‌ی attribute های Zenith شامل generic bind.
 *
 * این type ترکیبی از `ZenithAttributes` و generic `zen-bind:*` است.
 */
export type AllZenithAttributes = ZenithAttributes & {
  [key: ZenBindAttribute]: string | undefined;
};
