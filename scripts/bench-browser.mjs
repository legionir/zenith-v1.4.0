#!/usr/bin/env node
/**
 * #86 — `npm run bench:browser`: همان عملیات لیست، این بار در **مرورگر واقعی**.
 *
 * چرا جدا از `npm run bench`؟ محیط ثبت‌شدهٔ پیش‌فرض این مخزن jsdom است (در
 * sandbox/CI بدون مرورگر اعداد DOM روی jsdom گرفته می‌شوند). مرورگر واقعی
 * (Chromium از Playwright) اعدادی می‌دهد که layout/paint و JIT واقعی V8 را هم
 * شامل می‌شود؛ برای همین `npm run bench:browser` یک دستور **اختیاری** است:
 *
 *   npx playwright install chromium     # یک‌بار
 *   npm run bench:browser -- --json     # نتیجهٔ ماشین‌خوان
 *
 * تابع اندازه‌گیری همان `runDomListSuite` است که برای jsdom استفاده می‌شود؛
 * چون خودبسنده نوشته شده، با `page.evaluate` مستقیماً داخل صفحه سریال می‌شود.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runDomListSuite } from '../benchmarks/dom-suite.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// خروجی: `benchmarks/results/browser.json` (در .gitignore — مخصوص همان ماشین است).
const OUT_PATH = join(ROOT, 'benchmarks', 'results', 'browser.json');

const PAGE = `<!doctype html><html><body><table><tbody id="tbody"></tbody></table></body></html>`;

async function main() {
  const json = process.argv.includes('--json');
  let chromium;
  try {
    ({ chromium } = await import('@playwright/test'));
  } catch {
    console.error(
      '❌ bench:browser — @playwright/test نصب نیست. راهنما: npm install && npx playwright install chromium',
    );
    return 1;
  }

  let browser;
  try {
    browser = await chromium.launch();
  } catch (err) {
    console.error(
      '❌ bench:browser — اجرای Chromium ناموفق بود (مرورگر Playwright نصب نیست؟).\n' +
        '   نصب: npx playwright install --with-deps chromium\n' +
        `   جزئیات: ${String(err?.message ?? err).split('\n')[0]}`,
    );
    return 1;
  }

  try {
    const page = await browser.newPage();
    await page.setContent(PAGE);
    // صفحه را در وضعیت تمیز می‌گذاریم و همان تابع jsdom را داخل مرورگر اجرا می‌کنیم.
    // تابع اندازه‌گیری به‌صورت متن منتقل می‌شود (خودبسنده است) و داخل صفحه با
    // document واقعی اجرا می‌گردد. کل بدنهٔ صفحه با یک پرچم اجرا می‌شود تا
    // `document` در این فایل (که Node است) به eslint ناشناخته نماند.
    const results = await page.evaluate(
      /* eslint-disable no-undef */
      (payload) => {
        const factory = new Function(`return (${payload.source})`);
        const suite = factory();
        return suite(document, payload.options);
      },
      /* eslint-enable no-undef */
      { source: runDomListSuite.toString(), options: { runs: 5, warmupRuns: 2 } },
    );
    const browserVersion = browser.version();
    const out = {
      schema: 1,
      script: 'scripts/bench-browser.mjs',
      engine: `chromium@${browserVersion}`,
      userAgent: await page.evaluate(() => navigator.userAgent),
      results,
    };
    mkdirSync(dirname(OUT_PATH), { recursive: true });
    writeFileSync(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`);
    if (json) console.log(JSON.stringify(out, null, 2));
    else {
      console.log(`\n=== DOM list suite in Chromium ${browserVersion} ===`);
      for (const row of results) {
        console.log(`  ${row.id.padEnd(22)} ${String(row.ms).padStart(10)} ms (x${row.repeat})`);
      }
      console.log(`\nنتیجه در ${OUT_PATH} ذخیره شد (git-ignore).`);
    }
    return 0;
  } finally {
    await browser.close();
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main()
    .then((code) => process.exit(code ?? 0))
    .catch((err) => {
      console.error(`❌ bench:browser: ${err?.message ?? err}`);
      process.exit(1);
    });
}
