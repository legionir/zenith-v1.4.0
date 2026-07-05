// packages/actions/src/registry.ts
//
// Action Registry — ثبت و بازیابی توابع Business Logic.
//
// ایده‌ی اصلی:
//   به‌جای اینکه در HTML به صورت inline کد بنویسیم (مثل onclick="alert(...)")،
//   فقط یک «نام اکشن» می‌نویسیم (مثل zen-action="save") و خود تابع در JS
//   با Zen.action('save', fn) ثبت می‌شود.
//
// مزایا:
//   1) جدایی کامل لایه‌ی UI (HTML) از منطق (JS).
//   2) امنیت: هیچ کدی از HTML اجرا نمی‌شود، فقط نام‌های از پیش ثبت‌شده.
//   3) قابلیت تست: توابع اکشن مستقل از DOM قابل تست هستند.
//   4) Tree-shaking: توابعی که استفاده نمی‌شوند به build نهایی نمی‌روند.
//
// FEATURE (v1.3.0):
//   - Instance-based registry via `ActionRegistry` class (multi-app friendly).
//   - Optional metadata (description, category, permissions, ...) for DevTools.
//   - Namespace support: names may contain `.` (e.g. `cart.save`, `admin.delete`).
//   - `listActions()` / `getActionMeta()` for introspection.
//   The module-level singleton API (`registerAction`, `getAction`, ...) is
//   preserved for backward compatibility and delegates to a default
//   `ActionRegistry` instance.

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
  state: Record<string, any>;
  element: HTMLElement;
  /**
   * FEATURE (v1.3.0): Evaluated arguments for parameterized actions.
   * Undefined when the action is invoked without parens (backward compat).
   */
  args?: any[];
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
  [key: string]: any;
}

/**
 * FEATURE (v1.3.0): کلاس ActionRegistry — نمونه‌پذیر برای Multi-App.
 *
 * مثال:
 *   const registry = new ActionRegistry();
 *   registry.register('cart.save', (ctx) => { ... }, { description: '...' });
 *   Zen.start({ state, registry });
 *
 * پیش از v1.3.0، Registry یک Singleton module-level بود. این هنوز هم
 * کار می‌کند (از طریق `_defaultRegistry`)، اما حالا برنامه‌های متعدد
 * در یک صفحه می‌توانند Registry های مستقل داشته باشند.
 */
export class ActionRegistry {
  /** مخزن داخلی actions. */
  private readonly _actions = new Map<string, { fn: ActionFn; metadata?: ActionMetadata }>();

  /**
   * IMP-ACT-01 (v1.3.0): Middleware pipeline.
   * Middlewareها به ترتیب ثبت اجرا می‌شوند و هرکدام می‌توانند
   * درخواست را به مرحله بعد یا به Action اصلی هدایت کنند.
   */
  private _middlewares: ActionMiddleware[] = [];

  /**
   * IMP-ACT-01 (v1.3.0): افزودن middleware به Pipeline.
   *
   * @param mw تابع middleware.
   * @returns `this` برای method chaining.
   */
  use(mw: ActionMiddleware): this {
    this._middlewares.push(mw);
    return this;
  }

  /**
   * IMP-ACT-01 (v1.3.0): اجرای Action با عبور از middleware pipeline.
   *
   * @param name نام Action.
   * @param ctx  Context اجرا.
   */
  async execute(name: string, ctx: ActionContext): Promise<void> {
    const entry = this._actions.get(name);
    if (!entry) {
      throw new Error(`[Zenith] Action "${name}" not found.`);
    }

    const handler = entry.fn;

    if (this._middlewares.length === 0) {
      return handler(ctx);
    }

    // زنجیره middleware: از آخرین به اولین ساخته می‌شود
    // تا اولین middleware ثبت‌شده اولین اجرا شود
    const chain = this._middlewares.reduceRight(
      (next: () => void | Promise<void>, mw: ActionMiddleware) => () => mw(name, ctx, next),
      () => handler(ctx),
    );

    return chain();
  }

  /**
   * ثبت (یا بازنویسی) یک Action.
   *
   * BUG-ACT-03 (v1.3.0): اگر اکشن قبلاً ثبت شده باشد،
   * اخطار در کنسول چاپ می‌شود تا از override ناخواسته جلوگیری کند.
   *
   * @param name     نام اکشن. از v1.3.0 به بعد، نام می‌تواند شامل `.` برای
   *                 namespacing باشد (مثلاً `cart.save`, `admin.delete-user`).
   * @param fn       تابعی که هنگام رخ دادن رویداد اجرا می‌شود.
   * @param metadata FEATURE (v1.3.0): متادیتای اختیاری برای DevTools.
   * @returns `this` برای method chaining.
   */
  register(name: string, fn: ActionFn, metadata?: ActionMetadata): this {
    this._validateName(name);
    this._validateFn(fn);
    if (this._actions.has(name)) {
      console.warn(`[Zenith] Action "${name}" is being overridden.`);
    }
    this._actions.set(name, { fn, metadata });
    return this;
  }

  /**
   * حذف یک Action از Registry.
   *
   * @returns `true` اگر حذف شد، `false` اگر وجود نداشت.
   */
  unregister(name: string): boolean {
    return this._actions.delete(name);
  }

  /**
   * دریافت Action با نام داده‌شده.
   *
   * @returns تابع یا `undefined` اگر ثبت نشده باشد.
   */
  get(name: string): ActionFn | undefined {
    return this._actions.get(name)?.fn;
  }

  /**
   * FEATURE (v1.3.0): دریافت متادیتای یک Action.
   *
   * مفید برای DevTools، documentation generation و runtime permission checks.
   *
   * @returns متادیتا یا `undefined` اگر اکشن ثبت نشده باشد یا متادیتا نداشته باشد.
   */
  getMeta(name: string): ActionMetadata | undefined {
    return this._actions.get(name)?.metadata;
  }

  /**
   * بررسی وجود Action.
   */
  has(name: string): boolean {
    return this._actions.has(name);
  }

  /**
   * پاکسازی کل Registry.
   *
   * ⚠️ در Production استفاده نکنید — این عملیات تمام اکشن‌های فعال را حذف می‌کند.
   * مفید برای HMR و تست‌ها.
   */
  clear(): void {
    this._actions.clear();
    this._middlewares = [];
  }

  /**
   * BUG-ACT-01 (v1.3.0): پاکسازی کامل Registry برای HMR و Teardown.
   *
   * تفاوت با `clear()`: destroy تمام middlewareها را هم پاک می‌کند
   * و آماده GC شدن است. بعد از destroy، نباید از Registry استفاده شود.
   * برای HMR و unmount کامپوننت مناسب است.
   */
  destroy(): void {
    this._actions.clear();
    this._middlewares = [];
  }

  /**
   * FEATURE (v1.3.0): لیست تمام Action های ثبت‌شده به همراه متادیتا.
   *
   * برای DevTools و documentation generation استفاده می‌شود.
   *
   * @returns آرایه‌ای از `{ name, metadata }` برای هر Action.
   */
  list(): Array<{ name: string; metadata?: ActionMetadata }> {
    const result: Array<{ name: string; metadata?: ActionMetadata }> = [];
    for (const [name, entry] of this._actions) {
      result.push({ name, metadata: entry.metadata });
    }
    return result;
  }

  /**
   * FEATURE (v1.3.0): تعداد Action های ثبت‌شده.
   */
  get size(): number {
    return this._actions.size;
  }

  /**
   * اعتبارسنجی نام Action.
   *
   * از v1.3.0 به بعد، نام می‌تواند شامل `.` برای namespacing باشد
   * (مثلاً `cart.save`, `admin.delete-user`, `editor.format.bold`).
   *
   * قوانین:
   *   - باید با حرف، `_` یا `$` شروع شود.
   *   - می‌تواند شامل حروف، اعداد، `_`, `$`, `.` (namespace), و `-` باشد.
   *   - `.` نمی‌تواند اول یا آخر باشد.
   *   - `..` (دو نقطه پشت سر هم) مجاز نیست.
   */
  private _validateName(name: string): void {
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error(
        `[Zenith] Action name must be a non-empty string. Received: ${String(name)}`,
      );
    }
    // FEATURE (v1.3.0): Allow `.` for namespacing (e.g. `cart.save`).
    // Disallow leading/trailing dot, double dots, and unsafe chars.
    if (!/^[a-zA-Z_$][a-zA-Z0-9_$.\-]*$/.test(name)) {
      throw new Error(
        `[Zenith] Invalid action name "${name}". Names must start with a letter, ` +
          `underscore, or $, and may contain letters, digits, underscores, $, ` +
          `dots (for namespaces), and hyphens.`,
      );
    }
    if (name.startsWith('.') || name.endsWith('.') || name.includes('..')) {
      throw new Error(
        `[Zenith] Invalid action name "${name}". Dots cannot be leading, trailing, or doubled.`,
      );
    }
  }

  private _validateFn(fn: ActionFn): void {
    if (typeof fn !== 'function') {
      throw new Error(
        `[Zenith] Action handler must be a function. Received: ${typeof fn}`,
      );
    }
  }
}

// ── Singleton پیش‌فرض — Backward Compatibility ──
//
// پیش از v1.3.0، تمام API های module-level روی یک Map مشترک کار می‌کردند.
// برای حفظ backward compatibility، این API ها به یک نمونه‌ی پیش‌فرض از
// `ActionRegistry` delegate می‌شوند. برنامه‌های جدید می‌توانند با
// `new ActionRegistry()` نمونه‌ی مستقل بسازند.
const _defaultRegistry = new ActionRegistry();

/**
 * ثبت (یا بازنویسی) یک Action روی Registry پیش‌فرض.
 *
 * @param name     نام اکشن — همان رشته‌ای که در HTML نوشته می‌شود.
 * @param fn       تابعی که هنگام رخ دادن رویداد اجرا می‌شود.
 * @param metadata FEATURE (v1.3.0): متادیتای اختیاری برای DevTools.
 */
export function registerAction(
  name: string,
  fn: ActionFn,
  metadata?: ActionMetadata,
): void {
  _defaultRegistry.register(name, fn, metadata);
}

/**
 * حذف یک Action از Registry پیش‌فرض.
 *
 * مفید برای:
 *   - HMR: وقتی ماژول JS دوباره load می‌شود، اکشن قدیمی پاک شود.
 *   - تست‌ها: بین هر test، registry خالی شود.
 */
export function unregisterAction(name: string): boolean {
  return _defaultRegistry.unregister(name);
}

/**
 * دریافت Action با نام داده‌شده از Registry پیش‌فرض.
 *
 * @returns تابع یا `undefined` اگر ثبت نشده باشد.
 */
export function getAction(name: string): ActionFn | undefined {
  return _defaultRegistry.get(name);
}

/**
 * FEATURE (v1.3.0): دریافت متادیتای یک Action از Registry پیش‌فرض.
 */
export function getActionMeta(name: string): ActionMetadata | undefined {
  return _defaultRegistry.getMeta(name);
}

/**
 * بررسی وجود Action در Registry پیش‌فرض.
 */
export function hasAction(name: string): boolean {
  return _defaultRegistry.has(name);
}

/**
 * پاکسازی کل Registry پیش‌فرض (فقط برای تست‌ها و teardown کامل).
 *
 * ⚠️ در Production استفاده نکنید — این عملیات تمام اکشن‌های فعال را حذف می‌کند.
 */
export function clearActions(): void {
  _defaultRegistry.clear();
}

/**
 * FEATURE (v1.3.0): لیست تمام Action های ثبت‌شده در Registry پیش‌فرض.
 *
 * برای DevTools و documentation generation استفاده می‌شود.
 */
export function listActions(): Array<{ name: string; metadata?: ActionMetadata }> {
  return _defaultRegistry.list();
}

/**
 * FEATURE (v1.3.0): دسترسی به نمونه‌ی پیش‌فرض `ActionRegistry`.
 *
 * مفید برای `Zen.start({ registry })` یا برای plugin هایی که می‌خواهند
 * مستقیماً روی registry پیش‌فرض کار کنند.
 */
export function getDefaultRegistry(): ActionRegistry {
  return _defaultRegistry;
}

/**
 * API عمومی برای کاربران: `Zen.action(name, fn)`.
 *
 * معادل `registerAction` است اما با نام کوتاه‌تر برای استفاده‌ی راحت‌تر در HTML.
 * FEATURE (v1.3.0): متدهای `list` و `getMeta` اضافه شدند.
 */
export const action = {
  register: registerAction,
  unregister: unregisterAction,
  has: hasAction,
  clear: clearActions,
  list: listActions,
  getMeta: getActionMeta,
  /**
   * IMP-ACT-01 (v1.3.0): افزودن middleware به default registry.
   *
   * @param mw تابع middleware.
   */
  use: (mw: ActionMiddleware) => _defaultRegistry.use(mw),
  /**
   * IMP-ACT-01 (v1.3.0): اجرای Action از طریق default registry
   * با عبور از middleware pipeline.
   *
   * @param name نام Action.
   * @param ctx  Context اجرا.
   */
  execute: (name: string, ctx: ActionContext) => _defaultRegistry.execute(name, ctx),
};
