// packages/vite-plugin/src/compile.ts
//
// Compiler Integration برای Vite Plugin — Production Readiness #13
//
// این ماژول قابلیت compile-time HTML transformation را برای Vite فراهم می‌کند.
//
// ── هدف ──
//   در Build Time (نه Runtime)، فایل‌های HTML را parse می‌کند،
//   directiveهای Zenith را شناسایی می‌کند و آن‌ها را به:
//     1) Static HTML (بدون directiveها)
//     2) JavaScript module (با Effectهای آماده‌ی اجرا)
//   تبدیل می‌کند.
//
//   مزایا:
//     - حذف هزینه‌ی DOM Walking در Runtime (مخصوصاً در صفحات بزرگ)
//     - Tree-shaking بهتر (فقط directiveهای استفاده‌شده در bundle می‌آیند)
//     - Early error detection (خطاهای سینتکس در build گزارش می‌شوند)
//     - کوچک‌ترین bundle size برای production
//
// ── نحوه کار ──
//   ورودی: index.html با directiveهای zenith
//   خروجی: index.html (بدون directiveها) + index.zenith.js (با render function)
//
//   در HTML نهایی، یک script tag به فایل JS اضافه می‌شود که آن را
//   load کرده و render function را روی document body اجرا می‌کند.

import { compileTemplate, type CompiledTemplate } from '@zenith/compiler';
import { compile as compileExpression } from '@zenith/expressions';

/**
 * لیست مشترک directiveهای دارای expression که باید در compile-time اعتبارسنجی شوند.
 * FIX (B-9): به‌عنوان constant سطح ماژول تعریف شده تا هم در transformHtml
 * و هم در analyzeHtml استفاده شود — از دوگانگی کد جلوگیری می‌کند.
 *
 * هر directive که نیاز به یک zenith expression دارد و باید در build-time
 * اعتبارسنجی شود، باید اینجا اضافه شود.
 */
const EXPRESSION_DIRECTIVES = new Set([
  'zen-text', 'zen-if', 'zen-show', 'zen-bind', 'zen-model', 'zen-html',
  // FEATURE (v0.4.0): zen-html-trusted هم expression دارد مثل zen-html.
  'zen-html-trusted',
]);

/**
 * جایگزینی همه‌ی occurrences یک رشته در متن.
 *
 * FIX (B-4): String.prototype.replace() فقط اولین occurrence را جایگزین می‌کند،
 * اما این تابع با escape کردن regex special characters و استفاده از `g` flag
 * همه‌ی occurrenceها را جایگزین می‌کند.
 *
 * @param input متن اصلی
 * @param search رشته‌ای که باید جایگزین شود
 * @param replacement رشته جایگزین
 * @returns متن با همه‌ی occurrences جایگزین شده
 */
function replaceAll(input: string, search: string, replacement: string): string {
  // escape کردن کاراکترهای ویژه regex
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'g');
  return input.replace(regex, replacement);
}

/**
 * گزینه‌های compile.
 */
export interface CompileOptions {
  /**
   * آیا compile در build time فعال باشد؟
   * پیش‌فرض: true در build، false در dev (در dev از runtime walker استفاده می‌شود).
   */
  enabled?: boolean;

  /**
   * مسیرهای که باید compile شوند (به‌صورت glob).
   * پیش‌فرض: همه‌ی فایل‌های `.html` در root و pages/.
   */
  include?: string[];

  /**
   * مسیرهای که نباید compile شوند.
   */
  exclude?: string[];

  /**
   * آیا خطاهای warning در build به error تبدیل شوند؟
   */
  strict?: boolean;
}

/**
 * نتیجه‌ی transform یک فایل HTML.
 */
export interface TransformResult {
  /** HTML تغییر یافته (بدون directiveها، با script tag اضافه‌شده). */
  html: string;
  /** کد JavaScript تولیدشده (یا null اگر فایل directive نداشت). */
  js: string | null;
  /** نام ماژول برای import. */
  moduleName: string;
  /** تعداد directiveهای compile‌شده. */
  directiveCount: number;
  /** گزارش‌های warning. */
  warnings: string[];
}

/**
 * حافظه پنهان (cache) برای نتیجه hasZenithDirectives.
 * IMPROVEMENT (I-2): از WeakMap استفاده می‌کنیم که با GC جمع‌آوری می‌شود
 * وقتی HTML string از حافظه خارج شود. این از محاسبه مجدد regex برای
 * فایل‌های بزرگ بدون directive جلوگیری می‌کند.
 */
/**
 * Cache ساده (Map) برای نتیجه hasZenithDirectives.
 * از Map استفاده می‌شود چون WeakMap فقط object به عنوان کلید قبول می‌کند
 * و string (که primitive است) نمی‌تواند کلید WeakMap باشد.
 *
 * IMPROVEMENT (I-2): این cache از محاسبه مجدد regex برای فایل‌های بزرگ
 * بدون directive جلوگیری می‌کند.
 */
const directiveCache = new Map<string, boolean>();

/**
 * بررسی اینکه آیا یک فایل HTML directiveهای Zenith دارد.
 *
 * IMPROVEMENT (I-2): بهبود عملکرد با:
 *   1. early exit با includes('zen-') — بسیار سریع‌تر از regex
 *   2. cache برای جلوگیری از اسکن مجدد فایل‌های بزرگ
 */
export function hasZenithDirectives(html: string): boolean {
  // بررسی از cache
  const cached = directiveCache.get(html);
  if (cached !== undefined) return cached;

  // Early exit: اگر "zen-" در متن نباشد، قطعاً directiveای وجود ندارد.
  // این از اجرای regex روی فایل‌های بدون directive جلوگیری می‌کند.
  if (!html.includes('zen-')) {
    directiveCache.set(html, false);
    return false;
  }

  // بررسی دقیق‌تر با regex
  const result = /\szen-[a-z]/i.test(html);
  directiveCache.set(html, result);
  return result;
}

/**
 * استخراج نام فایل ماژول از مسیر HTML.
 * مثال: src/pages/home.html → home.zenith.js
 */
export function getModuleName(htmlPath: string): string {
  const base = htmlPath.split('/').pop() || 'app';
  const name = base.replace(/\.(html?|htm)$/i, '');
  return `${name}.zenith.js`;
}

/**
 * Transform یک فایل HTML: compile directiveها به JS و حذف آن‌ها از HTML.
 *
 * @param html محتوای HTML.
 * @param htmlPath مسیر فایل (برای نام‌گذاری ماژول).
 * @param options گزینه‌های compile.
 * @returns نتیجه‌ی transform.
 */
export async function transformHtml(
  html: string,
  htmlPath: string,
  options: CompileOptions = {},
): Promise<TransformResult> {
  const warnings: string[] = [];

  // اگر directive ندارد، چیزی برای compile نیست.
  if (!hasZenithDirectives(html)) {
    return {
      html,
      js: null,
      moduleName: getModuleName(htmlPath),
      directiveCount: 0,
      warnings,
    };
  }

  // ── استخراج directiveها ──
  // پیدا کردن تمام attributeهای zen-* با موقعیت آن‌ها.
  const directiveRegex = /\s(zen-[a-z][a-z0-9-]*)(?:=("[^"]*"|'[^']*'|[^\s>]+))?/gi;
  const directives: Array<{
    name: string;
    value: string;
    fullMatch: string;
    index: number;
  }> = [];

  let match: RegExpExecArray | null;
  while ((match = directiveRegex.exec(html)) !== null) {
    const name = match[1] ?? '';
    const rawValue = match[2] || '';
    const value = rawValue.replace(/^["']|["']$/g, '');

    // اعتبارسنجی expression برای directiveهای دارای expression
    // FIX (B-9): از EXPRESSION_DIRECTIVES سطح ماژول استفاده می‌کنیم
    // به‌جای تعریف دوباره در اینجا.
    if (EXPRESSION_DIRECTIVES.has(name) && value) {
      try {
        compileExpression(value);
      } catch (e) {
        const errMsg = `Expression error in ${name}="${value}" at offset ${match.index}: ${(e as Error).message}`;
        warnings.push(errMsg);
        if (options.strict) {
          console.error(`[Zenith Compile] ❌ ${errMsg}`);
          console.error(e);
          throw e;
        }
      }
    }

    directives.push({
      name,
      value,
      fullMatch: match[0],
      index: match.index,
    });
  }

  // ── تولید JavaScript module ──
  // استفاده از compiler برای تولید کد.
  let compiled: CompiledTemplate;
  try {
    compiled = await compileTemplate(html, { strict: options.strict });
  } catch (e) {
    const errMsg = `Compiler error: ${(e as Error).message}`;
    warnings.push(errMsg);
    if (options.strict) {
      console.error(`[Zenith Compile] ❌ ${errMsg}`);
      console.error(e);
      throw e;
    }
    // در حالت غیر strict، fallback به runtime walker
    return {
      html,
      js: null,
      moduleName: getModuleName(htmlPath),
      directiveCount: directives.length,
      warnings,
    };
  }

  // اضافه کردن warningهای compiler به warnings کلی
  for (const w of compiled.warnings) {
    warnings.push(w);
  }

  // ── تولید HTML با directiveهای compile‌شده حذف‌شده ──
  //
  // برای directiveهای قابل compile (zen-text, zen-if, zen-show, zen-bind, zen-html, zen-model):
  //   attribute حذف می‌شود و با data-zenith-compiled جایگزین می‌شود تا runtime
  //   بداند این عنصر قبلاً compile شده.
  //
  // برای directiveهای runtime-only (zen-for, zen-action, zen-fetch, ...):
  //   attribute اصلی حفظ می‌شود چون runtime walker باید آن را پردازش کند.
  //   این از silent drop جلوگیری می‌کند.
  const runtimeDirectiveNames = new Set(compiled.runtimeDirectives.map(rd => rd.directive));
  let strippedHtml = html;
  for (const d of directives) {
    // FIX (B-5): برای runtime directives، attribute اصلی را با
    // data-zenith-runtime="true" جایگزین می‌کنیم تا runtime walker
    // بتواند آن‌ها را پیدا کند. این مشکل را برطرف می‌کند که querySelectorAll
    // runtime عناصر را پیدا نمی‌کرد چون data-zenith-runtime هرگز تنظیم نمی‌شد.
    if (runtimeDirectiveNames.has(d.fullMatch.trim())) {
      const runtimeAttr = ` data-zenith-runtime="true" data-zenith-directive="${d.name}"`;
      strippedHtml = replaceAll(strippedHtml, d.fullMatch, runtimeAttr);
      continue;
    }
    // در غیر این صورت، آن را با data-zenith-compiled جایگزین کن
    const compiledAttr = ` data-zenith-compiled="${d.name}"`;
    // FIX (B-4): از replaceAll به‌جای replace استفاده می‌کنیم تا اگر
    // یک directive دو بار در یک صفحه استفاده شود، هر دو occurrence
    // جایگزین شوند. String.prototype.replace() فقط اولین occurrence را
    // جایگزین می‌کند.
    strippedHtml = replaceAll(strippedHtml, d.fullMatch, compiledAttr);
  }

  // ── تولید JavaScript module code ──
  const moduleName = getModuleName(htmlPath);
  const jsCode = generateModule(compiled, moduleName);

  // ── اضافه کردن script tag به HTML ──
  // script را به body اضافه می‌کنیم (اگر body وجود دارد).
  const scriptTag = `<script type="module" src="/${moduleName}"></script>`;
  if (strippedHtml.includes('</body>')) {
    strippedHtml = strippedHtml.replace('</body>', `  ${scriptTag}\n</body>`);
  } else if (strippedHtml.includes('</html>')) {
    strippedHtml = strippedHtml.replace('</html>', `  ${scriptTag}\n</html>`);
  } else {
    strippedHtml += `\n${scriptTag}`;
  }

  return {
    html: strippedHtml,
    js: jsCode,
    moduleName,
    directiveCount: directives.length,
    warnings,
  };
}

/**
 * تولید کد ماژول JavaScript از CompiledTemplate.
 *
 * ساختار خروجی:
 *   import { effect } from '@zenith/state';
 *   import { evaluateExpression } from '@zenith/expressions';
 *
 *   const renderFn = function render(root, ctx, effect, signal) {
 *     // ... compiled code ...
 *   };
 *
 *   // Auto-execute on DOMContentLoaded
 *   if (document.readyState === 'loading') {
 *     document.addEventListener('DOMContentLoaded', () => {
 *       renderFn(document.body, window.__ZENITH_CONTEXT__ || {}, effect, signal);
 *     });
 *   } else {
 *     renderFn(document.body, window.__ZENITH_CONTEXT__ || {}, effect, signal);
 *   }
 *
 *   export default renderFn;
 *
 * اگر compiled.runtimeDirectives خالی نباشد (یعنی directiveهایی وجود دارند که
 * قابل compile نبودند و به runtime سپرده شده‌اند)، ماژول همچنین runtime walker
 * را import می‌کند و پس از render() روی root فراخوانی می‌کند تا آن directiveها
 * پردازش شوند. این از silent drop جلوگیری می‌کند.
 */
function generateModule(compiled: CompiledTemplate, moduleName: string): string {
  const lines: string[] = [];
  const hasRuntimeDirectives = compiled.runtimeDirectives.length > 0;

  // ── Imports ──
  lines.push(`// Auto-generated by @zenith/vite-plugin (compile)`);
  lines.push(`// Module: ${moduleName}`);
  lines.push(`// Element count: ${compiled.elementCount}`);
  lines.push(`// Effect count: ${compiled.effectCount}`);
  lines.push(`// Is static: ${compiled.isStatic}`);
  if (hasRuntimeDirectives) {
    lines.push(`// Runtime directives (not compilable, processed by runtime walker): ${compiled.runtimeDirectives.length}`);
    for (const rd of compiled.runtimeDirectives) {
      lines.push(`//   - ${rd.directive}="${rd.value}" at ${rd.elementPath}`);
    }
  }
  lines.push('');
  lines.push(`import { effect, signal } from '@zenith/state';`);
  lines.push(`import { evaluateExpression } from '@zenith/expressions';`);
  // SECURITY (v7.0): sanitizeHTML همیشه import می‌شود چون render() آن را
  // به‌عنوان پارامتر پنجم برای zen-html دریافت می‌کند. حتی اگر قالب فعلی
  // zen-html نداشته باشد، امضای render ثابت می‌ماند.
  lines.push(`import { sanitizeHTML } from '@zenith/security';`);
  // FEATURE (v0.4.0): sanitizeHTMLTrusted همیشه import می‌شود چون render()
  // آن را به‌عنوان پارامتر هشتم برای zen-html-trusted دریافت می‌کند. حتی اگر
  // قالب فعلی zen-html-trusted نداشته باشد، امضای render ثابت می‌ماند.
  // این تابع یک Identity function است (هیچ پاکسازی‌ای نمی‌کند) اما در Dev یک
  // console.warn چاپ می‌کند تا escape hatch ها قابل‌حسابرسی باشند.
  lines.push(`import { sanitizeHTMLTrusted } from '@zenith/security';`);
  // v0.3.0: Zen همیشه import می‌شود چون processChildren (پارامتر هفتم render)
  // از Zen.start برای پردازش فرزندان zen-for cloneها استفاده می‌کرد.
  // v0.4.0: به‌جای Zen.start از walkAndBind استفاده می‌کنیم که سبک‌وزن‌تر است
  // (Event Delegation را re-init نمی‌کند و resetResourceRegistry صدا نمی‌زند)
  // و یک تابع teardown برمی‌گرداند که Effectهای فرزندان clone را dispose
  // می‌کند → رفع نشت حافظه‌ی zen-for v0.3.0 هنگام removal آیتم‌ها.
  lines.push(`import { Zen, walkAndBind } from '@zenith/runtime';`);
  // اگر runtime directive وجود دارد، runtime walker را import کن
  if (hasRuntimeDirectives) {
    // (Zen قبلاً import شده — این بلاک برای future-proof نگه داشته شده.)
  }
  lines.push('');

  // ── Context getter ──
  // در runtime، context به‌صورت آبجکت در window.__ZENITH_CONTEXT__ قرار می‌گیرد.
  lines.push(`const ctx = window.__ZENITH_CONTEXT__ || {};`);
  lines.push('');

  // ── Compiled render function ──
  lines.push(compiled.code);
  lines.push('');

  // ── Auto-execute ──
  lines.push(`// Auto-execute on DOM ready`);
  lines.push(`function run() {`);
  lines.push(`  const root = document.body;`);
  lines.push(`  try {`);
  // v0.4.0: processChildren برای zen-for کامپایل‌شده — هر clone با localState
  // به walkAndBind سپرده می‌شود. این تابع سبک‌وزن‌تر از Zen.start است (Event
  // Delegation را re-init نمی‌کند، Resource Registry را reset نمی‌کند) و یک
  // تابع teardown برمی‌گرداند که در `__entry.dispose` ذخیره می‌شود و هنگام
  // removal آیتم صدا زده می‌شود تا Effectهای فرزندان clone پاکسازی شوند.
  // این نشت حافظه‌ی v0.3.0 را برطرف می‌کند.
  lines.push(`    const processChildren = (node, localState) => {`);
  lines.push(`      if (typeof walkAndBind === 'function') {`);
  lines.push(`        try { return walkAndBind(node, localState || {}); }`);
  lines.push(`        catch (e) { console.error('[Zenith] processChildren failed for zen-for clone:', e); }`);
  lines.push(`      } else if (typeof Zen !== 'undefined' && Zen.start) {`);
  lines.push(`        // Fallback: اگر walkAndBind در دسترس نبود (runtime قدیمی)، از`);
  lines.push(`        // Zen.start استفاده کن. در این حالت teardown وجود ندارد و نشت`);
  lines.push(`        // حافظه‌ی قدیمی باقی می‌ماند (پیام هشدار چاپ می‌شود).`);
  lines.push(`        try { Zen.start(node, localState || {}); }`);
  lines.push(`        catch (e) { console.error('[Zenith] processChildren fallback (Zen.start) failed:', e); }`);
  lines.push(`      }`);
  lines.push(`      return null;`);
  lines.push(`    };`);
  lines.push(`    render(root, ctx, effect, signal, sanitizeHTML, window.__ZENITH_STATE__ || null, processChildren, sanitizeHTMLTrusted, evaluateExpression);`);
  if (hasRuntimeDirectives) {
    lines.push(`    // FEATURE (v1.0.0): Level 3 Walker Elimination.`);
    lines.push(`    // Process runtime directives (zen-for, zen-action, zen-fetch, etc.)`);
    lines.push(`    // که قابل compile نبودند و روی عناصر حفظ شده‌اند.`);
    lines.push(`    //`);
    lines.push(`    // OPTIMIZATION (v1.0.0): قبلاً برای هر عنصر runtime directive، Zen.start`);
    lines.push(`    // صدا زده می‌شد که باعث می‌شد Event Delegation در سطح document`);
    lines.push(`    // N بار setup شود (duplicate listeners!).
`);
    lines.push(`    //   1. یک‌بار Zen.start روی یک dummy div صدا زده می‌شود تا Event`);
    lines.push(`    //      Delegation و Components یک‌بار setup شوند.`);
    lines.push(`    //   2. برای هر عنصر runtime directive، walkAndBind صدا زده می‌شود که`);
    lines.push(`    //      سبک‌وزن‌تر است (Event Delegation را re-init نمی‌کند).`);
    lines.push(`    if (typeof Zen !== 'undefined' && Zen.start && typeof walkAndBind === 'function') {`);
    lines.push(`      // 1. One-time setup: Event Delegation + Components.`);
    lines.push(`      const dummy = document.createElement('div');`);
    lines.push(`      try { Zen.start(dummy, window.__ZENITH_STATE__ || {}, { devtools: false }); }`);
    lines.push(`      catch (e) { console.error('[Zenith] One-time setup failed:', e); }`);
    lines.push(`      // 2. Per-element: walkAndBind (lightweight, no re-init).`);
    lines.push(`      const runtimeEls = root.querySelectorAll('[data-zenith-runtime="true"]');`);
    lines.push(`      for (const el of runtimeEls) {`);
    lines.push(`        try { walkAndBind(el, window.__ZENITH_STATE__ || {}); }`);
    lines.push(`        catch (e) { console.error('[Zenith] walkAndBind failed for runtime element:', e); }`);
    lines.push(`      }`);
    lines.push(`    }`);
  }
  lines.push(`    console.log('[Zenith] Compiled template executed:', '${moduleName}'${hasRuntimeDirectives ? ` + ' (with ' + ${compiled.runtimeDirectives.length} + ' runtime directives)'` : ''});`);
  lines.push(`  } catch (e) {`);
  lines.push(`    console.error('[Zenith] Failed to execute compiled template:', e);`);
  lines.push(`  }`);
  lines.push(`}`);
  lines.push('');
  lines.push(`if (document.readyState === 'loading') {`);
  lines.push(`  document.addEventListener('DOMContentLoaded', run);`);
  lines.push(`} else {`);
  lines.push(`  run();`);
  lines.push(`}`);
  lines.push('');
  lines.push(`export default render;`);

  return lines.join('\n');
}

/**
 * اعتبارسنجی فایل HTML و بازگشت لیست warningها بدون transform.
 *
 * کاربرد: در `zenith check` یا قبل از build برای بررسی زودهنگام.
 */
export function analyzeHtml(html: string, htmlPath: string = '<inline>'): {
  directiveCount: number;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!hasZenithDirectives(html)) {
    return { directiveCount: 0, warnings, errors };
  }

  const directiveRegex = /\s(zen-[a-z][a-z0-9-]*)(?:=("[^"]*"|'[^']*'|[^\s>]+))?/gi;
  let match: RegExpExecArray | null;
  let count = 0;

  while ((match = directiveRegex.exec(html)) !== null) {
    const name = match[1] ?? '';
    const value = (match[2] || '').replace(/^["']|["']$/g, '');
    count++;

    // FIX (B-9): از EXPRESSION_DIRECTIVES سطح ماژول استفاده می‌کنیم
    // به‌جای تعریف دوباره در اینجا.
    if (EXPRESSION_DIRECTIVES.has(name)) {
      if (!value) {
        errors.push(`${htmlPath}: ${name} has empty expression`);
        continue;
      }
      try {
        compileExpression(value);
      } catch (e) {
        errors.push(`${htmlPath}: ${name}="${value}" — ${(e as Error).message}`);
      }
    }
  }

  return { directiveCount: count, warnings, errors };
}
