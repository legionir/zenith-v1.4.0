// packages/errors/src/error-class.ts
//
// کلاس پایهٔ ZenithError — استخراج مکانیکی از core.ts بدون تغییر رفتار
// (#40، code-first: نوشته‌شده، اجرا نشده).



// ─────────────────────────────────────────────────────────────
// ZenithError Class
// ─────────────────────────────────────────────────────────────

/**
 * کلاس پایه برای تمام خطاهای Zenith.
 *
 * @property code      کد خطا (مثلاً "ZEN-002")
 * @property category  دسته‌ی خطا (مثلاً "Expression")
 * @property message   پیام اصلی خطا
 * @property suggestion پیشنهاد برای رفع خطا (اختیاری)
 * @property details   جزئیات اضافی برای دیباگ (اختیاری)
 * @property context   context در زمان خطا (اختیاری)
 */
import { errorDocsUrl, type ErrorCategory, type ErrorSeverity } from './error-kinds';

/** @public */
export class ZenithError extends Error {
  readonly code: string;
  readonly category: ErrorCategory;
  readonly suggestion?: string;
  readonly details?: Record<string, unknown>;
  readonly context?: Record<string, unknown>;
  readonly isDevMode: boolean;
  /**
   * لینک مستندات خطا (SPEC §۰.۴: `https://zenith.dev/errors/<code>`) — #171.
   * #112: همیشه پر است (در سازنده از `errorDocsUrl(code)` مشتق می‌شود) تا هیچ
   * خطی بدون راهنمای قابل‌اقدام چاپ نشود؛ صفحهٔ هر کد در `docs/errors/<code>.md`
   * است و با `scripts/check-error-docs.mjs` در CI گیت می‌شود.
   * @default errorDocsUrl(code)
   */
  readonly docsUrl: string;
  /**
   * شدت خطای زمان اجرا (#115 / DEC-031) — اختیاری؛ hub هنگام emit ست می‌کند.
   * خطای throw شده (مسیر programmer) معمولاً undefined است.
   */
  severity?: ErrorSeverity;
  /** hint سازگاری با API قدیمی state (#115)؛ معادل `suggestion` در نمایش. */
  hint?: string;
  /** زمان ساخت خطا (ms epoch) — #115 (سازگاری با فیلد `timestamp` مدل قدیمی state). */
  timestamp: number;
  /**
   * #115: metadata مسیر خطای زمان‌اجرا که reportError پر می‌کند.
   * `element` عمداً `unknown` است تا این پکیج L0/DOM-free بماند
   * (error-boundary آن را به HTMLElement نگاشت می‌کند).
   */
  source?: string;
  /** عبارت/Expression مرتبط با خطا (در صورت شناخت). */
  expression?: string;
  /** مرجع DOM مرتبط با خطا. */
  element?: unknown;

  constructor(opts: {
    code: string;
    category: ErrorCategory;
    message: string;
    suggestion?: string;
    details?: Record<string, unknown>;
    context?: Record<string, unknown>;
    docsUrl?: string;
    cause?: unknown;
  }) {
    super(opts.message, { cause: opts.cause });
    this.name = 'ZenithError';
    this.code = opts.code;
    this.category = opts.category;
    this.suggestion = opts.suggestion;
    this.details = opts.details;
    this.context = opts.context;
    // #112: پیش‌فرض، خودِ کد است — سازندهٔ بدون docsUrl هم لینک می‌گیرد.
    this.docsUrl = opts.docsUrl ?? errorDocsUrl(opts.code);
    this.timestamp = Date.now();
    this.isDevMode =
      typeof globalThis !== 'undefined' && Reflect.get(globalThis, '__ZENITH_DEV__') !== false;

    // Maintain proper stack trace (V8 only).
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, ZenithError);
    }
  }

  /**
   * تبدیل خطا به یک فرمت کاربرپسند برای چاپ در لاگ میزبان.
   */
  toUserString(): string {
    let out = `❌ [${this.code}] ${this.category}: ${this.message}`;
    if (this.suggestion) {
      out += `\n\n💡 پیشنهاد: ${this.suggestion}`;
    }
    if (this.docsUrl) {
      out += `\n\n📖 مستندات: ${this.docsUrl}`;
    }
    if (this.isDevMode && this.details) {
      out += `\n\n🔍 جزئیات: ${JSON.stringify(this.details, null, 2)}`;
    }
    return out;
  }

  /**
   * تبدیل خطا به JSON برای API responses.
   */
  toJSON(): Record<string, unknown> {
    return {
      error: true,
      code: this.code,
      category: this.category,
      message: this.message,
      suggestion: this.suggestion,
      details: this.isDevMode ? this.details : undefined,
      docsUrl: this.docsUrl,
    };
  }
}