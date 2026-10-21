// packages/unplugin-zenith/src/compile-transform.ts
import { logger } from '@zenith/logger';
import { compileTemplate, type CompiledTemplate, type TemplateStateTypes } from '@zenith/compiler';
import { compile as compileExpression } from '@zenith/expressions';
import { compileOptions, type CompileOptions, type HtmlSourceMap, type TransformResult } from './compile-types';
import {
  EXPRESSION_DIRECTIVES,
  replaceAll,
  hasZenithDirectives,
  getModuleName,
  lookupTransformCache,
  storeTransformCache,
} from './compile-scan';

/**
 * کلید پایدار کش برای stateTypes (#111): ترتیب کلیدها مهم نیست.
 * @internal
 */
function stableStateTypesKey(stateTypes: TemplateStateTypes): string {
  return Object.keys(stateTypes)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => `${key}:${stateTypes[key]}`)
    .join(',');
}

/**
 * #110 — نگاشت line-preserving خروجی به ورودی (sourcemap دستی، بدون وابستگی).
 *
 * قرارداد: همه‌ی جایگزینی‌های attribute در همان خط انجام می‌شوند؛ تنها خطی
 * که در ورودی نیست، خط `<script>` تزریقی است (شناسایی با `src="/<module>"`).
 * هر خط خروجی یا به همان خط ورودی نگاشت می‌شود (`origLine` یکنواخت +۱) یا
 * (خط تزریقی) خالی می‌ماند. خروجی استاندارد SourceMap v3 است.
 */
const VLQ_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function vlq(value: number): string {
  let v = value < 0 ? ((-value) << 1) | 1 : value << 1;
  let out = '';
  do {
    let digit = v & 31;
    v >>>= 5;
    if (v > 0) digit |= 32;
    out += VLQ_CHARS[digit];
  } while (v > 0);
  return out;
}
export function htmlSourceMap(original: string, generated: string, source: string, moduleName: string): HtmlSourceMap {
  const injectedMarker = `src="/${moduleName}"`;
  const genLines = generated.split('\n');
  const segments: string[] = [];
  let origLine = 0;
  let prevSrcLine = 0;
  let first = true;
  for (const genLine of genLines) {
    if (genLine.includes(injectedMarker) && genLine.includes('<script')) {
      segments.push('');
      continue;
    }
    // ستون صفر → مبدأ صفر، خط مبدأ با دلتای VLQ (همیشه ‎+۱ به‌جز پس از خط تزریقی).
    const delta = first ? origLine : origLine - prevSrcLine;
    segments.push(`AA${vlq(delta)}A`);
    prevSrcLine = origLine;
    origLine += 1;
    first = false;
  }
  return { version: 3, sources: [source], sourcesContent: [original], names: [], mappings: segments.join(';') };
}

/**
 * Transform یک فایل HTML: compile directiveها به JS و حذف آن‌ها از HTML.
 *
 * @param html محتوای HTML.
 * @param htmlPath مسیر فایل (برای نام‌گذاری ماژول).
 * @param options گزینه‌های compile. `#111`: کلید `stateTypes` (قرارداد
 *   `TemplateStateTypes` از `@zenith/compiler`) خارج از schema منجمد #52
 *   پذیرفته می‌شود — قبل از resolve جدا و مستقیم به `compileTemplate`
 *   داده می‌شود (با `strict` build را می‌شکند، وگرنه warning).
 * @returns نتیجه‌ی transform.
 */
export async function transformHtml(
  html: string,
  htmlPath: string,
  options: CompileOptions & { stateTypes?: TemplateStateTypes } = {},
): Promise<TransformResult> {
  // #111 — stateTypes خارج از schema است (validate «unknown option» می‌دهد)؛
  // پس قبل از resolve جدا می‌شود تا اعتبارسنجی #52 دست‌نخورده بماند.
  const { stateTypes, ...compileOpts } = options;
  // #52 — اعتبارسنجی CompileOptions در مرز ورودی
  const resolvedOptions = compileOptions.resolve(compileOpts);
  const warnings: string[] = [];

  // #15 FIX: کش کامل نتیجهٔ transformHtml با LRU سقف‌دار
  // #111 — اثر stateTypes در کلید کش (schema متفاوت = نتیجهٔ متفاوت).
  const stateTypesKey = stateTypes === undefined ? '' : stableStateTypesKey(stateTypes);
  const cacheKey = `${htmlPath}::${resolvedOptions.strict ? 1 : 0}::${stateTypesKey}::${html}`;
  const cachedResult = lookupTransformCache(cacheKey);
  if (cachedResult !== undefined) {
    return cachedResult;
  }

  // اگر directive ندارد، چیزی برای compile نیست.
  if (!hasZenithDirectives(html)) {
    const moduleName = getModuleName(htmlPath);
    const emptyResult: TransformResult = {
      html,
      map: htmlSourceMap(html, html, htmlPath, moduleName),
      js: null,
      moduleName,
      directiveCount: 0,
      warnings,
    };
    storeTransformCache(cacheKey, emptyResult);
    return emptyResult;
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
        if (resolvedOptions.strict) {
          logger.error(`[Zenith Compile] ❌ ${errMsg}`);
          logger.error('Compilation failed.');
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
    compiled = await compileTemplate(html, {
      strict: resolvedOptions.strict,
      ...(stateTypes === undefined ? {} : { stateTypes }),
    });
  } catch (e) {
    const errMsg = `Compiler error: ${(e as Error).message}`;
    warnings.push(errMsg);
    if (resolvedOptions.strict) {
      logger.error(`[Zenith Compile] ❌ ${errMsg}`);
      logger.error('Compilation failed.');
      throw e;
    }
    // در حالت غیر strict، fallback به runtime walker
    return {
      html,
      map: htmlSourceMap(html, html, htmlPath, getModuleName(htmlPath)),
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
  const runtimeDirectiveNames = new Set(compiled.runtimeDirectives.map((rd) => rd.directive));
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

  const finalResult: TransformResult = {
    html: strippedHtml,
    map: htmlSourceMap(html, strippedHtml, htmlPath, moduleName),
    js: jsCode,
    moduleName,
    directiveCount: directives.length,
    warnings,
  };
  storeTransformCache(cacheKey, finalResult);
  return finalResult;
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
    lines.push(
      `// Runtime directives (not compilable, processed by runtime walker): ${compiled.runtimeDirectives.length}`,
    );
    for (const rd of compiled.runtimeDirectives) {
      lines.push(`//   - ${rd.directive}="${rd.value}" at ${rd.elementPath}`);
    }
  }
  lines.push('');
  lines.push(`import { logger } from '@zenith/logger';`);
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
  // logger.warn چاپ می‌کند تا escape hatch ها قابل‌حسابرسی باشند.
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
  lines.push(
    `        catch (e) { logger.error('[Zenith] processChildren failed for zen-for clone:', e); }`,
  );
  lines.push(`      } else if (typeof Zen !== 'undefined' && Zen.start) {`);
  lines.push(`        // Fallback: اگر walkAndBind در دسترس نبود (runtime قدیمی)، از`);
  lines.push(`        // Zen.start استفاده کن. در این حالت teardown وجود ندارد و نشت`);
  lines.push(`        // حافظه‌ی قدیمی باقی می‌ماند (پیام هشدار چاپ می‌شود).`);
  lines.push(`        try { Zen.start(node, localState || {}); }`);
  lines.push(
    `        catch (e) { logger.error('[Zenith] processChildren fallback (Zen.start) failed:', e); }`,
  );
  lines.push(`      }`);
  lines.push(`      return null;`);
  lines.push(`    };`);
  lines.push(
    `    render(root, ctx, effect, signal, sanitizeHTML, window.__ZENITH_STATE__ || null, processChildren, sanitizeHTMLTrusted, evaluateExpression, logger);`,
  );
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
    lines.push(
      `    if (typeof Zen !== 'undefined' && Zen.start && typeof walkAndBind === 'function') {`,
    );
    lines.push(`      // 1. One-time setup: Event Delegation + Components.`);
    lines.push(`      const dummy = document.createElement('div');`);
    lines.push(
      `      try { Zen.start(dummy, window.__ZENITH_STATE__ || {}, { devtools: false }); }`,
    );
    lines.push(`      catch (e) { logger.error('[Zenith] One-time setup failed:', e); }`);
    lines.push(`      // 2. Per-element: walkAndBind (lightweight, no re-init).`);
    lines.push(`      const runtimeEls = root.querySelectorAll('[data-zenith-runtime="true"]');`);
    lines.push(`      for (const el of runtimeEls) {`);
    lines.push(`        try { walkAndBind(el, window.__ZENITH_STATE__ || {}); }`);
    lines.push(
      `        catch (e) { logger.error('[Zenith] walkAndBind failed for runtime element:', e); }`,
    );
    lines.push(`      }`);
    lines.push(`    }`);
  }
  lines.push(
    `    logger.debug('[Zenith] Compiled template executed:', { module: ${JSON.stringify(moduleName)}, runtimeDirectives: ${compiled.runtimeDirectives.length} });`,
  );
  lines.push(`  } catch (e) {`);
  lines.push(`    logger.error('[Zenith] Failed to execute compiled template:', e);`);
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
