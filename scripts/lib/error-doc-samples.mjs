// scripts/lib/error-doc-samples.mjs
//
// #112 — متن‌های «علت/نمونهٔ خطا/رفع» برای صفحهٔ مستندات هر کد خطا.
//
// قاعده: صفحهٔ هر کد **قابل تولید خودکار** است؛ قطعه‌کد «نمونهٔ خطا» از قالب
// دامنه (DOMAIN_SAMPLES) می‌آید و با CODE_SAMPLES برای کدهای پرکاربرد دقیق‌تر
// می‌شود. «رفع» از فیلد `suggestion` همان کاتالوگ می‌آید تا هرگز از کد جدا نشود.
// راهنمای کدهای سه‌رقمی کلاسیک بر پایهٔ پیشوند (LEGACY_GUIDANCE) است.

/** نمونهٔ کد خطادار به‌ازای دامنهٔ کد ۴رقمی (کلید = فیلد `domain` کاتالوگ). */
export const DOMAIN_SAMPLES = {
  schema: `import { s, validateOptions } from '@zenith/schema';

// ❌ مقدار ارسال‌شده با schema نمی‌خواند (یا کلید ناشناخته است)
validateOptions({ ttl: 'soon' }, s.object({ ttl: s.number() }));`,
  storage: `import { createStorage } from '@zenith/storage';

// ❌ در حالت private مرورگر یا پر شدن سهمیه، ذخیره‌سازی محلی در دسترس نیست
const store = createStorage({ driver: 'local' });
store.set('profile', 'x'.repeat(6_000_000)); // → quota`,
  cache: `import { createCache } from '@zenith/cache';

// ❌ ttl نامعتبر (منفی/غیرعدد) یا شکست loader
const cache = createCache({ ttl: -1 });`,
  i18n: `import { createI18n } from '@zenith/i18n';

// ❌ کلید یا locale در bundle ثبت نشده است
const i18n = createI18n({ locale: 'fa' });
i18n.t('missing.key.without.bundle');`,
  a11y: `import { createFocusTrap } from '@zenith/a11y';

// ❌ ناحیهٔ trap هیچ المان focusable ندارد
const trap = createFocusTrap(document.querySelector('#empty-panel'));
trap.activate();`,
  head: `import { setHead } from '@zenith/head';

// ❌ تگ بدنه (عنصر div) در head مجاز نیست
setHead({ title: 'Zenith', tags: ['<div>body markup</div>'] });`,
  ui: `import { createSelect } from '@zenith/ui';

// ❌ مقدار انتخاب‌شده در فهرست options نیست و placeholder هم مجاز نشده
createSelect({ options: [{ value: 'a' }], value: 'b' });`,
  realtime: `import { createRealtime } from '@zenith/realtime';

// ❌ اتصال پیش از آماده بودن transport یا parser ناسازگار
const rt = createRealtime({ url: 'wss://example.test' });
rt.subscribe('room');`,
  adapters: `import { createNodeAdapter } from '@zenith/adapter-node';

// ❌ محیط اجرا handler موردانتظار adapter را ندارد
createNodeAdapter({ dir: './dist' })();`,
  analytics: `import { createAnalytics } from '@zenith/analytics';

// ❌ provider ثبت‌نشده یا رویداد ناشناخته ارسال شده است
const analytics = createAnalytics();
analytics.track('unknown_event');`,
  theme: `import { createTheme } from '@zenith/theme';

// ❌ توکن رنگ ناشناخته در تم ارسال شده است
createTheme({ colors: { '--zen-brand': 'var(--missing)' } });`,
  'auth-oauth': `import { createOAuthClient } from '@zenith/auth-oauth';

// ❌ PKCE/redirect ناسازگار یا پاسخ token نامعتبر
createOAuthClient({ clientId: 'demo', redirectUri: '/callback' }).login();`,
  'feature-flags': `import { rollout } from '@zenith/feature-flags';

// ❌ قاعدهٔ rollout با درصد/بازهٔ نامعتبر تعریف شده است
rollout('beta', { percentage: 150 });`,
  'runtime-core': `import { defineDirective } from '@zenith/runtime-core';

// ❌ دایرکتیو با امضای نادرست یا bind بدون Cleanup ثبت شده است
defineDirective({ name: 'bad', bind: () => undefined });`,
  'devtools-core': `import { registerSignal } from '@zenith/devtools-core';

// ❌ شناسه/ثبت تکراری یا سرریز تاریخچه در devtools-core
registerSignal('id');`,
  tooling: `import { compileTemplate } from '@zenith/compiler';

// ❌ خطای ابزار build (کامپایل/اسکن/emit) — جزئیات در details
compileTemplate('<div zen-if=""></div>');`,
  cli: `# ❌ اجرای \`zenith check\` با قانون نقض‌شده (کدهای ZEN-90NN)
npx zenith check --strict   # rule violation`,
};

/** نمونهٔ دقیق برای کدهای پرکاربرد (override قالب دامنه). */
export const CODE_SAMPLES = {
  'ZEN-1003': `<!-- ❌ JSON خراب در attribute (کاما/نقل‌قول نامعتبر) -->\n<zen-crud zen-crud-options='{"url": "/api/items",}'>`,
  'ZEN-1201': `import { createCache } from '@zenith/cache';\n\n// ❌ ttl باید عدد صحیح ≥ ۰ باشد\ncreateCache({ ttl: -1 });`,
  'ZEN-1401': `import { createFocusTrap } from '@zenith/a11y';\n\nconst trap = createFocusTrap(document.createElement('div'));\ntrap.activate(); // ❌ هیچ المان focusable داخل container نیست`,
  'ZEN-1601': `import { createSelect } from '@zenith/ui';\n\ncreateSelect({ options: [{ value: 'a' }], value: 'b' }); // ❌ value نامعتبر`,
  'ZEN-2101': `import { createOAuthClient } from '@zenith/auth-oauth';\n\n// ❌ code_verifier در callback با verifier ذخیره‌شدهٔ PKCE نمی‌خواند\nclient.handleCallback(new URL(location.href));`,
  'ZEN-2301': `import { defineDirective } from '@zenith/runtime-core';\n\n// ❌ bind باید Cleanup برگرداند\ndefineDirective({ name: 'probe', bind: () => {} });`,
};

/**
 * راهنمای «رفع» برای کدهای سه‌رقمی کلاسیک بر پایهٔ بازهٔ پیشوند
 * (core.ts §ساختار کدها). هر کد legacy باید یکی از این‌ها را داشته باشد.
 */
export const LEGACY_GUIDANCE = {
  0: `خطای ارزیابی عبارت (Expression/Validator). ورودی کاربر یا context را با
\`@zenith/expressions\` بسنجید؛ مقادیر مجاز را در \`Zen.start(..., { context })\` بدهید
و از \`parse()\`/validator قبل از اجرا استفاده کنید.`,
  1: `خطای runtime/directive. ساختار DOM و نام دایرکتیو را بررسی کنید
(\`zen-for\` نیازمند \`zen-key\` و والد است؛ \`zen-if\` نیازمند والد). برای هر
دایرکتیو سفارشی، \`defineDirective\` را با \`DirectiveMeta\` ثبت کنید.`,
  2: `خطای Resource. در دسترس بودن endpoint، وضعیت HTTP و ترتیب
\`fetch\`/\`dispose\` را بررسی کنید؛ از \`Resource.get()\` پس از \`dispose()\` استفاده نکنید.`,
  3: `خطای SSR/hydration. برای رندر سرور یک DOM سازگار (JSDOM/\`@zenith/ssr\`) بدهید
و مارک‌آپ سرور و کلاینت را یکسان نگه دارید تا hydration mismatch رخ ندهد.`,
  4: `خطای امنیتی. ورودی غیرقابل‌اعتماد را sanitize کنید (\`@zenith/security\`)،
نام ویژگی/شناسه‌های ممنوع را در عبارت‌ها به‌کار نبرید و از CSPRNG
(\`secureId\`) برای شناسه‌های امنیتی استفاده کنید.`,
  5: `خطای کامپایل. نام دایرکتیو را تصحیح کنید، importهای موردنیاز قالب را
به کامپایلر بدهید و خطای عبارت را پیش از build برطرف کنید.`,
  6: `خطای روتر. مسیرهای تعریف‌شده و گاردهای \`beforeEach\` را بررسی کنید؛
برای بارگذاری تنبل، موفقیت \`import()\` ماژول مسیر را تضمین کنید.`,
  7: `خطای فرم/اعتبارسنجی. schema فرم را با دادهٔ ورودی تطبیق دهید و
خطاهای فیلد را با \`form.errors\` نمایش دهید.`,
  8: `خطای کامپوننت. ثبت کامپوننت (\`registerComponent\`) و propهای
اجباری را بررسی کنید؛ slotهای موردانتظار را در template بگذارید.`,
  9: `خطای داخلی. پیام و \`details\` را ثبت کنید؛ این کد برای مسیرهای
غیرمنتظره است و باید به issue تبدیل شود (\`reportError\` به hub).`,
};
