// packages/errors/src/index.ts
//
// @zenith/errors — کتابخانه‌ی پیام‌های خطای Zenith
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

/** جدول بازه‌های ۴رقمی — عیناً SPEC §۰.۴ (DEC-020). */
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
};

/**
 * خطای ZenithError از کاتالوگ رزروشده (۴رقمی) — پیام/suggestion/docsUrl خودکار.
 * @throws اگر code در catalog نباشد (جلوگیری از مصرف کد ثبت‌نشده).
 */
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
  return new ZenithError({
    code,
    category: meta.category,
    // دستورالعمل §۱۰: پیام‌ها `[CODE] prefix` دارند تا assert/regex روی message
    // کار کند (#112 لینک docs را اضافه می‌کند؛ #171 کاتالوگ).
    message: `[${code}] ${meta.message}`,
    suggestion: meta.suggestion,
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
    message: `Resource «${resourceName}» قبلاً destroy() شده است و عملیات «${operation}» مجاز نیست.`,
    suggestion:
      `این Resource با destroy() غیرفعال شده. برای ردیابی:\n` +
      `  ۱. در کد جستجو کنید: ${resourceName}.destroy()\n` +
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
