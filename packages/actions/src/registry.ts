// packages/actions/src/registry.ts
//
// Instance-based action registry (multi-app friendly). No module-level state
// lives here — the default singleton and its SSR scoping live in
// `./default-registry`, which delegates to this class.
import { deprecate, developerError, ErrorCode } from '@zenith/errors';
import { logger } from '@zenith/logger';
import type { Disposable } from '@zenith/shared';
import type { ActionContext, ActionFn, ActionMiddleware, ActionMetadata } from './types';

/**
 * FEATURE (v1.3.0): کلاس ActionRegistry — نمونه‌پذیر برای Multi-App.
 *
 * مثال:
 *   const registry = new ActionRegistry();
 *   registry.register('cart.save', (ctx) => { ... }, { description: '...' });
 *   Zen.start({ state, registry });
 *
 * پیش از v1.3.0، Registry یک Singleton module-level بود. این هنوز هم
 * کار می‌کند (از طریق نمونه‌ی پیش‌فرض در `./default-registry`)، اما حالا
 * برنامه‌های متعدد در یک صفحه می‌توانند Registry های مستقل داشته باشند.
 */
export class ActionRegistry implements Disposable {
  // #116: فلگ dispose برای idempotency (alias destroy همان را می‌خواند).
  private _disposed = false;

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
    if (this._disposed) {
      throw developerError(
        `Cannot execute action "${name}" on a disposed ActionRegistry.`,
        ErrorCode.INTERNAL_DEVELOPER_ERROR,
      );
    }
    const initialEntry = this._actions.get(name);
    if (!initialEntry) {
      throw developerError(`Action "${name}" not found.`, ErrorCode.RUNTIME_COMPONENT_NOT_FOUND);
    }

    // #15 FIX: اسنپ‌شات زنجیرهٔ middleware در لحظهٔ شروع برای جلوگیری از race
    // هنگام تغییر لیست middlewareها در میانهٔ اجرای async، به‌همراه گارد
    // فراخوانی چندبارهٔ next() و خواندن آخرین handler ثبت‌شده در انتهای زنجیره.
    const middlewares = [...this._middlewares];

    const runTarget = (): void | Promise<void> => {
      const currentEntry = this._actions.get(name) ?? initialEntry;
      return currentEntry.fn(ctx);
    };

    if (middlewares.length === 0) {
      return runTarget();
    }

    const dispatch = (index: number): void | Promise<void> => {
      if (index >= middlewares.length) {
        return runTarget();
      }
      const mw = middlewares[index]!;
      let nextCalled = false;
      return mw(name, ctx, () => {
        if (nextCalled) {
          throw developerError(
            `Action middleware for "${name}" called next() multiple times.`,
            ErrorCode.INTERNAL_DEVELOPER_ERROR,
          );
        }
        nextCalled = true;
        return dispatch(index + 1);
      });
    };

    return dispatch(0);
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
      logger.warn(`[Zenith] Action "${name}" is being overridden.`);
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
  dispose(): void {
    if (this._disposed) return; // #116: idempotency
    this._disposed = true;
    this._actions.clear();
    this._middlewares = [];
  }

  /**
   * @deprecated #116 — نام قدیمی چرخهٔ عمر؛ از `dispose()` استفاده کن
   * (ZEN-DEPR-019؛ حذف در ۲.۰ — DEC-026).
   */
  destroy(): void {
    deprecate('ZEN-DEPR-019', 'registry.destroy()', 'registry.dispose()');
    this.dispose();
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
      throw developerError(`Action name must be a non-empty string. Received: ${String(name)}`);
    }
    // FEATURE (v1.3.0): Allow `.` for namespacing (e.g. `cart.save`).
    // Disallow leading/trailing dot, double dots, and unsafe chars.
    if (!/^[a-zA-Z_$][a-zA-Z0-9_$.-]*$/.test(name)) {
      throw developerError(
        `Invalid action name "${name}". Names must start with a letter, ` +
          `underscore, or $, and may contain letters, digits, underscores, $, ` +
          `dots (for namespaces), and hyphens.`,
      );
    }
    if (name.startsWith('.') || name.endsWith('.') || name.includes('..')) {
      throw developerError(
        `Invalid action name "${name}". Dots cannot be leading, trailing, or doubled.`,
      );
    }
  }

  private _validateFn(fn: ActionFn): void {
    if (typeof fn !== 'function') {
      throw developerError(`Action handler must be a function. Received: ${typeof fn}`);
    }
  }
}
