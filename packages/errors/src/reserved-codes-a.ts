// packages/errors/src/reserved-codes-a.ts
//
// نیمهٔ اول کاتالوگ کدهای رزروشده (verbatim از core.ts؛ ترتیب کلیدها حفظ
// شده) — بخش #40 (code-first: نوشته‌شده، اجرا نشده).

import type { ReservedErrorMeta } from './reserved-codes';

/** @public */
export const RESERVED_ERROR_CODES_A: Readonly<Record<string, ReservedErrorMeta>> = {
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
    suggestion:
      'provider را بررسی یا موقتاً غیرفعال کنید؛ دادهٔ رویداد و خطای اصلی برای حفظ حریم خصوصی گزارش نمی‌شوند.',
  },
};
