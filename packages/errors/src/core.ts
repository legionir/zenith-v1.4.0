// packages/errors/src/core.ts
//
// @zenith/errors — کتابخانه‌ی پیام‌های خطای Zenith (هسته: کلاس + کاتالوگ)
// #115/DEC-031: hub سراسری در ./hub.ts است؛ این فایل هیچ import داخلی‌ای
// ندارد تا چرخهٔ index↔hub ساخته نشود (dependency-cruiser no-circular).
//
// این پکیج یک سیستم ساختاریافته برای خطاها فراهم می‌کند:
//   - کدهای خطای منظم (ZEN-001 تا ZEN-999 + بازه‌های ۴رقمی پکیج‌های جدید، #171)
//   - پیام‌های فارسی قابل‌فهم برای کاربر
//   - پیشنهادها (suggestions) برای رفع خطا
//   - جزئیات (details) برای دیباگ
//   - Stack trace برای ردیابی منشأ خطا
//
// ── ساختار کدها ──
//
// ZEN-001 تا ZEN-099: خطاهای Expression / Validator
// ZEN-100 تا ZEN-199: خطاهای Runtime / Directive
// ZEN-200 تا ZEN-299: خطاهای Resource
// ZEN-300 تا ZEN-399: خطاهای SSR
// ZEN-400 تا ZEN-499: خطاهای Security
// ZEN-500 تا ZEN-599: خطاهای Compiler
// ZEN-600 تا ZEN-699: خطاهای Router
// ZEN-700 تا ZEN-799: خطاهای Form / Validation
// ZEN-800 تا ZEN-899: خطاهای Component
// ZEN-900 تا ZEN-999: خطاهای عمومی / Internal
//
// ZEN-1000 تا ZEN-2599: بازه‌های ۴رقمی پکیج‌های جدید (#171، DEC-020؛ جدول
// ERROR_CODE_RANGES + کاتالوگ RESERVED_ERROR_CODES) — کدهای سه‌رقمی موجود
// هرگز renumber نمی‌شوند.
// ZEN-DEPR-000 تا ZEN-DEPR-999: هشدارهای deprecation (DEC-019؛ رجیستری
// DEPRECATION_CODES؛ حذف در ۲.۰ طبق DEC-026).

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
export class ZenithError extends Error {
  readonly code: string;
  readonly category: ErrorCategory;
  readonly suggestion?: string;
  readonly details?: Record<string, unknown>;
  readonly context?: Record<string, unknown>;
  readonly isDevMode: boolean;
  /** لینک مستندات خطا (SPEC §۰.۴: `https://zenith.dev/errors/<code>`) — #171 */
  readonly docsUrl?: string;
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
    this.docsUrl = opts.docsUrl;
    this.timestamp = Date.now();
    this.isDevMode =
      typeof globalThis !== 'undefined' && (globalThis as any).__ZENITH_DEV__ !== false;

    // Maintain proper stack trace (V8 only).
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, ZenithError);
    }
  }

  /**
   * تبدیل خطا به یک فرمت کاربرپسند برای نمایش در console.
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

// ─────────────────────────────────────────────────────────────
// Error Categories
// ─────────────────────────────────────────────────────────────

/** شدت خطای زمان اجرا (#115). */
export type ErrorSeverity = 'error' | 'warning' | 'info';

export type ErrorCategory =
  | 'Expression'
  | 'Runtime'
  | 'Resource'
  | 'SSR'
  | 'Security'
  | 'Compiler'
  | 'Router'
  | 'Form'
  | 'Component'
  | 'Internal'
  // #171 (DEC-020): دو دستهٔ جدید برای کاتالوگ ۴رقمی — افزودنی و سازگار؛
  // بازطراحی کامل مدل خطا موضوع #115 است.
  | 'Validation'
  | 'Network';

// ─────────────────────────────────────────────────────────────
// Error Codes
// ─────────────────────────────────────────────────────────────

export const ErrorCode = {
  // Expression / Validator (ZEN-001 to ZEN-099)
  EXPRESSION_VARIABLE_NOT_DEFINED: 'ZEN-001',
  EXPRESSION_SECURITY_FORBIDDEN_PROPERTY: 'ZEN-002',
  EXPRESSION_SECURITY_FORBIDDEN_IDENTIFIER: 'ZEN-003',
  EXPRESSION_SYNTAX_ERROR: 'ZEN-004',
  EXPRESSION_NOT_A_FUNCTION: 'ZEN-005',
  EXPRESSION_UNKNOWN_OPERATOR: 'ZEN-006',
  EXPRESSION_UNKNOWN_NODE_TYPE: 'ZEN-007',

  // Runtime / Directive (ZEN-100 to ZEN-199)
  RUNTIME_ZEN_FOR_NO_ZEN_KEY: 'ZEN-101',
  RUNTIME_ZEN_FOR_INVALID_SYNTAX: 'ZEN-102',
  RUNTIME_ZEN_FOR_NO_PARENT: 'ZEN-103',
  RUNTIME_ZEN_IF_NO_PARENT: 'ZEN-104',
  RUNTIME_DIRECTIVE_EXPRESSION_FAILED: 'ZEN-105',
  RUNTIME_COMPONENT_NOT_FOUND: 'ZEN-106',
  RUNTIME_DISPOSE_FAILED: 'ZEN-107',

  // Resource (ZEN-200 to ZEN-299)
  RESOURCE_DESTROYED: 'ZEN-201',
  RESOURCE_HTTP_ERROR: 'ZEN-202',
  RESOURCE_URL_EVALUATION_FAILED: 'ZEN-203',
  RESOURCE_SIGNAL_NOT_FOUND: 'ZEN-204',
  RESOURCE_MUTATION_FAILED: 'ZEN-205',

  // SSR (ZEN-300 to ZEN-399)
  SSR_JSDOM_REQUIRED: 'ZEN-301',
  SSR_NO_ROOT_ELEMENT: 'ZEN-302',
  SSR_ASYNC_LOCAL_STORAGE_UNAVAILABLE: 'ZEN-303',
  SSR_HYDRATION_MISMATCH: 'ZEN-304',

  // Security (ZEN-400 to ZEN-499)
  SECURITY_XSS_BLOCKED: 'ZEN-401',
  SECURITY_SANITIZATION_FAILED: 'ZEN-402',
  // #64: CSPRNG در دسترس نیست — تولید شناسه‌ی امن با Math.random ممنوع است.
  SECURITY_RANDOM_SOURCE_UNAVAILABLE: 'ZEN-403',
  // #62: انتخاب localStorage/cookie برای توکن حساس — در dev هشدار داده می‌شود.
  SECURITY_INSECURE_TOKEN_STORAGE: 'ZEN-404',

  // Compiler (ZEN-500 to ZEN-599)
  COMPILE_UNKNOWN_DIRECTIVE: 'ZEN-501',
  COMPILE_EXPRESSION_ERROR: 'ZEN-502',
  COMPILE_SYNTAX_ERROR: 'ZEN-503',
  COMPILE_MISSING_IMPORT: 'ZEN-504',

  // JS/VM (ZEN-550 to ZEN-559) — runtime evaluation errors
  JS_VM_RUNTIME_ERROR: 'ZEN-551',
  JS_VM_TIMEOUT: 'ZEN-552',
  JS_VM_MEMORY_LIMIT: 'ZEN-553',

  // Router (ZEN-600 to ZEN-699)
  ROUTER_ROUTE_NOT_FOUND: 'ZEN-601',
  ROUTER_LAZY_LOAD_FAILED: 'ZEN-602',
  ROUTER_NAVIGATION_ABORTED: 'ZEN-603',

  // Form (ZEN-700 to ZEN-799)
  FORM_VALIDATION_FAILED: 'ZEN-701',
  FORM_SCHEMA_INVALID: 'ZEN-702',

  // Component (ZEN-800 to ZEN-899)
  COMPONENT_SLOT_NOT_FOUND: 'ZEN-801',
  COMPONENT_PROP_REQUIRED: 'ZEN-802',

  // Internal (ZEN-900 to ZEN-999)
  INTERNAL_UNKNOWN: 'ZEN-901',
  // #115 (DEC-031): کدهای مسیر واحد خطای زمان‌اجرا (hub در ./hub.ts).
  /** خطای runtime directive/effect که از reportError/emitError عبور می‌کند. */
  INTERNAL_RUNTIME_FAILURE: 'ZEN-905',
  /** خطای reactivity (effect) که به hub گزارش شده. */
  INTERNAL_REACTIVITY_FAILURE: 'ZEN-906',
  /** misuse عمومی API (تبدیل throw ساده به ZenithError). */
  INTERNAL_DEVELOPER_ERROR: 'ZEN-907',
  /** ناهم‌خوانی hydration SSR. */
  INTERNAL_HYDRATION_MISMATCH: 'ZEN-908',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

// ─────────────────────────────────────────────────────────────
// Error-code space & ranges (#171، مصوب DEC-020)
// ─────────────────────────────────────────────────────────────

/**
 * الگوی رسمی کد خطا (دوآهنگ، DEC-020):
 *  - `ZEN-NNN` سه‌رقمی: کدهای کلاسیک موجود — هرگز renumber نمی‌شوند.
 *  - `ZEN-NNNN` چهاررقمی: بازه‌های پکیج‌های جدید (جدول `ERROR_CODE_RANGES`).
 *  - `ZEN-DEPR-NNN`: هشدارهای deprecation (DEC-019/DEC-026؛ حذف در ۲.۰).
 * هیچ regex قالب‌محور سه‌رقمی در مصرف‌کننده‌ها مجاز نیست (تست گیت #171).
 */
export const ERROR_CODE_PATTERN = /^ZEN-(?:\d{3}|\d{4}|DEPR-\d{3})$/;

/** لینک مستندات هر کد (SPEC §۰.۴). */
export function errorDocsUrl(code: string): string {
  return `https://zenith.dev/errors/${code}`;
}

export interface ErrorCodeRange {
  /** دامنه (نام پکیج/حوزه) — با `domain` هر catalog entry یکی باید باشد. */
  domain: string;
  from: number;
  to: number;
}

/** جدول بازههای ۴رقمی — SPEC §۰.۴ (DEC-020) + بازهٔ CLI (#102). */
export const ERROR_CODE_RANGES: readonly ErrorCodeRange[] = [
  { domain: 'schema', from: 1000, to: 1099 },
  { domain: 'storage', from: 1100, to: 1199 },
  { domain: 'cache', from: 1200, to: 1299 },
  { domain: 'i18n', from: 1300, to: 1399 },
  { domain: 'a11y', from: 1400, to: 1499 },
  { domain: 'head', from: 1500, to: 1599 },
  { domain: 'ui', from: 1600, to: 1699 },
  { domain: 'realtime', from: 1700, to: 1799 },
  { domain: 'adapters', from: 1800, to: 1899 },
  { domain: 'analytics', from: 1900, to: 1999 },
  { domain: 'theme', from: 2000, to: 2099 },
  { domain: 'auth-oauth', from: 2100, to: 2199 },
  { domain: 'feature-flags', from: 2200, to: 2299 },
  { domain: 'runtime-core', from: 2300, to: 2399 },
  { domain: 'devtools-core', from: 2400, to: 2499 },
  { domain: 'tooling', from: 2500, to: 2599 },
  // #102: قوانین `zenith check` — جایگزین کدهای قدیمی Z001..Z820 (دور از بازهٔ SPEC).
  { domain: 'cli', from: 9000, to: 9099 },
] as const;

export interface ReservedErrorMeta {
  domain: string;
  category: ErrorCategory;
  message: string;
  suggestion: string;
}

/**
 * کاتالوگ کدهای رزورشدهٔ ۴رقمی (بندهای پکیج‌ها در NEW-PACKAGES-SPEC).
 * پکیج‌های جدید همین‌ها را مصرف می‌کنند (#141–#149، موج ۴)؛ افزودن کد جدید
 * فقط با بازهٔ درست و تست یکتایی/#171 مجاز است.
 */
export const RESERVED_ERROR_CODES: Readonly<Record<string, ReservedErrorMeta>> = {
  // schema / options validation (ZEN-1000..1099)
  'ZEN-1001': {
    domain: 'schema',
    category: 'Validation',
    message: 'گزینهٔ نامعتبر: نوع یا مقدار در مسیر مشخص‌شده انتظار schema را برآورده نمی‌کند.',
    suggestion: 'مقدار را با نوع موردانتظار در schema تطبیق دهید؛ مسیر خطا در details آمده است.',
  },
  'ZEN-1002': {
    domain: 'schema',
    category: 'Validation',
    message: 'کلید ناشناخته در گزینه‌ها.',
    suggestion: 'املای کلید را بررسی کنید؛ فهرست کلیدهای مجاز در details است.',
  },
  'ZEN-1003': {
    domain: 'schema',
    category: 'Validation',
    message: 'JSON خراب در attribute.',
    suggestion: 'مقدار attribute باید JSON معتبر باشد (بدون کامای انتهایی و نقل‌قول تک).',
  },
  'ZEN-1004': {
    domain: 'schema',
    category: 'Validation',
    message: 'مقدار خارج از بازهٔ مجاز.',
    suggestion: 'مقدار را بین کمینه و بیشینهٔ اعلام‌شده در details قرار دهید.',
  },
  'ZEN-1090': {
    domain: 'schema',
    category: 'Internal',
    message: 'آرگومان نامعتبر به تابع اعتبارسنجی گزینه‌ها.',
    suggestion: 'امضای تابع را از مستندات schema ببینید؛ آرگومان دوم باید schema معتبر باشد.',
  },
  'ZEN-1091': {
    domain: 'schema',
    category: 'Internal',
    message: 'sink لاگر خراب است (خطا هنگام نوشتن گزارش).',
    suggestion: 'sink را جایگزین یا remove کنید؛ خطا فقط یک‌بار گزارش می‌شود و حلقهٔ لاگ نمی‌سازد.',
  },
  // storage (ZEN-1100..1199)
  'ZEN-1101': {
    domain: 'storage',
    category: 'Runtime',
    message: 'ذخیره‌گاه در دسترس نیست (مثلاً حالت private مرورگر).',
    suggestion:
      'fallback به memory فعال شد؛ در صورت نیاز به persist از ذخیره‌گاه جایگزین استفاده کنید.',
  },
  'ZEN-1102': {
    domain: 'storage',
    category: 'Runtime',
    message: 'سهمیهٔ ذخیره‌گاه پر است (quota).',
    suggestion: 'کلیدهای قدیمی را پاک کنید یا از IndexedDB adapter استفاده کنید.',
  },
  'ZEN-1103': {
    domain: 'storage',
    category: 'Runtime',
    message: 'مهاجرت (migrate) نسخهٔ داده شکست خورد.',
    suggestion: 'تابع migrate را بررسی کنید؛ دادهٔ کهنه حذف یا نسخه‌بندی مجدد شود.',
  },
  'ZEN-1104': {
    domain: 'storage',
    category: 'Runtime',
    message: 'دادهٔ ذخیره‌شده خراب/غیرقابل‌تجزیه است.',
    suggestion: 'کلید آسیب‌دیده حذف می‌شود؛ منبع داده را بازسازی کنید.',
  },
  // cache + i18n/jalali (ZEN-1200..1399)
  'ZEN-1201': {
    domain: 'cache',
    category: 'Validation',
    message: 'ttl نامعتبر است.',
    suggestion: 'ttl باید عدد صحیح ≥ ۰ (میلی‌ثانیه) باشد؛ ۰ یعنی بدون انقضا.',
  },
  'ZEN-1202': {
    domain: 'cache',
    category: 'Runtime',
    message: 'loader کش شکست خورد.',
    suggestion: 'خطای اصلی در cause است؛ retry یا fallback را بررسی کنید.',
  },
  'ZEN-1301': {
    domain: 'i18n',
    category: 'Validation',
    message: 'تاریخ خارج از بازهٔ پشتیبانی‌شدهٔ تقویم جلالی است.',
    suggestion: 'بازهٔ مجاز ۱۲۰۱..۱۵۰۰ هجری شمسی است (DEC-020: به‌جای هشدار، throw).',
  },
  'ZEN-1302': {
    domain: 'i18n',
    category: 'Validation',
    message: 'قالب تاریخ نامعتبر.',
    suggestion: 'توکن‌های مجاز: YYYY YY MM M DD D MMM MMMM؛ ترکیب ناشناخته را حذف کنید.',
  },
  'ZEN-1303': {
    domain: 'i18n',
    category: 'Validation',
    message: 'تاریخ نامعتبر (وجود ندارد).',
    suggestion: 'روز/ماه را بررسی کنید (مثلاً ۱۵ اسفند ۳۰ روز نیست).',
  },
  'ZEN-1311': {
    domain: 'i18n',
    category: 'Runtime',
    message: 'کلید پیام پیدا نشد.',
    suggestion: 'کلید را به bundle اضافه کنید یا missing策略 (throw/warn/empty) را تغییر دهید.',
  },
  'ZEN-1312': {
    domain: 'i18n',
    category: 'Validation',
    message: 'قالب ICU نامعتبر است.',
    suggestion: 'ساختار {plural, select, ...} را با مستندات i18n بسنجید.',
  },
  'ZEN-1313': {
    domain: 'i18n',
    category: 'Validation',
    message: 'locale پشتیبانی‌نشده.',
    suggestion: 'locale را در فهرست fallback ثبت کنید یا bundle آن را بارگذاری کنید.',
  },
  'ZEN-1314': {
    domain: 'i18n',
    category: 'Runtime',
    message: 'بارگذاری پیام‌ها شکست خورد.',
    suggestion: 'مسیر loader و شبکه را بررسی کنید؛ خطای اصلی در cause است.',
  },
  // a11y (ZEN-1400..1499)
  'ZEN-1401': {
    domain: 'a11y',
    category: 'Runtime',
    message: 'المان focusable برای focus-trap پیدا نشد.',
    suggestion: 'حداقل یک عنصر focusable داخل container بگذارید یا trap را غیرفعال کنید.',
  },
  'ZEN-1402': {
    domain: 'a11y',
    category: 'Runtime',
    message: 'trap تودرتو با ترتیب پشتیبانی‌نشده.',
    suggestion: 'از پشتهٔ داخلی trap استفاده کنید؛ المان‌های trap را تودرتوی دستی نکنید.',
  },
  'ZEN-1403': {
    domain: 'a11y',
    category: 'Validation',
    message: 'ویژگی aria-* با نقش المان ناسازگار است.',
    suggestion: 'ترکیب role/aria را با WAI-ARIA ARIA in HTML تطبیق دهید.',
  },
  // head (ZEN-1500..1599)
  'ZEN-1501': {
    domain: 'head',
    category: 'Validation',
    message: 'تگ مجاز نیست.',
    suggestion: 'فهرست allowlist §head را ببینید؛ تگ‌های بدنه در head ممنوع‌اند.',
  },
  'ZEN-1502': {
    domain: 'head',
    category: 'Validation',
    message: 'JSON-LD نامعتبر.',
    suggestion: 'object را با JSON.stringify serializable کنید و schema.org را بررسی نمایید.',
  },
  'ZEN-1503': {
    domain: 'head',
    category: 'Validation',
    message: 'تعداد تگ‌ها از maxTags بیشتر شد.',
    suggestion: 'تگ‌ها را ادغام کنید یا maxTags را آگاهانه افزایش دهید.',
  },
  // ui (ZEN-1600..1699)
  'ZEN-1601': {
    domain: 'ui',
    category: 'Runtime',
    message: 'المان trigger پیدا نشد.',
    suggestion: 'selector trigger را اصلاح یا وقت render بودن آن را بررسی کنید.',
  },
  'ZEN-1602': {
    domain: 'ui',
    category: 'Validation',
    message: 'zen-tab بدون zen-tabpanel متناظر.',
    suggestion: 'برای هر tab یک panel با aria-controls هم‌نام بگذارید.',
  },
  'ZEN-1603': {
    domain: 'ui',
    category: 'Validation',
    message: 'مقدار value خارج از گزینه‌ها.',
    suggestion: 'value باید یکی از مقادیر options باشد (یا placeholder مجاز است).',
  },
  'ZEN-1604': {
    domain: 'ui',
    category: 'Runtime',
    message: 'portal مقصد ندارد.',
    suggestion: 'target portal باید به المان موجود در DOM اشاره کند.',
  },
  // realtime (ZEN-1700..1799)
  'ZEN-1701': {
    domain: 'realtime',
    category: 'Network',
    message: 'اتصال برقراری نشد.',
    suggestion: 'URL/شبکه را بررسی کنید؛ backoff خودکار در حال تلاش مجدد است.',
  },
  'ZEN-1702': {
    domain: 'realtime',
    category: 'Network',
    message: 'پیام نامعتبر (parse شکست).',
    suggestion: 'فرمت پیام (default: JSON) را با parser سرویس تطبیق دهید.',
  },
  'ZEN-1703': {
    domain: 'realtime',
    category: 'Security',
    message: 'پروتکل ناامن: ws:// در صفحهٔ https.',
    suggestion: 'از wss:// استفاده کنید (mixed-content).',
  },
  'ZEN-1704': {
    domain: 'realtime',
    category: 'Runtime',
    message: 'صف ارسال پر است.',
    suggestion: 'نرخ ارسال را کم یا maxQueueSize را افزایش دهید؛ پیام‌های drop‌شده در details‌اند.',
  },
  'ZEN-1705': {
    domain: 'realtime',
    category: 'Network',
    message: 'heartbeat timeout.',
    suggestion: 'heartbeatInterval سرویس و اتصال را بررسی کنید؛ reconnect خودکار آغاز می‌شود.',
  },
  // adapters / ssg (ZEN-1800..1899)
  'ZEN-1801': {
    domain: 'adapters',
    category: 'Runtime',
    message: 'رندر SSR با timeout متوقف شد.',
    suggestion: 'renderTimeoutMs را افزایش یا داده‌های کندِ path را به suspense ببرید.',
  },
  'ZEN-1802': {
    domain: 'adapters',
    category: 'Validation',
    message: 'template نامعتبر: نشانگر خروجی نیست.',
    suggestion: '<!--zen-outlet--> (یا کانفیگ marker) داخل template بگذارید.',
  },
  'ZEN-1803': {
    domain: 'adapters',
    category: 'Runtime',
    message: 'AsyncLocalStorage در این runtime در دسترس نیست.',
    suggestion: 'context صریح (domImpl/ALS-free مسیر #92) را فعال کنید (DEC-022).',
  },
  'ZEN-1811': {
    domain: 'adapters',
    category: 'Runtime',
    message: 'runtime پشتیبانی نمی‌شود.',
    suggestion: 'Node ≥18.19، Cloudflare Workers یا Deno (DEC-027) را انتخاب کنید.',
  },
  'ZEN-1812': {
    domain: 'adapters',
    category: 'Runtime',
    message: 'DOM implementation نصب نیست.',
    suggestion: 'linkedom یا happy-dom را به‌عنوان dependency نصب کنید (domImpl).',
  },
  'ZEN-1821': {
    domain: 'adapters',
    category: 'Runtime',
    message: 'مسیر در SSG رندر نشد.',
    suggestion: 'path در routes/paths پیکربندی وجود دارد و prerender سبز شد را بررسی کنید.',
  },
  'ZEN-1822': {
    domain: 'adapters',
    category: 'Runtime',
    message: 'داده در زمان build در دسترس نیست.',
    suggestion: 'منبع داده را در build stage در دسترس کنید یا مسیر را CSR/ISR کنید.',
  },
  // analytics (ZEN-1900..1999)
  'ZEN-1901': {
    domain: 'analytics',
    category: 'Runtime',
    message: 'ارائه‌دهندهٔ آنالیتیکس شکست خورد (خطا بلعیده نمی‌شود؛ جدا از برنامه گزارش شد).',
    suggestion: 'provider را موقتاً غیرفعال کنید؛ خطای اصلی در cause است.',
  },
  'ZEN-1902': {
    domain: 'analytics',
    category: 'Security',
    message: 'رضایت کاربر لازم است.',
    suggestion: 'قبل از track، consent manager را فعال کنید (GDPR).',
  },
  // theme (ZEN-2000..2099)
  'ZEN-2001': {
    domain: 'theme',
    category: 'Validation',
    message: 'token تم نامعتبر.',
    suggestion: 'نام token در تعریف theme وجود دارد و مقدار CSS-valid است.',
  },
  'ZEN-2002': {
    domain: 'theme',
    category: 'Runtime',
    message: 'ذخیره‌گاه تم در دسترس نیست.',
    suggestion: 'storage تم را memory یا جایگزین قرار دهید.',
  },
  // auth-oauth (ZEN-2100..2199)
  'ZEN-2101': {
    domain: 'auth-oauth',
    category: 'Security',
    message: 'state مطابق نیست (احتمال CSRF).',
    suggestion: 'flow را از همان مرورگر/تب ادامه دهید؛ state یک‌بارمصرف است (RFC 6749 §10.12).',
  },
  'ZEN-2102': {
    domain: 'auth-oauth',
    category: 'Security',
    message: 'id_token نامعتبر.',
    suggestion: 'issuer/audience و امضا (JWKS) را بررسی کنید.',
  },
  'ZEN-2103': {
    domain: 'auth-oauth',
    category: 'Network',
    message: 'discovery شکست خورد.',
    suggestion: 'آدرس /.well-known/openid-configuration سرویس را بررسی کنید.',
  },
  'ZEN-2104': {
    domain: 'auth-oauth',
    category: 'Security',
    message: 'refresh منقضی.',
    suggestion: 'کاربر را مجدداً وارد کنید (re-auth)؛ refresh token را تمدید سیاست‌پذیر کنید.',
  },
  'ZEN-2105': {
    domain: 'auth-oauth',
    category: 'Security',
    message: 'callback بدون code.',
    suggestion: 'response_type=code را در authorize بگذارید؛ error را از query parse کنید.',
  },
  // feature-flags (ZEN-2200..2299)
  'ZEN-2201': {
    domain: 'feature-flags',
    category: 'Runtime',
    message: 'پرچم تعریف نشده (فقط dev).',
    suggestion: 'flag را در registry ثبت کنید؛ در prod مقدار default مصرف می‌شود.',
  },
  'ZEN-2202': {
    domain: 'feature-flags',
    category: 'Runtime',
    message: 'بارگذاری source پرچم‌ها شکست خورد.',
    suggestion: 'منبع (remote/file) و شبکه را بررسی کنید؛ fallback cached در کار است.',
  },
  // createApp / runtime-core (ZEN-2300..2399)
  'ZEN-2301': {
    domain: 'runtime-core',
    category: 'Runtime',
    message: 'onMount/onUnmount/onUpdate خارج از محدودهٔ directive/کامپوننت.',
    suggestion: 'این قلاب‌ها فقط حین اجرای تابع directive یا setup کامپوننت مجازند.',
  },
  'ZEN-2302': {
    domain: 'runtime-core',
    category: 'Validation',
    message: 'تعارض directive ساختاری روی یک المان.',
    suggestion:
      'zen-if و zen-for (و همتایان else) را روی المان‌های جدا بگذارید (SPEC §۲.۸ priority).',
  },
  'ZEN-2303': {
    domain: 'runtime-core',
    category: 'Validation',
    message: 'zen-for بدون zen-key.',
    suggestion: 'zen-key یکتا و پایدار برای هر آیتم بگذارید (همان ZEN-101؛ برای API جدید core).',
  },
  'ZEN-2310': {
    domain: 'runtime-core',
    category: 'Runtime',
    message: 'عدم تطابق hydration.',
    suggestion:
      'در dev diff چاپ می‌شود؛ در prod بازرندر موضعی انجام می‌گیرد. خروجی SSR/client را یکسان کنید.',
  },
  'ZEN-2320': {
    domain: 'runtime-core',
    category: 'Runtime',
    message: 'نسخهٔ پکیج‌ها lockstep نیست (assertCompatible).',
    suggestion:
      'همهٔ @zenith/* را به یک نسخه (DEC-026) برسانید؛ نسخه‌های مشاهده‌شده در details است.',
  },
  // devtools-core (ZEN-2400..2499)
  'ZEN-2401': {
    domain: 'devtools-core',
    category: 'Runtime',
    message: 'نسخهٔ hook ناسازگار.',
    suggestion: 'devtools و runtime را هم‌نسخه کنید (lockstep، DEC-026).',
  },
  'ZEN-2402': {
    domain: 'devtools-core',
    category: 'Runtime',
    message: 'snapshot نامعتبر.',
    suggestion: 'ساختار snapshot §devtools-core را رعایت کنید؛ فیلدهای اجباری را بفرستید.',
  },
  // tooling: cli / language-server / unplugin / mock (ZEN-2500..2599)
  'ZEN-2501': {
    domain: 'tooling',
    category: 'Validation',
    message: 'نام پروژه نامعتبر.',
    suggestion: 'فقط [a-z0-9-_.]؛ بدون ..، مسیر مطلق یا جداکننده (create-zenith §۳.۹).',
  },
  'ZEN-2510': {
    domain: 'tooling',
    category: 'Runtime',
    message: 'متادیتا (zenith.meta.json) بارگذاری نشد.',
    suggestion: 'build با meta:true اجرا شده و مسیر فایل درست است؟',
  },
  'ZEN-2520': {
    domain: 'tooling',
    category: 'Runtime',
    message: 'پلاگین روی این bundler پشتیبانی نمی‌شود.',
    suggestion: 'unplugin فقط rollup/vite/webpack/rspack را پشتیبانی می‌کند (SPEC §۴.۴).',
  },
  'ZEN-2521': {
    domain: 'tooling',
    category: 'Runtime',
    message: 'HMR ناسازگار.',
    suggestion: 'نسخهٔ bundler/پلاگین را تطبیق یا HMR را غیرفعال کنید.',
  },
  'ZEN-2530': {
    domain: 'tooling',
    category: 'Runtime',
    message: 'درخواست بدون handler (mock).',
    suggestion: 'handler متناظر ثبت یا onUnhandledRequest را bypass کنید؛ مسیر/متد در details است.',
  },
  'ZEN-2531': {
    domain: 'tooling',
    category: 'Runtime',
    message: 'handler دوبار پاسخ داد (mock).',
    suggestion: 'هر resolver فقط یک respond() صدا بزند (passthrough با respond ترکیب نشود).',
  },
  // ── cli (ZEN-9000..9099) — #102: قوانین zenith check (جانشین کدهای قدیمی Z001..Z820)
  'ZEN-9001': {
    domain: 'cli',
    category: 'Internal',
    message: 'خواندن فایل ممکن نیست (check).',
    suggestion: 'مجوز/مسیر فایل را بررسی کنید (جایگزین Z001 قدیمی).',
  },
  'ZEN-9010': {
    domain: 'cli',
    category: 'Security',
    message: 'compileAndRender حذف‌شده (نام‌امن) استفاده شده است.',
    suggestion: 'از zen-text یا zen-html با عبارت پیش‌کتبهٔ امن استفاده کنید (جایگزین Z100 قدیمی).',
  },
  'ZEN-9011': {
    domain: 'cli',
    category: 'Security',
    message: 'استفاده از eval() یا new Function() در <script>.',
    suggestion: 'الگوی eval برای امنیت (XSS) در Zenith ممنوع است (جایگزین Z101 قدیمی).',
  },
  'ZEN-9020': {
    domain: 'cli',
    category: 'Compiler',
    message: 'directive منسوخ‌شده.',
    suggestion: 'جایگزین رسمی را طبق جدول DEPRECATED_DIRECTIVES به‌کار ببرید (جایگزین Z200 قدیمی).',
  },
  'ZEN-9021': {
    domain: 'cli',
    category: 'Compiler',
    message: 'directive ناشناخته.',
    suggestion: 'املای zen-* را با فهرست directiveهای معتبر بسنجید (جایگزین Z201 قدیمی).',
  },
  'ZEN-9030': {
    domain: 'cli',
    category: 'Runtime',
    message: 'zen-for بدون zen-key.',
    suggestion:
      'zen-key یکتا برای هر آیتم اضافه کنید (DOM thrashing/state loss؛ جایگزین Z300 قدیمی).',
  },
  'ZEN-9031': {
    domain: 'cli',
    category: 'Compiler',
    message: 'zen-text با عبارت خالی.',
    suggestion: 'عبارت معتبر بدهید یا directive را حذف کنید (جایگزین Z301 قدیمی).',
  },
  'ZEN-9032': {
    domain: 'cli',
    category: 'Compiler',
    message: 'zen-if با عبارت خالی.',
    suggestion: 'عبارت شرطی معتبر بدهید (جایگزین Z302 قدیمی).',
  },
  'ZEN-9040': {
    domain: 'cli',
    category: 'Security',
    message: 'zen-html با متغیر قابل‌تزریق احتمالی.',
    suggestion: 'ورودی را sanitizeHTML کنید یا allowlist پیش‌فرض را حفظ کنید (جایگزین Z400 قدیمی).',
  },
  'ZEN-9050': {
    domain: 'cli',
    category: 'Security',
    message: 'الگوی دایرکتوری‌تراورسال در مسیر.',
    suggestion: 'مسیر را به ریشهٔ پروژه محدود کنید (جایگزین Z500 قدیمی).',
  },
  'ZEN-9060': {
    domain: 'cli',
    category: 'Security',
    message: 'secret احتمالی در کد.',
    suggestion: 'کلید/توکن را به env منتقل کنید (جایگزین Z600 قدیمی).',
  },
  'ZEN-9061': {
    domain: 'cli',
    category: 'Security',
    message: 'referrer ضعیف در head.',
    suggestion:
      'referrerpolicy را no-referrer یا strict-origin-when-cross-origin کنید (جایگزین Z601 قدیمی).',
  },
  'ZEN-9070': {
    domain: 'cli',
    category: 'Network',
    message: 'fetch با scheme ناامن (http).',
    suggestion: 'https استفاده کنید یا الگوی URL را بازبینی کنید (جایگزین Z700 قدیمی).',
  },
  'ZEN-9080': {
    domain: 'cli',
    category: 'Security',
    message: 'attribute رویدادی (on*) در template.',
    suggestion: 'از zen-click/zen-action (event delegation امن) استفاده کنید (جایگزین Z800 قدیمی).',
  },
  'ZEN-9081': {
    domain: 'cli',
    category: 'Security',
    message: 'iframe بدون sandbox.',
    suggestion: 'sandbox محدودکننده برای iframe بگذارید (جایگزین Z810 قدیمی).',
  },
  'ZEN-9082': {
    domain: 'cli',
    category: 'Security',
    message: 'link خارجی بدون rel=noopener.',
    suggestion: 'rel="noopener noreferrer" به target=_blank اضافه کنید (جایگزین Z820 قدیمی).',
  },
};

/**
 * خطای ZenithError از کاتالوگ رزروشده (۴رقمی) — پیام/suggestion/docsUrl خودکار.
 * @throws اگر code در catalog نباشد (جلوگیری از مصرف کد ثبت‌نشده).
 */
// ─────────────────────────────────────────────────────────────
// Locale لایهٔ ترجمهٔ پیام‌ها (#102)
// ─────────────────────────────────────────────────────────────

/** زبان پیام‌های خطا (fa پیش‌فرض کانونیک؛ en ترجمهٔ کاتالوگ). */
export type ErrorLocale = 'fa' | 'en';

let currentLocale: ErrorLocale = 'fa';

/** #102: انتخاب زبان پیام‌های کاتالوگ (اثر global؛ به‌کارگیری در ابزارها/CLI). */
export function setErrorLocale(locale: ErrorLocale): void {
  currentLocale = locale;
}

/** #102: زبان جاری پیام‌های خطا. */
export function getErrorLocale(): ErrorLocale {
  return currentLocale;
}

/**
 * نمونهٔ انگلیسی message/suggestion هر کد رزورشده (#102).
 * fa همچنان اولیه و کانونیک است؛ کلیدها باید با RESERVED_ERROR_CODES یکسان باشند
 * (تست یکتایی در wave6-batch5 این را قفل می‌کند).
 */
export const ERROR_MESSAGES_EN: Readonly<Record<string, { message: string; suggestion: string }>> =
  {
    'ZEN-1001': {
      message: 'Invalid option: type or value at the given path does not satisfy the schema.',
      suggestion: 'Fix the value to the type expected by the schema; the error path is in details.',
    },
    'ZEN-1002': {
      message: 'Unknown key in options.',
      suggestion: 'Check the key spelling; allowed keys are listed in details.',
    },
    'ZEN-1003': {
      message: 'Malformed JSON in attribute.',
      suggestion: 'The attribute value must be valid JSON (no trailing commas, no single quotes).',
    },
    'ZEN-1004': {
      message: 'Value out of allowed range.',
      suggestion: 'Keep the value between the min/max declared in details.',
    },
    'ZEN-1090': {
      message: 'Invalid argument to option validation function.',
      suggestion:
        'See the schema docs for the function signature; the second argument must be a valid schema.',
    },
    'ZEN-1091': {
      message: 'Logger sink is broken (error while writing a log record).',
      suggestion: 'Replace or remove the sink; the error is reported once and never loops.',
    },
    'ZEN-1101': {
      message: 'Storage unavailable (e.g. browser private mode).',
      suggestion: 'Fall back to the memory adapter or present a graceful notice to the user.',
    },
    'ZEN-1102': {
      message: 'Storage quota exceeded.',
      suggestion: 'Prune old keys or switch to the IndexedDB adapter.',
    },
    'ZEN-1103': {
      message: 'Data migration failed.',
      suggestion: 'Check the migrate function; old data may need pruning or re-versioning.',
    },
    'ZEN-1104': {
      message: 'Stored data is corrupt/unparseable.',
      suggestion: 'The corrupt key is removed; rebuild the data source.',
    },
    'ZEN-1201': {
      message: 'Invalid ttl.',
      suggestion: 'ttl must be an integer >= 0 (ms); 0 means no expiry.',
    },
    'ZEN-1202': {
      message: 'Cache loader failed.',
      suggestion: 'See cause for the original error; check retry/fallback.',
    },
    'ZEN-1301': {
      message: 'Date outside the supported Jalali calendar range.',
      suggestion: 'Allowed range is 1201..1500 SH (DEC-020: throw instead of warn).',
    },
    'ZEN-1302': {
      message: 'Invalid date format.',
      suggestion: 'Allowed tokens: YYYY YY MM M DD D MMM MMMM; remove unknown combinations.',
    },
    'ZEN-1303': {
      message: 'Invalid date (does not exist).',
      suggestion: 'Check day/month (e.g. Esfand 30 does not have 31).',
    },
    'ZEN-1311': {
      message: 'Message key not found.',
      suggestion: 'Add the key to the bundle or change the missing policy (throw/warn/empty).',
    },
    'ZEN-1312': {
      message: 'Invalid ICU format.',
      suggestion: 'Validate the {plural, select, ...} structure against the i18n docs.',
    },
    'ZEN-1313': {
      message: 'Unsupported locale.',
      suggestion: 'Register the locale in the fallback list or load its bundle.',
    },
    'ZEN-1314': {
      message: 'Loading messages failed.',
      suggestion: 'Check the loader path and network; the original error is in cause.',
    },
    'ZEN-1401': {
      message: 'No focusable element found for focus-trap.',
      suggestion: 'Place at least one focusable element inside the container or disable the trap.',
    },
    'ZEN-1402': {
      message: 'Nested trap with unsupported order.',
      suggestion: 'Use the internal trap stack; do not nest traps manually.',
    },
    'ZEN-1403': {
      message: 'aria-* attribute incompatible with the element role.',
      suggestion: 'Match role/aria with WAI-ARIA (ARIA in HTML).',
    },
    'ZEN-1501': {
      message: 'Tag not allowed.',
      suggestion: 'See the §head allowlist; body tags are forbidden in head.',
    },
    'ZEN-1502': {
      message: 'Invalid JSON-LD.',
      suggestion: 'Serialize the object with JSON.stringify and check schema.org.',
    },
    'ZEN-1503': {
      message: 'Tag count exceeded maxTags.',
      suggestion: 'Merge tags or knowingly raise maxTags.',
    },
    'ZEN-1601': {
      message: 'Trigger element not found.',
      suggestion: 'Fix the trigger selector or verify it is rendered.',
    },
    'ZEN-1602': {
      message: 'zen-tab without a matching zen-tabpanel.',
      suggestion: 'Give every tab a panel with a matching aria-controls.',
    },
    'ZEN-1603': {
      message: 'Value outside the options.',
      suggestion: 'value must be one of the options (or the allowed placeholder).',
    },
    'ZEN-1604': {
      message: 'Portal has no target.',
      suggestion: 'The portal target must point to an element present in the DOM.',
    },
    'ZEN-1701': {
      message: 'Connection failed.',
      suggestion: 'Check URL/network; automatic backoff is retrying.',
    },
    'ZEN-1702': {
      message: 'Invalid message (parse failed).',
      suggestion: 'Match the message format (default: JSON) with the service parser.',
    },
    'ZEN-1703': {
      message: 'Insecure protocol: ws:// on an https page.',
      suggestion: 'Use wss:// (mixed-content).',
    },
    'ZEN-1704': {
      message: 'Send queue full.',
      suggestion: 'Reduce send rate or raise maxQueueSize; dropped messages are in details.',
    },
    'ZEN-1705': {
      message: 'Heartbeat timeout.',
      suggestion: 'Check the service heartbeatInterval and the connection; auto reconnect starts.',
    },
    'ZEN-1801': {
      message: 'SSR render stopped by timeout.',
      suggestion: 'Increase renderTimeoutMs or move slow path data into suspense.',
    },
    'ZEN-1802': {
      message: 'Invalid template: no output marker.',
      suggestion: 'Put <!--zen-outlet--> (or the configured marker) inside the template.',
    },
    'ZEN-1803': {
      message: 'AsyncLocalStorage unavailable in this runtime.',
      suggestion: 'Enable the explicit context (domImpl/ALS-free path #92) (DEC-022).',
    },
    'ZEN-1811': {
      message: 'Unsupported runtime.',
      suggestion: 'Choose Node >=18.19, Cloudflare Workers or Deno (DEC-027).',
    },
    'ZEN-1812': {
      message: 'DOM implementation not installed.',
      suggestion: 'Install linkedom or happy-dom as a dependency (domImpl).',
    },
    'ZEN-1821': {
      message: 'Route failed to render during SSG.',
      suggestion: 'Verify the path exists in routes/paths and prerender passed.',
    },
    'ZEN-1822': {
      message: 'Data unavailable at build time.',
      suggestion: 'Make the data source available during build or mark the route CSR/ISR.',
    },
    'ZEN-1901': {
      message: 'Analytics provider failed (error not swallowed; reported separately).',
      suggestion: 'Temporarily disable the provider; the original error is in cause.',
    },
    'ZEN-1902': {
      message: 'User consent required.',
      suggestion: 'Enable the consent manager before tracking (GDPR).',
    },
    'ZEN-2001': {
      message: 'Invalid theme token.',
      suggestion: 'Ensure the token exists in the theme definition and the value is CSS-valid.',
    },
    'ZEN-2002': {
      message: 'Theme storage unavailable.',
      suggestion: 'Use the memory storage or an alternative for theme.',
    },
    'ZEN-2101': {
      message: 'state mismatch (possible CSRF).',
      suggestion:
        'Continue the flow from the same browser/tab; state is single-use (RFC 6749 §10.12).',
    },
    'ZEN-2102': {
      message: 'Invalid id_token.',
      suggestion: 'Check issuer/audience and the (JWKS) signature.',
    },
    'ZEN-2103': {
      message: 'Discovery failed.',
      suggestion: 'Check the /.well-known/openid-configuration address of the service.',
    },
    'ZEN-2104': {
      message: 'Refresh expired.',
      suggestion: 'Sign the user in again (re-auth); make refresh token renewal policy-driven.',
    },
    'ZEN-2105': {
      message: 'Callback without code.',
      suggestion: 'Set response_type=code in authorize; parse error from the query.',
    },
    'ZEN-2201': {
      message: 'Flag not defined (dev only).',
      suggestion: 'Register the flag in the registry; in prod the default value is used.',
    },
    'ZEN-2202': {
      message: 'Failed to load the flag source.',
      suggestion: 'Check the source (remote/file) and network; the cached fallback is in use.',
    },
    'ZEN-2301': {
      message: 'onMount/onUnmount/onUpdate outside directive/component scope.',
      suggestion:
        'These hooks are only allowed while running a directive function or component setup.',
    },
    'ZEN-2302': {
      message: 'Conflicting structural directives on one element.',
      suggestion: 'Keep only one of zen-if/zen-for/zen-switch/and similar per element.',
    },
    'ZEN-2303': {
      message: 'zen-for without zen-key.',
      suggestion: 'Give each item a unique stable zen-key (same as ZEN-101; for the new core API).',
    },
    'ZEN-2310': {
      message: 'Hydration mismatch.',
      suggestion: 'Server and client must render identical markup; check data and markers.',
    },
    'ZEN-2320': {
      message: 'Package versions not in lockstep (assertCompatible).',
      suggestion: 'All @zenith/* packages must share one version; run npm ls @zenith.',
    },
    'ZEN-2401': {
      message: 'Incompatible hook version.',
      suggestion: 'Keep devtools and runtime on the same version (lockstep, DEC-026).',
    },
    'ZEN-2402': {
      message: 'Invalid snapshot.',
      suggestion: 'Follow the §devtools-core snapshot structure; send the required fields.',
    },
    'ZEN-2501': {
      message: 'Invalid project name.',
      suggestion: 'Only [a-z0-9-_.]; no "..", absolute path or separator (create-zenith §3.9).',
    },
    'ZEN-2510': {
      message: 'Metadata (zenith.meta.json) failed to load.',
      suggestion: 'Was the build run with meta:true and is the file path correct?',
    },
    'ZEN-2520': {
      message: 'Plugin not supported on this bundler.',
      suggestion: 'unplugin supports only rollup/vite/webpack/rspack (SPEC §4.4).',
    },
    'ZEN-2521': {
      message: 'Incompatible HMR.',
      suggestion: 'Match bundler/plugin versions or disable HMR.',
    },
    'ZEN-2530': {
      message: 'Request without handler (mock).',
      suggestion:
        'Register the matching handler or set onUnhandledRequest to bypass; path/method in details.',
    },
    'ZEN-2531': {
      message: 'Handler responded twice (mock).',
      suggestion:
        'Each resolver must call respond() only once (do not combine passthrough with respond).',
    },
    'ZEN-9001': {
      message: 'Unable to read file (check).',
      suggestion: 'Check file permissions/path (replaces legacy Z001).',
    },
    'ZEN-9010': {
      message: 'Removed compileAndRender is used (unsafe).',
      suggestion:
        'Use zen-text or zen-html with safe pre-compiled expressions (replaces legacy Z100).',
    },
    'ZEN-9011': {
      message: 'Use of eval() or new Function() in <script>.',
      suggestion:
        'The eval pattern is forbidden in Zenith for security/XSS (replaces legacy Z101).',
    },
    'ZEN-9020': {
      message: 'Deprecated directive.',
      suggestion: 'Use the official replacement per DEPRECATED_DIRECTIVES (replaces legacy Z200).',
    },
    'ZEN-9021': {
      message: 'Unknown directive.',
      suggestion:
        'Check the zen-* spelling against the valid directive list (replaces legacy Z201).',
    },
    'ZEN-9030': {
      message: 'zen-for without zen-key.',
      suggestion: 'Add a unique zen-key per item (DOM thrashing/state loss; replaces legacy Z300).',
    },
    'ZEN-9031': {
      message: 'zen-text with an empty expression.',
      suggestion: 'Provide a valid expression or remove the directive (replaces legacy Z301).',
    },
    'ZEN-9032': {
      message: 'zen-if with an empty expression.',
      suggestion: 'Provide a valid conditional expression (replaces legacy Z302).',
    },
    'ZEN-9040': {
      message: 'zen-html with a probably injectable variable.',
      suggestion:
        'Sanitize input with sanitizeHTML or keep the default allowlist (replaces legacy Z400).',
    },
    'ZEN-9050': {
      message: 'Directory traversal pattern in path.',
      suggestion: 'Constrain paths to the project root (replaces legacy Z500).',
    },
    'ZEN-9060': {
      message: 'Potential secret in code.',
      suggestion: 'Move keys/tokens to env (replaces legacy Z600).',
    },
    'ZEN-9061': {
      message: 'Weak referrer policy in head.',
      suggestion:
        'Set referrerpolicy to no-referrer or strict-origin-when-cross-origin (replaces legacy Z601).',
    },
    'ZEN-9070': {
      message: 'fetch with an insecure scheme (http).',
      suggestion: 'Use https or review the URL pattern (replaces legacy Z700).',
    },
    'ZEN-9080': {
      message: 'Event attribute (on*) in template.',
      suggestion: 'Use zen-click/zen-action (safe event delegation) (replaces legacy Z800).',
    },
    'ZEN-9081': {
      message: 'iframe without sandbox.',
      suggestion: 'Add a restrictive sandbox to the iframe (replaces legacy Z810).',
    },
    'ZEN-9082': {
      message: 'External link without rel=noopener.',
      suggestion: 'Add rel="noopener noreferrer" to target=_blank (replaces legacy Z820).',
    },
  };

/**
 * توضیح استاتیک انگلیسی کدهای سه‌رقمی قدیمی (#102).
 * پیام runtime این کدها template/پارامتری است (مثل نام متغیر) و همچنان فارسی
 * ساخته می‌شود؛ این نقشه برای مستندات و layout ترجمهٔ سطح کد است.
 */
export const LEGACY_ERROR_MESSAGES_EN: Readonly<Record<string, string>> = {
  'ZEN-001': 'Variable is not defined in the context.',
  'ZEN-002': 'Access to a forbidden property in the expression (security).',
  'ZEN-003': 'Forbidden identifier in the expression (security).',
  'ZEN-004': 'Expression syntax error.',
  'ZEN-005': 'The expression is not a function.',
  'ZEN-006': 'Unknown operator in the expression.',
  'ZEN-007': 'Unknown node type in the expression AST.',
  'ZEN-101': 'zen-for requires zen-key.',
  'ZEN-102': 'Invalid zen-for syntax.',
  'ZEN-103': 'zen-for element has no parent.',
  'ZEN-104': 'zen-if element has no parent.',
  'ZEN-105': 'Directive expression evaluation failed.',
  'ZEN-106': 'Component not found in the registry.',
  'ZEN-107': 'Component dispose failed.',
  'ZEN-201': 'Resource has been destroyed.',
  'ZEN-202': 'HTTP error while fetching the resource.',
  'ZEN-203': 'Resource URL evaluation failed.',
  'ZEN-204': 'Resource signal not found.',
  'ZEN-205': 'Resource mutation failed.',
  'ZEN-301': 'SSR requires a DOM implementation (JSDOM-compatible).',
  'ZEN-302': 'Root element not found for SSR.',
  'ZEN-303': 'AsyncLocalStorage unavailable for SSR isolation.',
  'ZEN-304': 'Hydration mismatch between server and client markup.',
  'ZEN-401': 'XSS blocked: untrusted markup neutralized.',
  'ZEN-402': 'Sanitization failed: input rejected.',
  'ZEN-403': 'Secure random source unavailable.',
  'ZEN-404': 'Insecure token storage detected.',
  'ZEN-501': 'Unknown directive at compile time.',
  'ZEN-502': 'Compile-time expression error.',
  'ZEN-503': 'Compile-time syntax error.',
  'ZEN-504': 'Missing import at compile time.',
  'ZEN-551': 'Sandbox (VM) runtime error.',
  'ZEN-552': 'Sandbox timeout.',
  'ZEN-553': 'Sandbox memory limit exceeded.',
  'ZEN-601': 'Route not found.',
  'ZEN-602': 'Lazy route loading failed.',
  'ZEN-603': 'Navigation aborted by a guard.',
  'ZEN-701': 'Form validation failed.',
  'ZEN-702': 'Form schema invalid.',
  'ZEN-801': 'Slot not found.',
  'ZEN-802': 'Required prop missing.',
  'ZEN-901': 'Unknown internal error.',
  'ZEN-905': 'Internal runtime failure.',
  'ZEN-906': 'Internal reactivity failure.',
  'ZEN-907': 'Developer precondition violated (assert).',
  'ZEN-908': 'Internal hydration mismatch.',
};

/**
 * #102: message/suggestion یک کد رزورشده بر اساس زبان.
 * اگر `locale` حذف شود از زبان جاری (setErrorLocale) استفاده می‌کند. کدهای
 * ناشناخته undefined برمی‌گردانند.
 */
export function getErrorMessage(
  code: string,
  opts?: { locale?: ErrorLocale },
): { message: string; suggestion: string } | undefined {
  const locale = opts?.locale ?? currentLocale;
  const meta = RESERVED_ERROR_CODES[code];
  if (!meta) return undefined;
  if (locale === 'en')
    return ERROR_MESSAGES_EN[code] ?? { message: meta.message, suggestion: meta.suggestion };
  return { message: meta.message, suggestion: meta.suggestion };
}

export function createReservedError(
  code: keyof typeof RESERVED_ERROR_CODES | string,
  opts?: { details?: Record<string, unknown>; context?: Record<string, unknown>; cause?: unknown },
): ZenithError {
  const meta = RESERVED_ERROR_CODES[code];
  if (!meta) {
    throw new Error(
      `[errors] کد «${String(code)}» در catalog رزورشده (#171) ثبت نشده؛ ` +
        `ابتدا آن را با بازهٔ درست اضافه کنید (DEC-020).`,
    );
  }
  // #102: با setErrorLocale('en') پیام‌های کاتالوگ انگلیسی تولید می‌شوند.
  const localized = getErrorMessage(code) ?? { message: meta.message, suggestion: meta.suggestion };
  return new ZenithError({
    code,
    category: meta.category,
    // دستورالعمل §۱۰: پیام‌ها `[CODE] prefix` دارند تا assert/regex روی message
    // کار کند (#112 لینک docs را اضافه می‌کند؛ #171 کاتالوگ).
    message: `[${code}] ${localized.message}`,
    suggestion: localized.suggestion,
    docsUrl: errorDocsUrl(code),
    details: opts?.details,
    context: opts?.context,
    cause: opts?.cause,
  });
}

/**
 * رجیستری رسمی هشدارهای deprecation (DEC-019؛ سیاست #58؛ حذف در ۲.۰ طبق DEC-026).
 * `deprecate()` همین کدها را مصرف می‌کند؛ ثبت‌کردنشان در errors یعنی #171
 * فضای `ZEN-DEPR-xxx` را رسمی کرده است.
 */
export const DEPRECATION_CODES: Readonly<
  Record<string, { api: string; replacement: string; removedIn: string }>
> = {
  'ZEN-DEPR-001': {
    api: 'processVirtualList',
    replacement: 'createVirtualList',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-002': {
    api: 'enterTransition',
    replacement: 'createTransition(name).enter(el)',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-003': {
    api: 'leaveTransition',
    replacement: 'createTransition(name).leave(el)',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-004': {
    api: 'animateGroup',
    replacement: 'createTransition(name) shared controller',
    removedIn: '2.0.0',
  },
  // #144 — نام یکتای clearHttpCache (رفع clearCache تکراری در http).
  'ZEN-DEPR-005': {
    api: 'clearCache (http)',
    replacement: 'clearHttpCache',
    removedIn: '2.0.0',
  },
  // #146 — توابع جلالی @zenith/i18n به @zenith/jalali منتقل شدند (SPEC §۲.۶
  // «مهاجرت: alias + deprecate»؛ حذف فقط در 2.0 طبق DEC-026).
  'ZEN-DEPR-006': {
    api: 'toJalali (i18n)',
    replacement: '@zenith/jalali toJalaliParts/formatJalali',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-007': {
    api: 'fromJalali (i18n)',
    replacement: '@zenith/jalali fromJalaliParts',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-008': {
    api: 'parseJalaliParts (i18n)',
    replacement: '@zenith/jalali toJalaliParts',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-009': {
    api: 'formatJalali (i18n)',
    replacement: '@zenith/jalali formatJalali',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-010': {
    api: 'jalaliNow (i18n)',
    replacement: '@zenith/jalali jalaliNow',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-011': {
    api: 'jalaliMonthDays (i18n)',
    replacement: '@zenith/jalali monthDays',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-012': {
    api: 'jalaliMonthName (i18n)',
    replacement: '@zenith/jalali monthName',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-013': {
    api: 'isJalaliLeap (i18n)',
    replacement: '@zenith/jalali isLeap',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-014': {
    api: 'compareJalali (i18n)',
    replacement: '@zenith/jalali compareJalali',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-015': {
    api: 'addDaysJalali (i18n)',
    replacement: '@zenith/jalali addDays',
    removedIn: '2.0.0',
  },
  // #142 — adapters ساخت schema در @zenith/form به @zenith/schema منتقل شدند
  // (SPEC §۲.۲ «مهاجرت: alias + deprecate»؛ منطق خالص در /zod و /json-schema).
  'ZEN-DEPR-016': {
    api: 'fromZod (form)',
    replacement: '@zenith/schema/zod fromZod',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-017': {
    api: 'validateWithZod (form)',
    replacement: '@zenith/schema/zod validateWithZod',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-018': {
    api: 'fromJsonSchema (form)',
    replacement: '@zenith/schema/json-schema fromJsonSchema',
    removedIn: '2.0.0',
  },
  // #116 — پروتکل یکسان cleanup: نام‌گذاری lifecycle به Disposable.dispose().
  'ZEN-DEPR-019': {
    api: 'ActionRegistry.destroy()',
    replacement: 'ActionRegistry.dispose()',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-020': {
    api: 'Auth.destroy()',
    replacement: 'Auth.dispose()',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-021': {
    api: 'CrudEngine.destroy()',
    replacement: 'CrudEngine.dispose()',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-022': {
    api: 'FormStore.destroy()',
    replacement: 'FormStore.dispose()',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-023': {
    api: 'Resource.destroy()',
    replacement: 'Resource.dispose()',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-024': {
    api: 'SWController.destroy()',
    replacement: 'SWController.dispose()',
    removedIn: '2.0.0',
  },
  // #117 — یکدست‌سازی نام/مسیر: schedule alias شد؛ نصب stateful تک‌مسیر.
  'ZEN-DEPR-025': {
    api: 'schedule() (@zenith/scheduler)',
    replacement: 'scheduleEffect()',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-026': {
    api: 'installStatefulComponents()',
    replacement: 'Zen.use(ZenithStatefulPlugin)',
    removedIn: '2.0.0',
  },
  // #147 — انتقال رجیستری devtools از @zenith/state به @zenith/devtools-core (SPEC §۲.۷).
  'ZEN-DEPR-027': {
    api: 'registerSignal (@zenith/state)',
    replacement: '@zenith/devtools-core registerSignal / installDevtoolsCore',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-028': {
    api: 'recordStateChange (@zenith/state)',
    replacement: '@zenith/devtools-core recordStateChange / installDevtoolsCore',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-029': {
    api: 'getAllSignals (@zenith/state)',
    replacement: '@zenith/devtools-core getAllSignals',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-030': {
    api: 'getSignalInfo (@zenith/state)',
    replacement: '@zenith/devtools-core getSignalInfo',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-031': {
    api: 'getStateTimeline (@zenith/state)',
    replacement: '@zenith/devtools-core getTimeline',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-032': {
    api: 'onStateChange (@zenith/state)',
    replacement: '@zenith/devtools-core onStateChange',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-033': {
    api: 'nameSignal (@zenith/state)',
    replacement: '@zenith/devtools-core nameSignal',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-034': {
    api: 'clearRegistry (@zenith/state)',
    replacement: '@zenith/devtools-core clearRegistry',
    removedIn: '2.0.0',
  },
  // #55 — حذف آرگومان‌های positional از توابع با >2 پارامتر (تبدیل به options object).
  'ZEN-DEPR-035': {
    api: 'createMutation(fn, options)',
    replacement: 'createMutation({ fn, ...options })',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-036': {
    api: 'createInfiniteQuery(key, fn, options)',
    replacement: 'createInfiniteQuery({ key, fn, ...options })',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-037': {
    api: 'trackPromise(promise, suspense, key, timeout)',
    replacement: 'trackPromise(promise, { suspense, key, timeout })',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-038': {
    api: 'withTimeout(promise, ms, message)',
    replacement: 'withTimeout(promise, { ms, message })',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-039': {
    api: 'animate(el, keyframes, duration, easing, delay, fill, onFinish)',
    replacement: 'animate(el, { keyframes, duration, easing, delay, fill, onFinish })',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-040': {
    api: 'animateEnter(el, name, duration, easing, onFinish)',
    replacement: 'animateEnter(el, { name, duration, easing, onFinish })',
    removedIn: '2.0.0',
  },
  'ZEN-DEPR-041': {
    api: 'animateLeave(el, name, duration, easing, onFinish)',
    replacement: 'animateLeave(el, { name, duration, easing, onFinish })',
    removedIn: '2.0.0',
  },
};

// ─────────────────────────────────────────────────────────────
// Deprecation Warnings (#47, #58)
// ─────────────────────────────────────────────────────────────

/**
 * هشدار deprecation یک‌باره برای یک API قدیمی (مطابق سیاست #58: هشدار
 * یک‌باره با کد ZEN-DEPR-xxx، حذف فقط در major بعدی).
 *
 * - فقط در dev فعال است (تا زمانی که `globalThis.__ZENITH_DEV__ === false`
 *   تنظیم نشده باشد) — الگوی یکسان با ZEN-404 در auth (#62).
 * - به‌ازای هر `code` حداکثر یک‌بار لاگ می‌شود (Set سراسری).
 *
 * @param code کد ZEN-DEPR-xxx
 * @param oldName نام API قدیمی
 * @param replacement نام/API جایگزین
 * @param hint راهنمای اضافی اختیاری
 */
export function deprecate(code: string, oldName: string, replacement: string, hint?: string): void {
  if (typeof globalThis !== 'undefined' && (globalThis as any).__ZENITH_DEV__ === false) return;
  if (warnedDeprecations.has(code)) return;
  warnedDeprecations.add(code);
  if (typeof console === 'undefined' || typeof console.warn !== 'function') return;
  console.warn(
    `[Zenith] ${code}: \`${oldName}\` is deprecated and will be removed in the next major ` +
      `version. Use \`${replacement}\` instead.` +
      (hint ? ` ${hint}` : ''),
  );
}

const warnedDeprecations = new Set<string>();

/**
 * پاک‌سازی وضعیت «یک‌بار» هشدارها — فقط برای تست.
 */
export function resetDeprecationWarnings(): void {
  warnedDeprecations.clear();
}

// ─────────────────────────────────────────────────────────────
// Error Factory Functions
// ─────────────────────────────────────────────────────────────

/**
 * FEATURE (v1.0.0): خطای «متغیر تعریف‌نشده» با پیشنهاد typo correction.
 *
 * پیام اصلی: `Variable '$x' is not defined in context.`
 * پیام بهبودیافته: لیست متغیرهای available + پیشنهاد typo correction.
 */
export function variableNotDefinedError(
  varName: string,
  availableVars: string[] = [],
): ZenithError {
  // Levenshtein-like typo detection.
  const suggestion = findClosestMatch(varName, availableVars);

  const details: Record<string, unknown> = {};
  if (availableVars.length > 0) {
    details.availableVariables = availableVars;
  }
  if (suggestion) {
    details.suggestedVariable = suggestion;
  }

  return new ZenithError({
    code: ErrorCode.EXPRESSION_VARIABLE_NOT_DEFINED,
    category: 'Expression',
    message: `متغیر «${varName}» در context تعریف نشده است.`,
    suggestion: suggestion
      ? `آیا منظور شما «${suggestion}» بود؟ (اصلاح املا)`
      : availableVars.length > 0
        ? `متغیرهای موجود: ${availableVars.join('، ')}`
        : 'متغیری در context موجود نیست. مطمئن شوید state به‌درستی پاس داده شده.',
    details,
    context: { varName, availableVars },
  });
}

/**
 * FEATURE (v1.0.0): خطای «zen-key وجود ندارد» با مثال.
 */
export function zenForNoZenKeyError(expr: string): ZenithError {
  return new ZenithError({
    code: ErrorCode.RUNTIME_ZEN_FOR_NO_ZEN_KEY,
    category: 'Runtime',
    message: `دایرکتیو zen-for روی «${expr}» attribute های zen-key ندارد.`,
    suggestion:
      `برای keyed diffing صحیح، zen-key اضافه کنید:\n` +
      `  <li zen-for="item in $items" zen-key="item.id">\n` +
      `بدون zen-key، reordering باعث destroy و rebuild تمام DOM node ها می‌شود (کندتر).`,
    details: { expr },
    context: { expr },
  });
}

/**
 * FEATURE (v1.0.0): خطای «Resource destroyed» با راهنمای ردیابی.
 */
export function resourceDestroyedError(
  resourceName: string,
  operation: string,
  destroyStack?: string,
): ZenithError {
  return new ZenithError({
    code: ErrorCode.RESOURCE_DESTROYED,
    category: 'Resource',
    message: `Resource «${resourceName}» قبلاً dispose() شده است و عملیات «${operation}» مجاز نیست.`,
    suggestion:
      `این Resource با dispose() غیرفعال شده. برای ردیابی:\n` +
      `  ۱. در کد جستجو کنید: ${resourceName}.dispose()\n` +
      `  ۲. معمولاً در cleanup hooks (onUnmounted, useEffect cleanup) صدا زده می‌شود.\n` +
      `  ۳. برای revive کردن: ${resourceName}.reset()`,
    details: {
      resourceName,
      operation,
      destroyStack: destroyStack || 'Stack trace هنگام destroy() در دسترس نیست.',
    },
    context: { resourceName, operation },
  });
}

/**
 * FEATURE (v1.0.0): خطای SSR با تشخیص محیط.
 */
export function ssrEnvironmentError(
  issue: 'jsdom-missing' | 'als-unavailable' | 'no-root',
  details?: Record<string, unknown>,
): ZenithError {
  const isBrowser = typeof window !== 'undefined';
  const isNode = typeof process !== 'undefined' && process.versions?.node;

  let env = 'unknown';
  if (isBrowser) env = 'browser';
  else if (isNode) env = `Node.js ${process.versions.node}`;

  switch (issue) {
    case 'jsdom-missing':
      return new ZenithError({
        code: ErrorCode.SSR_JSDOM_REQUIRED,
        category: 'SSR',
        message: 'برای SSR به jsdom نیاز است اما نصب نیست.',
        suggestion:
          `jsdom را نصب کنید:\n` +
          `  npm install jsdom\n` +
          `  یا\n` +
          `  bun add jsdom\n\n` +
          `محیط فعلی: ${env}\n` +
          (isBrowser
            ? '⚠️ SSR در browser قابل اجرا نیست. این کد فقط در سرور (Node.js) کار می‌کند.'
            : ''),
        details: { environment: env, ...details },
        context: { issue, env },
      });

    case 'als-unavailable':
      return new ZenithError({
        code: ErrorCode.SSR_ASYNC_LOCAL_STORAGE_UNAVAILABLE,
        category: 'SSR',
        message: 'AsyncLocalStorage در دسترس نیست.',
        suggestion:
          `AsyncLocalStorage یک API داخلی Node.js است (node:async_hooks).\n` +
          `محیط فعلی: ${env}\n` +
          (isBrowser
            ? '⚠️ در browser، SSR پشتیبانی نمی‌شود.\n' +
              'اگر در browser هستید، از Zen.start مستقیم استفاده کنید (نه renderToString).'
            : 'Node.js 16+ لازم است. ورژن Node را بررسی کنید.'),
        details: { environment: env, ...details },
        context: { issue, env },
      });

    case 'no-root':
      return new ZenithError({
        code: ErrorCode.SSR_NO_ROOT_ELEMENT,
        category: 'SSR',
        message: 'عنصر root در HTML یافت نشد.',
        suggestion:
          `مطمئن شوید HTML ورودی یک body با محتوا دارد:\n` +
          `  <body><div id="app">...</div></body>\n` +
          `نه فقط: <body></body>`,
        details: { environment: env, ...details },
        context: { issue, env },
      });

    default:
      return new ZenithError({
        code: ErrorCode.INTERNAL_UNKNOWN,
        category: 'Internal',
        message: `خطای SSR ناشناخته: ${issue}`,
        details: { environment: env, ...details },
      });
  }
}

/**
 * FEATURE (v1.0.0): خطای امنیتی برای دسترسی ممنوعه.
 */
export function securityError(
  code: 'ZEN-002' | 'ZEN-003' | 'ZEN-401',
  property: string,
  isRuntime: boolean = false,
): ZenithError {
  const messages: Record<string, { msg: string; cat: ErrorCategory }> = {
    'ZEN-002': {
      msg: `دسترسی به پراپرتی «${property}» ممنوع است (prototype pollution).`,
      cat: 'Security',
    },
    'ZEN-003': {
      msg: `دسترسی به identifier «${property}» ممنوع است (global خطرناک).`,
      cat: 'Security',
    },
    'ZEN-401': {
      msg: `محتوای XSS مسدود شد: «${property}».`,
      cat: 'Security',
    },
  };
  const info = messages[code] ?? messages['ZEN-002']!;

  return new ZenithError({
    code,
    category: info.cat,
    message: info.msg,
    suggestion: isRuntime
      ? `این دسترسی در runtime توسط guard مسدود شد. ` +
        `اگر فکر می‌کنید این اشتباه است، expression را بررسی کنید.`
      : `این دسترسی در compile time توسط validator مسدود شد. ` +
        `از دسترسی به constructor، __proto__، prototype خودداری کنید.`,
    details: { property, isRuntime },
    context: { property },
  });
}

/**
 * FEATURE (v1.0.0): خطای HTTP برای Resource.
 */
export function resourceHttpError(url: string, status: number, statusText: string): ZenithError {
  const suggestion =
    status === 404
      ? `URL «${url}» یافت نشد (404). مسیر endpoint را بررسی کنید.`
      : status === 401 || status === 403
        ? `دسترسی غیرمجاز (${status}). کلید API یا credentials را بررسی کنید.`
        : status >= 500
          ? `خطای سرور (${status}). سرور در دسترس نیست یا خطای داخلی دارد.`
          : status === 0
            ? `درخواست شبکه ناموفق. سرور در حال اجرا است؟ CORS درست تنظیم شده؟`
            : `خطای HTTP ${status}. StatusText: ${statusText}`;

  return new ZenithError({
    code: ErrorCode.RESOURCE_HTTP_ERROR,
    category: 'Resource',
    message: `خطای HTTP ${status}: ${statusText}`,
    suggestion,
    details: { url, status, statusText },
    context: { url, status },
  });
}

/**
 * FEATURE (v1.0.0): خطای syntax برای expression.
 */
export function expressionSyntaxError(
  expr: string,
  position: number,
  unexpectedToken: string,
): ZenithError {
  return new ZenithError({
    code: ErrorCode.EXPRESSION_SYNTAX_ERROR,
    category: 'Expression',
    message: `خطای syntax در position ${position}: token غیرمنتظره «${unexpectedToken}».`,
    suggestion:
      `Expression: «${expr}»\n` +
      `مثال‌های معتبر:\n` +
      `  $user.name\n` +
      `  $count + 1\n` +
      `  $items.length > 0 ? "بله" : "خیر"\n` +
      `  $user.age > 18 && $user.active`,
    details: { expr, position, unexpectedToken },
    context: { expr, position },
  });
}

/**
 * FEATURE (v1.0.0): خطای zen-for invalid syntax.
 */
export function zenForInvalidSyntaxError(expr: string): ZenithError {
  return new ZenithError({
    code: ErrorCode.RUNTIME_ZEN_FOR_INVALID_SYNTAX,
    category: 'Runtime',
    message: `سینتکس zen-for نامعتبر: «${expr}»`,
    suggestion:
      `سینتکس صحیح:\n` +
      `  zen-for="item in $items"\n` +
      `  zen-for="(item, index) in $items"\n` +
      `  zen-for="item in $items.filter(x => x.active)"`,
    details: { expr },
    context: { expr },
  });
}

// ─────────────────────────────────────────────────────────────
// Additional Factory Functions (BUG-ERR-01)
// ─────────────────────────────────────────────────────────────

/**
 * خطای کامپایلر: syntax error در source.
 * ZEN-503: COMPILE_SYNTAX_ERROR
 */
export function compileSyntaxError(
  source: string,
  line: number,
  column?: number,
  details?: Record<string, unknown>,
): ZenithError {
  return new ZenithError({
    code: ErrorCode.COMPILE_SYNTAX_ERROR,
    category: 'Compiler',
    message: `Syntax error in ${source}:${line}${column ? `:${column}` : ''}`,
    suggestion: 'سینتکس قالب را بررسی کنید. پرانتزها، نقل‌قول‌ها و بلاک‌ها را چک کنید.',
    details: { source, line, column, ...details },
  });
}

/**
 * خطای کامپایلر: import گم‌شده.
 * ZEN-504: COMPILE_MISSING_IMPORT
 */
export function compileMissingImportError(importName: string, available?: string[]): ZenithError {
  const suggestion = available
    ? `importهای موجود: ${available.join(', ')}`
    : 'ماژول را import کنید یا نام آن را بررسی کنید.';
  return new ZenithError({
    code: ErrorCode.COMPILE_MISSING_IMPORT,
    category: 'Compiler',
    message: `ماژول "${importName}" یافت نشد.`,
    suggestion,
    details: { importName, available },
  });
}

/**
 * خطای runtime در evaluation Expression.
 * ZEN-551: JS_VM_RUNTIME_ERROR
 */
export function jsVmRuntimeError(originalError: Error, expression?: string): ZenithError {
  return new ZenithError({
    code: ErrorCode.JS_VM_RUNTIME_ERROR,
    category: 'Runtime',
    message: `Runtime error in expression${expression ? ` "${expression}"` : ''}: ${originalError.message}`,
    cause: originalError,
    details: {
      expression,
      originalName: originalError.name,
      stack: originalError.stack,
    },
  });
}

/**
 * خطای timeout در evaluation Expression.
 * ZEN-552: JS_VM_TIMEOUT
 */
export function jsVmTimeoutError(expression: string, timeoutMs: number): ZenithError {
  return new ZenithError({
    code: ErrorCode.JS_VM_TIMEOUT,
    category: 'Runtime',
    message: `Expression execution timed out after ${timeoutMs}ms: "${expression}"`,
    suggestion: 'حلقه‌های بی‌نهایت یا عملیات سنگین را بررسی کنید.',
    details: { expression, timeoutMs },
  });
}

/**
 * خطای مسیریابی: ناوبری لغو شد.
 * ZEN-603: ROUTER_NAVIGATION_ABORTED
 */
export function routerNavigationAbortedError(
  from: string,
  to: string,
  reason?: string,
): ZenithError {
  return new ZenithError({
    code: ErrorCode.ROUTER_NAVIGATION_ABORTED,
    category: 'Router',
    message: `Navigation from "${from}" to "${to}" was aborted${reason ? `: ${reason}` : ''}.`,
    suggestion: 'از abort دلیل اطمینان حاصل کنید یا ناوبری را مجدداً امتحان کنید.',
    details: { from, to, reason },
  });
}

// ─────────────────────────────────────────────────────────────
// Typo Detection Helper (Levenshtein distance)
// ─────────────────────────────────────────────────────────────

/**
 * یافتن نزدیک‌ترین تطابق با استفاده از Levenshtein distance.
 *
 * @param input نام متغیر ورودی (مثلاً "$usr")
 * @param candidates لیست متغیرهای موجود (مثلاً ["$user", "$data"])
 * @param maxDistance حداکثر فاصله مجاز (پیش‌فرض: ۵۰٪ طول رشته بلندتر، حداقل ۱)
 * @returns نزدیک‌ترین تطابق یا null
 */
export function findClosestMatch(
  input: string,
  candidates: string[],
  maxDistance?: number,
): string | null {
  if (candidates.length === 0) return null;

  // Normalize: remove $ prefix for comparison.
  const normalized = input.replace(/^\$/, '');

  // BUG-ERR-03: آستانه نسبی برای واژه‌های کوتاه
  // برای واژه‌های ۲-۳ حرفی، threshold مطلق ۱ از threshold نسبی بهتر است
  // تا suggestions بی‌ربط ندهد. برای واژه‌های بلندتر، ۵۰٪ طول منطقی است.
  const defaultThreshold = Math.max(1, Math.floor(normalized.length / 3));
  const threshold = maxDistance ?? defaultThreshold;

  const normalizedCandidates = candidates.map((c) => ({
    original: c,
    normalized: c.replace(/^\$/, ''),
  }));

  // مرتب‌سازی بر اساس distance برای بازگشت نزدیک‌ترین‌ها
  const scored = normalizedCandidates
    .map(({ original, normalized: candidate }) => ({
      original,
      distance: levenshtein(normalized, candidate),
    }))
    .filter((x) => x.distance <= threshold)
    .sort((a, b) => a.distance - b.distance);

  return scored.length > 0 ? scored[0]!.original : null;
}

/**
 * محاسبه Levenshtein distance بین دو رشته.
 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0]![j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1, // substitution
          matrix[i]![j - 1]! + 1, // insertion
          matrix[i - 1]![j]! + 1, // deletion
        );
      }
    }
  }

  return matrix[b.length]![a.length]!;
}

// ─────────────────────────────────────────────────────────────
// Utility: isZenithError type guard
// ─────────────────────────────────────────────────────────────

/**
 * BUG-ERR-04: بررسی می‌کند که آیا یک مقدار `ZenithError` است یا خیر.
 *
 * از duck typing برای سناریوهای cross-realm (iframe, VM context در تست)
 * استفاده می‌کند. بررسی `code.startsWith('ZEN-')` احتمال false positive
 * را کاهش می‌دهد.
 *
 * @param err مقدار مورد بررسی
 * @returns `true` اگر مقدار ZenithError باشد
 */
export function isZenithError(err: unknown): err is ZenithError {
  if (err instanceof ZenithError) return true;
  // Duck typing برای cross-realm (iframe, VM context)
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>;
    return (
      typeof e.code === 'string' &&
      (e.code as string).startsWith('ZEN-') &&
      typeof e.category === 'string' &&
      typeof e.message === 'string'
    );
  }
  return false;
}

/**
 * تبدیل هر خطایی به ZenithError (اگر قبلاً نیست).
 */
export function toZenithError(err: unknown): ZenithError {
  if (isZenithError(err)) return err;
  if (err instanceof Error) {
    return new ZenithError({
      code: ErrorCode.INTERNAL_UNKNOWN,
      category: 'Internal',
      message: err.message,
      cause: err,
    });
  }
  return new ZenithError({
    code: ErrorCode.INTERNAL_UNKNOWN,
    category: 'Internal',
    message: String(err),
  });
}

/**
 * #115 (DEC-031): خطای programmer/misuse — `throw developerError(...)`.
 * با کد مشخص‌شده (پیش‌فرض ZEN-907 = misuse عمومی API) و پیام یکسان
 * `ZEN-NNN: متن`. پیشوند اختصاصی `[Zenith] …` دیگر لازم نیست؛ code و
 * docsUrl خودشان منبع را مشخص می‌کنند.
 *
 * @example
 *   throw developerError('[zen-for] Element must have a parent node.', ErrorCode.RUNTIME_ZEN_IF_NO_PARENT);
 */
export function developerError(
  message: string,
  code: string = 'ZEN-907',
  opts?: {
    category?: ErrorCategory;
    suggestion?: string;
    details?: Record<string, unknown>;
    context?: Record<string, unknown>;
    cause?: unknown;
  },
): ZenithError {
  return new ZenithError({
    code,
    category: opts?.category ?? 'Runtime',
    message: `${code}: ${message}`,
    suggestion: opts?.suggestion,
    details: opts?.details,
    context: opts?.context,
    cause: opts?.cause,
    docsUrl: errorDocsUrl(code),
  });
}
