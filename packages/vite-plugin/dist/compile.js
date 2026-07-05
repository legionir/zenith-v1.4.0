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
import { compileTemplate } from '@zenith/compiler';
import { compile as compileExpression } from '@zenith/expressions';
/**
 * بررسی اینکه آیا یک فایل HTML directiveهای Zenith دارد.
 */
export function hasZenithDirectives(html) {
    // بررسی سریع با regex (بدون parse کامل)
    return /\szen-[a-z]/i.test(html);
}
/**
 * استخراج نام فایل ماژول از مسیر HTML.
 * مثال: src/pages/home.html → home.zenith.js
 */
export function getModuleName(htmlPath) {
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
export async function transformHtml(html, htmlPath, options = {}) {
    const warnings = [];
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
    const directives = [];
    let match;
    while ((match = directiveRegex.exec(html)) !== null) {
        const name = match[1] ?? '';
        const rawValue = match[2] || '';
        const value = rawValue.replace(/^["']|["']$/g, '');
        // اعتبارسنجی expression برای directiveهای دارای expression
        const EXPRESSION_DIRECTIVES = new Set([
            'zen-text', 'zen-if', 'zen-show', 'zen-bind', 'zen-model', 'zen-html',
            // FEATURE (v0.4.0): zen-html-trusted هم expression دارد مثل zen-html.
            'zen-html-trusted',
        ]);
        if (EXPRESSION_DIRECTIVES.has(name) && value) {
            try {
                compileExpression(value);
            }
            catch (e) {
                warnings.push(`Expression error in ${name}="${value}" at offset ${match.index}: ${e.message}`);
                if (options.strict) {
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
    let compiled;
    try {
        compiled = await compileTemplate(html, { strict: options.strict });
    }
    catch (e) {
        warnings.push(`Compiler error: ${e.message}`);
        if (options.strict)
            throw e;
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
        // اگر این directive یک runtime directive است، آن را حفظ کن
        if (runtimeDirectiveNames.has(d.fullMatch.trim())) {
            continue;
        }
        // در غیر این صورت، آن را با data-zenith-compiled جایگزین کن
        const compiledAttr = ` data-zenith-compiled="${d.name}"`;
        strippedHtml = strippedHtml.replace(d.fullMatch, compiledAttr);
    }
    // ── تولید JavaScript module code ──
    const moduleName = getModuleName(htmlPath);
    const jsCode = generateModule(compiled, moduleName);
    // ── اضافه کردن script tag به HTML ──
    // script را به body اضافه می‌کنیم (اگر body وجود دارد).
    const scriptTag = `<script type="module" src="/${moduleName}"></script>`;
    if (strippedHtml.includes('</body>')) {
        strippedHtml = strippedHtml.replace('</body>', `  ${scriptTag}\n</body>`);
    }
    else if (strippedHtml.includes('</html>')) {
        strippedHtml = strippedHtml.replace('</html>', `  ${scriptTag}\n</html>`);
    }
    else {
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
function generateModule(compiled, moduleName) {
    const lines = [];
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
    // به‌عنوان پارامتر پنجم برای zen-html دریافت می‌کند.
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
    // تابع teardown برمی‌گرداند که در __entry.dispose ذخیره می‌شود و هنگام
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
        lines.push(`    // OPTIMIZATION (v1.0.0): قبلاً برای هر عنصر، Zen.start صدا زده می‌شد که`);
        lines.push(`    // باعث duplicate Event Delegation listeners می‌شد. حالا یک‌بار setup + walkAndBind.`);
        lines.push(`    if (typeof Zen !== 'undefined' && Zen.start && typeof walkAndBind === 'function') {`);
        lines.push(`      const dummy = document.createElement('div');`);
        lines.push(`      try { Zen.start(dummy, window.__ZENITH_STATE__ || {}, { devtools: false }); }`);
        lines.push(`      catch (e) { console.error('[Zenith] One-time setup failed:', e); }`);
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
export function analyzeHtml(html, htmlPath = '<inline>') {
    const warnings = [];
    const errors = [];
    if (!hasZenithDirectives(html)) {
        return { directiveCount: 0, warnings, errors };
    }
    const directiveRegex = /\s(zen-[a-z][a-z0-9-]*)(?:=("[^"]*"|'[^']*'|[^\s>]+))?/gi;
    let match;
    let count = 0;
    while ((match = directiveRegex.exec(html)) !== null) {
        const name = match[1] ?? '';
        const value = (match[2] || '').replace(/^["']|["']$/g, '');
        count++;
        const EXPRESSION_DIRECTIVES = new Set([
            'zen-text', 'zen-if', 'zen-show', 'zen-bind', 'zen-model', 'zen-html',
            // FEATURE (v0.4.0): zen-html-trusted هم expression دارد مثل zen-html.
            'zen-html-trusted',
        ]);
        if (EXPRESSION_DIRECTIVES.has(name)) {
            if (!value) {
                errors.push(`${htmlPath}: ${name} has empty expression`);
                continue;
            }
            try {
                compileExpression(value);
            }
            catch (e) {
                errors.push(`${htmlPath}: ${name}="${value}" — ${e.message}`);
            }
        }
    }
    return { directiveCount: count, warnings, errors };
}
//# sourceMappingURL=compile.js.map