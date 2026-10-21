// packages/actions/src/types.ts
//
// Shared action shapes. Pure types only — no runtime imports, so type-only
// consumers never pull the registry implementation into their graph.

/**
 * Context داده‌شده به هر Action هنگام اجرا.
 *
 * @property event   رویداد اصلی مرورگر (click, keydown, …)
 * @property state   آبجکت State کاربر (همان که به Zen.start داده شد).
 *                   شامل Signalها به شکل خام (نه Context).
 * @property element عنصری که zen-action روی آن تعریف شده (delegate target).
 * @property args    FEATURE (v1.3.0): آرگومان‌های ارزیابی‌شده برای Parameterized
 *                   Actions. وقتی از `zen-action="save($item, $product.id)"`
 *                   استفاده شود، این فیلد `[itemValue, productIdValue]` را
 *                   خواهد داشت. اگر اکشن بدون پرانتز نوشته شود (`save`)،
 *                   `args` برابر `undefined` است (backward compatible).
 */
export interface ActionContext {
  event: Event;
  state: Record<string, unknown>;
  element: HTMLElement;
  /**
   * FEATURE (v1.3.0): Evaluated arguments for parameterized actions.
   * Undefined when the action is invoked without parens (backward compat).
   */
  args?: unknown[];
}

/**
 * امضای یک Action قابل ثبت در Registry.
 *
 * از فاز ۱۰ به بعد، Action می‌تواند async باشد (Promise برمی‌گرداند).
 * اگر Action async باشد، فریم‌ورک خطاهای آن را به‌طور خودکار catch می‌کند.
 *
 * FEATURE (v1.3.0): پارامتر دوم `args` اختیاری است. اگر Action با parens
 * فراخوانی شود (`save($item)`), آرگومان‌های ارزیابی‌شده در `ctx.args`
 * قرار می‌گیرند.
 */
export type ActionFn = (ctx: ActionContext) => void | Promise<void>;

/**
 * IMP-ACT-01 (v1.3.0): Middleware برای Action Pipeline.
 *
 * Middlewareها قبل از اجرای Action اجرا می‌شوند و می‌توانند:
 *   - Logging و Monitoring
 *   - Authorization و Permission Checks
 *   - Validation ورودی
 *   - Transformation context
 *   - خطاگیری متمرکز
 *
 * برای عبور به Action بعدی در زنجیره، `next()` را صدا بزنید.
 * اگر `next()` صدا زده نشود، Action اصلی اجرا نمی‌شود.
 *
 * @param name  نام Action در حال اجرا.
 * @param ctx   Context اکشن (قابل تغییر).
 * @param next  تابع مرحله بعدی زنجیره.
 */
export type ActionMiddleware = (
  name: string,
  ctx: ActionContext,
  next: () => void | Promise<void>,
) => void | Promise<void>;

/**
 * FEATURE (v1.3.0): متادیتای اختیاری برای Action.
 *
 * این متادیتا برای DevTools، Documentation Generation و Permission Checks
 * استفاده می‌شود. هیچ‌کدام از فیلدها اجباری نیستند.
 */
export interface ActionMetadata {
  /** توضیح کوتاه برای DevTools و documentation. */
  description?: string;
  /** دسته‌بندی برای grouping در DevTools (مثلاً 'cart', 'auth', 'ui'). */
  category?: string;
  /**
   * لیست permission های موردنیار. اگر `@zenith/permission` نصب باشد،
   * فریم‌ورک می‌تواند قبل از اجرای اکشن این لیست را بررسی کند.
   */
  permissions?: string[];
  /** اگر `true`، اکشن در DevTools با warning نشان داده می‌شود. */
  deprecated?: boolean;
  /** Free-form bag برای plugin های سفارشی. */
  [key: string]: unknown;
}
