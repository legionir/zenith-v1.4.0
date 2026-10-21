// packages/errors/src/reserved-codes-b.ts
//
// نیمهٔ دوم کاتالوگ کدهای رزروشده (verbatim از core.ts؛ ترتیب کلیدها حفظ
// شده) — بخش #40 (code-first: نوشته‌شده، اجرا نشده).

import type { ReservedErrorMeta } from './reserved-codes';

/** @public */
export const RESERVED_ERROR_CODES_B: Readonly<Record<string, ReservedErrorMeta>> = {
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
