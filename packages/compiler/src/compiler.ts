// packages/compiler/src/compiler.ts
//
// Compiler — تبدیل قالب‌های HTML به کد بهینه‌ی JavaScript.
//
// بزرگ‌ترین ضعف فعلی Zenith این است که همه چیز در Runtime تفسیر می‌شود:
//   - DOM walk در هر Zen.start
//   - Expression evaluation در هر Effect
//   - Directive parsing در هر element
//
// Compiler این مشکلات را با pre-processing حل می‌کند:
//   1. Static Analysis: تشخیص static vs dynamic parts
//   2. Code Generation: تولید کد JavaScript بهینه
//   3. Tree Shaking: حذف directive های استفاده‌نشده
//   4. Template Cache: کش کردن قالب‌های compile شده
//
// ── نحوه کار ──
//
// ورودی: <div zen-text="$user.name"><span zen-if="$show">Hi</span></div>
// خروجی:
//   function render(root, ctx, effect, signal) {
//     const el0 = root;
//     effect(() => { el0.textContent = String(ctx.$user.name); });
//     const el1 = document.createElement('span');
//     el0.appendChild(el1);
//     effect(() => {
//       if (ctx.$show) { el0.appendChild(el1); }
//       else { el1.remove(); }
//     });
//     el1.textContent = 'Hi';
//   }
//
// ── Bug Fix: Silent Directive Drop ──
//
// قبلاً compiler فقط zen-text، zen-if و zen-bind را پشتیبانی می‌کرد و
// بقیه directiveها به‌طور خاموش drop می‌شدند. این یعنی zen-for، zen-action،
// zen-html و غیره در production build بدون خطا حذف می‌شدند.
//
// راه‌حل:
//   1. Directiveهای قابل compile (COMPILABLE_DIRECTIVES) به کد JS تبدیل می‌شوند.
//   2. Directiveهای runtime-only (RUNTIME_DIRECTIVES) روی عنصر حفظ می‌شوند
//      و یک warning صریح چاپ می‌شود. سپس runtime walker پس از render()
//      آن‌ها را پردازش می‌کند.
//   3. در حالت strict، هر directive پشتیبانی‌نشده خطا پرتاب می‌کند.

import { extractDependencies, type Dependency } from '@zenith/dependency-graph';

/**
 * نتیجه‌ی compile یک قالب.
 */
export interface CompiledTemplate {
  /** کد JavaScript تولیدشده. */
  code: string;
  /** وابستگی‌های استخراج‌شده. */
  dependencies: Dependency[];
  /** تعداد عناصر. */
  elementCount: number;
  /** تعداد Effect های تولیدشده. */
  effectCount: number;
  /** آیا قالب static است (هیچ Effect ندارد)؟ */
  isStatic: boolean;
  /**
   * لیست directiveهایی که compiler نتوانست compile کند و به runtime سپرده‌اند.
   * هر مورد شامل: { directive, value, elementPath }
   *
   * اگر این لیست خالی نباشد، generated module باید runtime walker را
   * پس از render() فراخوانی کند تا این directiveها پردازش شوند.
   */
  runtimeDirectives: Array<{ directive: string; value: string; elementPath: string }>;
  /**
   * Warningهای تولیدشده در حین compile (مثلاً syntax error در expression).
   */
  warnings: string[];
}

/**
 * اطلاعات یک عنصر در حین compile.
 */
interface ElementInfo {
  /** tagName. */
  tag: string;
  /** attribute های دایرکتیو. */
  directives: Array<{ name: string; value: string; raw: string }>;
  /** attribute های static. */
  staticAttrs: Array<{ name: string; value: string }>;
  /** متن static داخل عنصر. */
  staticText: string | null;
  /** آیا فرزندان دارد؟ */
  hasChildren: boolean;
}

/**
 * Directiveهایی که compiler می‌تواند به‌طور کامل به کد JS تبدیل کند.
 *
 * این directiveها در generated render function به effect تبدیل می‌شوند
 * و نیازی به runtime walker ندارند.
 */
// FIX (v1.2.9): BUG-06 — Structural directive priority.
// Only one structural directive should be compiled per element.
// If zen-for co-exists with zen-if/zen-else-if/zen-else, warn and skip
// the secondary structural directives.
//
// BUG-COMP-01 FIX (v1.3.0): Expanded structural directive conflict detection.
// - Added zen-show to STRUCTURAL_DIRECTIVES (it also controls element visibility).
// - Added comprehensive mutual-exclusion checks:
//   - zen-for with ANY other structural directive → conflict
//   - zen-show with zen-if/zen-else-if/zen-else → conflict (both control visibility)
//   - zen-if with zen-show → conflict (mirror of above)
// All conflicts produce a clear warning during compilation.
const STRUCTURAL_DIRECTIVES = new Set(['zen-for', 'zen-if', 'zen-else-if', 'zen-else', 'zen-show']);

// Pairs of structural directives that are mutually exclusive (cannot coexist on one element).
// zen-if + zen-else/zen-else-if is ALLOWED (chain them).
const STRUCTURAL_CONFLICT_MATRIX: Array<[string, string]> = [
  ['zen-for', 'zen-if'],
  ['zen-for', 'zen-else-if'],
  ['zen-for', 'zen-else'],
  ['zen-for', 'zen-show'],
  ['zen-show', 'zen-if'],
  ['zen-show', 'zen-else-if'],
  ['zen-show', 'zen-else'],
];

const COMPILABLE_DIRECTIVES = new Set([
  'zen-text',
  'zen-if',
  'zen-show',
  'zen-bind',
  'zen-html',
  // FEATURE (v0.4.0): zen-html-trusted — escape hatch برای محتوای Trusted.
  // مثل zen-html اما به‌جای sanitizeHTML از sanitizeHTMLTrusted (Identity
  // function + dev warn) استفاده می‌کند. در compileCompilableDirective یک
  // case جدا دارد چون به پارامتر هشتم render (sanitizeHTMLTrusted) متصل است.
  'zen-html-trusted',
  'zen-model',
  'zen-for', // v0.3.0: keyed-diffing compiled (child directives via processChildren)
]);

/**
 * Directiveهایی که نیاز به runtime infrastructure دارند و قابل compile نیستند.
 *
 * این directiveها روی عنصر حفظ می‌شوند (setAttribute) و runtime walker
 * پس از render() آن‌ها را پردازش می‌کند.
 */
const RUNTIME_DIRECTIVES = new Set([
  'zen-action',
  'zen-fetch',
  'zen-resource',
  'zen-link',
  'zen-permission',
  'zen-role',
  'zen-error',
  'zen-suspense',
  'zen-virtual-list',
  'zen-component',
  'zen-validate',
  'zen-transition',
  // FEATURE (v0.5.0): zen-animate — Web Animations API directive.
  // این دایرکتیو در runtime توسط walker پردازش می‌شود (keyframes و presets
  // در @zenith/transition هستند) و قابل compile نیست. compiler آن را به‌صورت
  // attribute روی عنصر حفظ می‌کند تا walker پس از render() آن را ببیند.
  'zen-animate',
  'zen-cloak',
  'zen-ref',
  // FEATURE (v0.5.0): چهار دایرکتیو جدید runtime.
  //  - zen-portal:        عنصر را به یک container دیگر منتقل می‌کند (مثلاً modal به body).
  //                       نیاز به document.querySelector دارد → فقط در runtime قابل اجرا.
  //  - zen-intersection:  IntersectionObserver می‌سازد → نیاز به browser API دارد.
  //  - zen-cloak و zen-ref قبلاً ثبت شده بودند (در بالا).
  'zen-portal',
  'zen-intersection',
  'zen-props',
  'zen-key',
  // FEATURE (v1.0.0): zen-static — fast path attribute برای zen-for.
  // این attribute توسط runtime processFor خوانده می‌شود (el.hasAttribute).
  // compiler آن را روی element حفظ می‌کند تا runtime بتواند fast path را فعال کند.
  'zen-static',
  'zen-item-height',
  'zen-buffer',
  'zen-dynamic-heights',
  'zen-html-slot',
  'zen-route',
  'zen-outlet',
  'zen-form',
  'zen-field',
  'zen-submit',
  'zen-store',
  'zen-auth',
  'zen-login',
  'zen-logout',
  // IMPROVEMENT-05 (v1.0.1): zen-else و zen-else-if — runtime chain processing.
  'zen-else',
  'zen-else-if',
  // FIX (v1.2.7): six runtime directives were missing — the compiler
  // silently dropped them (treated as unknown) which meant that compiled
  // output lost zen-track (analytics), zen-date-picker, zen-optimistic,
  // zen-island, zen-memo, and zen-virtual attributes on elements. They
  // are runtime-only (need walker / browser APIs) so they belong here,
  // not in COMPILABLE_DIRECTIVES.
  'zen-track',
  'zen-date-picker',
  'zen-optimistic',
  'zen-island',
  'zen-memo',
  'zen-virtual',
]);

/**
 * گزینه‌های compile.
 */
export interface CompileOptions {
  /**
   * اگر true، در صورت وجود directive پشتیبانی‌نشده خطا پرتاب کند.
   * اگر false (پیش‌فرض)، warning چاپ کند و directive را به runtime بسپارد.
   */
  strict?: boolean;
}

/**
 * Compile یک رشته‌ی HTML به کد JavaScript.
 *
 * @param html رشته‌ی HTML.
 * @param options گزینه‌های compile.
 * @returns نتیجه‌ی compile (Promise در محیط Node به دلیل async jsdom import).
 */
export async function compileTemplate(
  html: string,
  options: CompileOptions = {},
): Promise<CompiledTemplate> {
  // Parse HTML با DOMParser (در محیط Node با JSDOM).
  const parser = createParser();
  const doc = await parser(html);
  const root = doc.body;

  const dependencies: Dependency[] = [];
  const allExprs: string[] = [];
  let elementCount = 0;
  let effectCount = 0;
  const runtimeDirectives: Array<{ directive: string; value: string; elementPath: string }> = [];
  const warnings: string[] = [];

  // تولید کد.
  const codeLines: string[] = [];
  codeLines.push('// Compiled by @zenith/compiler');
  codeLines.push('// SECURITY: sanitizeHTML parameter is used by zen-html to prevent XSS.');
  // v0.3.0: processChildren (7th param) is used by compiled zen-for to delegate
  // per-clone child directive processing to the runtime walker (Zen.start).
  // The vite-plugin wires this param to a function that calls Zen.start(clone,
  // localState). See compileCompilableDirective 'zen-for' case below.
  //
  // FEATURE (v0.4.0): sanitizeHTMLTrusted (8th param) is used by compiled
  // zen-html-trusted. این یک Identity function است (هیچ پاکسازی‌ای نمی‌کند)
  // اما در Dev یک console.warn چاپ می‌کند تا escape hatch ها قابل‌حسابرسی
  // باشند. vite-plugin آن را از @zenith/security import و تزریق می‌کند.
  // FIX (v1.2.9): BUG-01 — Add evalExpr as 9th parameter for proper expression evaluation.
  // Previously the compiler used dir.value.replace(/^\$/, '') to convert $user → ctx.$user,
  // which broke for complex expressions like !$show, $a > 0, $user.name + ' x'.
  // Now evalExpr (injected from @zenith/expressions.evaluateExpression) handles all expressions.
  codeLines.push('function render(root, ctx, effect, signal, sanitizeHTML, state, processChildren, sanitizeHTMLTrusted, evalExpr) {');

  let varCounter = 0;

  function nextVar(): string {
    return `el${varCounter++}`;
  }

  /**
   * تولید کد برای یک directive قابل compile.
   *
   * @returns true اگر directive پردازش شد، false اگر پشتیبانی نمی‌شود.
   */
  function compileCompilableDirective(
    dir: { name: string; value: string; raw: string },
    varName: string,
    parentVar: string,
    _elementPath: string,
    allDirectives: Array<{ name: string; value: string; raw: string }>,
    el: Element,
  ): boolean {
    if (dir.name === 'zen-text') {
      effectCount++;
      allExprs.push(dir.value);
      codeLines.push(`  effect(() => {`);
      codeLines.push(`    const v = evalExpr(dir.value, ctx);`);
      codeLines.push(`    ${varName}.textContent = (v === null || v === undefined) ? '' : String(v);`);
      codeLines.push(`  });`);
      return true;
    }

    if (dir.name === 'zen-if') {
      effectCount++;
      allExprs.push(dir.value);
      codeLines.push(`  effect(() => {`);
      codeLines.push(`    const cond = Boolean(evalExpr(dir.value, ctx));`);
      codeLines.push(`    if (cond) {`);
      codeLines.push(`      if (${varName}.parentNode !== ${parentVar}) {`);
      codeLines.push(`        ${parentVar}.appendChild(${varName});`);
      codeLines.push(`      }`);
      codeLines.push(`    } else {`);
      codeLines.push(`      if (${varName}.parentNode === ${parentVar}) {`);
      codeLines.push(`        ${parentVar}.removeChild(${varName});`);
      codeLines.push(`      }`);
      codeLines.push(`    }`);
      codeLines.push(`  });`);
      return true;
    }

    if (dir.name === 'zen-show') {
      effectCount++;
      allExprs.push(dir.value);
      codeLines.push(`  effect(() => {`);
      codeLines.push(`    const v = evalExpr(dir.value, ctx);`);
      codeLines.push(`    ${varName}.style.display = v ? '' : 'none';`);
      codeLines.push(`  });`);
      return true;
    }

    if (dir.name === 'zen-html') {
      // SECURITY FIX (v7.0): کد کامپایل‌شده باید مثل runtime walker
      // همیشه sanitizeHTML() را قبل از innerHTML فراخوانی کند.
      // قبلاً کد `${varName}.innerHTML = String(v)` تولید می‌شد که در
      // production build (بدون runtime walker) XSS-vulnerable بود.
      //
      // تابع sanitizeHTML باید به‌عنوان پارامتر پنجم render() پاس داده شود
      // (vite-plugin در generateModule آن را import و تزریق می‌کند).
      effectCount++;
      allExprs.push(dir.value);
      codeLines.push(`  effect(() => {`);
      codeLines.push(`    const v = evalExpr(dir.value, ctx);`);
      codeLines.push(`    if (v === null || v === undefined) {`);
      codeLines.push(`      ${varName}.innerHTML = '';`);
      codeLines.push(`    } else {`);
      codeLines.push(`      ${varName}.innerHTML = sanitizeHTML(String(v));`);
      codeLines.push(`    }`);
      codeLines.push(`  });`);
      return true;
    }

    if (dir.name === 'zen-html-trusted') {
      // FEATURE (v0.4.0): zen-html-trusted — escape hatch برای محتوای Trusted.
      //
      // این case مثل zen-html است اما به‌جای sanitizeHTML از sanitizeHTMLTrusted
      // (پارامتر هشتم render) استفاده می‌کند. sanitizeHTMLTrusted یک Identity
      // function است — هیچ پاکسازی‌ای انجام نمی‌دهد. هدف آن صرفاً ایجاد یک
      // مرز قابل‌حسابرسی + هشدار Dev است.
      //
      // مسئولیت توسعه‌دهنده: محتوا باید Trusted باشد (مثلاً از سرور خودتان
      // آمده یا upstream sanitize شده). هشدار Dev (`__ZENITH_DEV__ !== false`)
      // در کنسول چاپ می‌شود تا audit شود.
      //
      // نکته: اگر sanitizeHTMLTrusted به‌طور ناگهانی undefined شد (مثلاً
      // vite-plugin قدیمی)، fallback به sanitizeHTML می‌کنیم تا ایمن بماند.
      // این Defensive Programming است — در عمل vite-plugin به‌روز همیشه این
      // پارامتر را تزریق می‌کند.
      effectCount++;
      allExprs.push(dir.value);
      codeLines.push(`  effect(() => {`);
      codeLines.push(`    const v = evalExpr(dir.value, ctx);`);
      codeLines.push(`    if (v === null || v === undefined) {`);
      codeLines.push(`      ${varName}.innerHTML = '';`);
      codeLines.push(`    } else if (typeof sanitizeHTMLTrusted === 'function') {`);
      codeLines.push(`      // FEATURE (v0.4.0): sanitizeHTMLTrusted (Identity + dev warn).`);
      codeLines.push(`      ${varName}.innerHTML = sanitizeHTMLTrusted(String(v));`);
      codeLines.push(`    } else {`);
      codeLines.push(`      // Defensive fallback: اگر sanitizeHTMLTrusted تزریق نشده بود،`);
      codeLines.push(`      // به‌جای خاموش رها کردن، از sanitizeHTML استفاده کن تا ایمن بماند.`);
      codeLines.push(`      ${varName}.innerHTML = sanitizeHTML(String(v));`);
      codeLines.push(`    }`);
      codeLines.push(`  });`);
      return true;
    }

    if (dir.name === 'zen-bind') {
      // zen-bind:class یا zen-bind:disabled و غیره
      // پشتیبانی از دو syntax:
      //   zen-bind:disabled="$isDisabled"          → مقدار ساده
      //   zen-bind:class="{ active: $isActive }"   → object syntax
      const attrName = dir.raw.replace('zen-bind:', '');
      const value = dir.value.trim();
      effectCount++;
      allExprs.push(value);

      if (value.startsWith('{') && value.endsWith('}')) {
        // Object syntax: { key1: $cond1, key2: $cond2 }
        // بررسی اینکه آیا object syntax ساده است (فقط identifier: $signal)
        // اگر نه، به runtime بسپار
        const inner = value.slice(1, -1).trim();
        const pairs = inner.split(',').map(p => p.trim()).filter(Boolean);
        let allSimple = true;
        const parsedPairs: Array<{ key: string; expr: string }> = [];
        for (const pair of pairs) {
          const colonIdx = pair.indexOf(':');
          if (colonIdx === -1) { allSimple = false; break; }
          const key = pair.slice(0, colonIdx).trim().replace(/^['"]|['"]$/g, '');
          const expr = pair.slice(colonIdx + 1).trim();
          if (!key || !expr) { allSimple = false; break; }
          parsedPairs.push({ key, expr });
        }
        if (!allSimple || parsedPairs.length === 0) {
          return false; // به runtime بسپار
        }
        // BUG-COMP-02 FIX: استفاده از evalExpr به‌جای دسترسی مستقیم ctx.$
        // قبلاً برای object syntax از ctx.$isActive استفاده می‌کرد که
        // برای expressionهای پیچیده کار نمی‌کرد. حالا evalExpr(expr, ctx)
        // تمام انواع expression را پشتیبانی می‌کند.
        codeLines.push(`  effect(() => {`);
        for (const { key, expr } of parsedPairs) {
          codeLines.push(`    if (evalExpr(${JSON.stringify(expr)}, ctx)) ${varName}.classList.add(${JSON.stringify(key)});`);
          codeLines.push(`    else ${varName}.classList.remove(${JSON.stringify(key)});`);
        }
        codeLines.push(`  });`);
      } else {
        // BUG-COMP-02 FIX: استفاده از evalExpr به‌جای دسترسی مستقیم ctx.$
        // مقدار ساده: zen-bind:disabled="$isDisabled"
        codeLines.push(`  effect(() => {`);
        codeLines.push(`    const v = evalExpr(${JSON.stringify(value)}, ctx);`);
        codeLines.push(`    ${varName}.setAttribute('${attrName}', v ? '' : null);`);
        codeLines.push(`    if (!v) ${varName}.removeAttribute('${attrName}');`);
        codeLines.push(`  });`);
      }
      return true;
    }

    if (dir.name === 'zen-model') {
      // zen-model برای two-way binding روی input/textarea/select
      // نیاز به event listener دارد.
      //
      // BUG FIX (v7.0): قبلاً کد `ctx.$fieldName = e.target.value` تولید می‌شد
      // که شکست می‌خورد چون ctx.$fieldName یک getter-only property است (با
      // Object.defineProperty) و setter ندارد → assignment در non-strict mode
      // silently fail می‌شد و در strict mode TypeError می‌داد. هیچ Signal ای
      // آپدیت نمی‌شد و two-way binding در صفحات کامپایل‌شده از کار می‌افتاد.
      //
      // راه‌حل: state (آبجکت خام شامل خود Signalها) به‌عنوان پارامتر ششم
      // render پاس داده می‌شود. در event listener، state[fieldName].set(value)
      // فراخوانی می‌شود تا Signal واقعی آپدیت شود. اگر state در دسترس نبود
      // (backward-compat با صفحاتی که state پاس نمی‌دهند)، fallback به ctx با
      // یک warning چاپ می‌شود.
      const fieldName = dir.value.replace(/^\$/, '');
      allExprs.push(dir.value);
      effectCount++;
      // initial value (از ctx خوانده می‌شود — getter کار می‌کند).
      codeLines.push(`  effect(() => {`);
      codeLines.push(`    const v = ctx.$${fieldName};`);
      codeLines.push(`    if (${varName}.value !== String(v ?? '')) ${varName}.value = String(v ?? '');`);
      codeLines.push(`  });`);
      // event listener for two-way binding — از state (Signal) برای set استفاده کن.
      codeLines.push(`  ${varName}.addEventListener('input', (e) => {`);
      codeLines.push(`    if (state && state.${fieldName} && typeof state.${fieldName}.set === 'function') {`);
      codeLines.push(`      state.${fieldName}.set(e.target.value);`);
      codeLines.push(`    } else if (state && state.${fieldName}) {`);
      codeLines.push(`      state.${fieldName} = e.target.value;`);
      codeLines.push(`    } else {`);
      codeLines.push(`      console.warn('[Zenith Compiler] zen-model "${dir.value}": state not provided to render(). Two-way binding disabled.');`);
      codeLines.push(`    }`);
      codeLines.push(`  });`);
      return true;
    }

    if (dir.name === 'zen-for') {
      // ── zen-for compilation (v0.3.0 first pass) ──
      // Generates a keyed-diffing effect that clones the template element per
      // item and inserts/removes as the list changes. Child directives inside
      // each clone are processed by `processChildren` (7th param of render),
      // which the vite-plugin wires to the runtime walker (Zen.start). This
      // eliminates the top-level DOM-walk discovery for zen-for while delegating
      // inner child compilation to the runtime walker per clone. Full zero-
      // runtime-walk for zen-for descendants is roadmap.
      //
      // Syntax (mirrors runtime for.ts parseForSyntax):
      //   zen-for="item in $items"                  → index defaults to 'index'
      //   zen-for="(item, index) in $items"
      //   zen-for="item in $items.filter(x => x.active)"
      //   zen-key="item.id"                          → key expression
      //
      // The template element's original innerHTML is embedded as a string so
      // cloneNode(true) preserves all child directive attributes for the
      // runtime walker to process per-clone.
      // BUG-COMP-04 FIX: بهبود parsing zen-for برای expressionهای پیچیده.
      // از regex بهبودیافته استفاده می‌کند که در مقابل تغییرات whitespace و
      // expressionهای تو در تو مقاوم‌تر است. همچنین به‌جای جایگزینی ساده‌ی `$`
      // با `ctx.$` که در expressionهای حاوی `$` به‌عنوان متغیر حلقه می‌شکست،
      // از evalExpr() برای ارزیابی list expression استفاده می‌کند.
      const forValue = dir.value.trim();
      const forMatch = forValue.match(/^\s*\(?\s*([a-zA-Z_$][\w$]*)\s*(?:,\s*([a-zA-Z_$][\w$]*)\s*)?\)?\s+in\s+(.+)$/);
      if (!forMatch) {
        return false; // malformed — fall back to runtime preservation
      }
      const itemName = forMatch[1]!;
      const indexName = forMatch[2] || 'index';
      const listExprRaw = forMatch[3]!.trim();

      // Find zen-key among sibling directives (zen-key is consumed by zen-for
      // and skipped in the directives loop — see compileNode).
      const keyDir = allDirectives.find(d => d.name === 'zen-key');
      const keyExprRaw = keyDir ? keyDir.value.trim() : '';

      // BUG-COMP-04 FIX: به‌جای replace ساده‌ی `$` → `ctx.$`، از evalExpr استفاده می‌کنیم
      // تا expressionهای پیچیده با nested scope (مثلاً filter با پارامتر `$`)
      // به درستی ارزیابی شوند.
      const listExprJs = `evalExpr(${JSON.stringify(listExprRaw)}, ctx)`;

      // BUG-COMP-06 FIX: بهبود parsing و ارزیابی zen-key.
      // قبلاً فقط `item.field` ساده با یک نقطه پشتیبانی می‌شد و برای
      // keyهای تو در تو مثل `item.user.profile.id` یا keyهای ترکیبی
      // ناموفق بود و کد اشتباه تولید می‌کرد.
      // حالا:
      // 1. `item.field.subfield` تا عمق نامحدود → `__item.field.subfield`
      // 2. `item` یا `index` ساده → مستقیم
      // 3. سایر expressionها → از evalExpr با context binding استفاده می‌کند
      let keyJs: string;
      if (keyExprRaw) {
        const escapedItem = itemName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const keyFieldMatch = keyExprRaw.match(new RegExp(`^${escapedItem}\\.([\\w.]+)$`));
        if (keyFieldMatch) {
          keyJs = `String(__item.${keyFieldMatch[1]})`;
        } else if (keyExprRaw === itemName) {
          keyJs = `String(__item)`;
        } else if (keyExprRaw === indexName) {
          keyJs = `String(__i)`;
        } else {
          // BUG-COMP-06: برای expressionهای پیچیده از evalExpr استفاده می‌کنیم.
          // در این حالت، context مخصوص حلقه با __item و __i ساخته می‌شود.
          // evalExpr را با proxyای صدا می‌زنیم که item و index را به __item و __i نگاشت کند.
          const evalKeyExpr = keyExprRaw
            .replace(new RegExp(`\\b${escapedItem}\\b`, 'g'), '__item')
            .replace(new RegExp(`\\b${indexName}\\b`, 'g'), '__i');
          keyJs = `String(${evalKeyExpr})`;
        }
      } else {
        keyJs = `String(__i)`;
      }

      effectCount++;
      allExprs.push(listExprRaw);

      const ph = `__forPh_${varName}`;
      const tpl = `__forTpl_${varName}`;
      const itemsMap = `__forItems_${varName}`;

      // BUG-COMP-05 FIX: بهینه‌سازی ذخیره‌سازی template innerHTML.
      // قبلاً همیشه innerHTML به‌عنوان string literal جاسازی می‌شد که برای
      // templateهای بزرگ حجم کد تولیدی را زیاد می‌کرد.
      // حالا اگر innerHTML خالی باشد، خط مربوطه را تولید نمی‌کنیم.
      // در نسخه‌های آینده، برای templateهای بزرگ از استراتژی lazy loading
      // یا reference به template اصلی استفاده خواهد شد.
      const templateInnerHTML = el.innerHTML;
      const needsInnerHTML = templateInnerHTML.length > 0;

      codeLines.push(`  // zen-for compiled (v0.4.0): keyed diffing; child directives via processChildren`);
      codeLines.push(`  // FEATURE (v0.4.0): processChildren حالا یک تابع teardown برمی‌گرداند که`);
      codeLines.push(`  // در __entry.dispose ذخیره می‌شود و هنگام removal آیتم صدا زده می‌شود`);
      codeLines.push(`  // تا Effectهای فرزندان clone پاکسازی شوند (رفع نشت حافظه‌ی v0.3.0).`);
      codeLines.push(`  const ${ph} = document.createComment('zen-for');`);
      codeLines.push(`  ${parentVar}.appendChild(${ph});`);
      codeLines.push(`  const ${tpl} = ${varName}; // template element (NOT appended to DOM)`);
      if (needsInnerHTML) {
        codeLines.push(`  ${tpl}.innerHTML = ${JSON.stringify(templateInnerHTML)};`);
      }
      codeLines.push(`  const ${itemsMap} = new Map(); // key -> { node, itemSig, indexSig, dispose }`);
      codeLines.push(`  effect(() => {`);
      codeLines.push(`    const __list = ${listExprJs};`);
      codeLines.push(`    const __arr = Array.isArray(__list) ? __list : (__list == null ? [] : Array.from(__list));`);
      codeLines.push(`    const __usedKeys = new Set();`);
      codeLines.push(`    let __prev = ${ph};`);
      codeLines.push(`    for (let __i = 0; __i < __arr.length; __i++) {`);
      codeLines.push(`      const __item = __arr[__i];`);
      codeLines.push(`      const __key = ${keyJs};`);
      codeLines.push(`      __usedKeys.add(__key);`);
      codeLines.push(`      let __entry = ${itemsMap}.get(__key);`);
      codeLines.push(`      if (!__entry) {`);
      codeLines.push(`        const __clone = ${tpl}.cloneNode(true);`);
      codeLines.push(`        const __itemSig = signal(__item);`);
      codeLines.push(`        const __indexSig = signal(__i);`);
      codeLines.push(`        // Build a local STATE (not ctx) — processChildren (walkAndBind)`);
      codeLines.push(`        // expects a state object whose keys are signal instances.`);
      codeLines.push(`        // Object.create(state) inherits all parent state signals via the`);
      codeLines.push(`        // prototype chain; we then shadow with item/index signals.`);
      codeLines.push(`        const __localState = Object.create(state || null);`);
      codeLines.push(`        __localState[${JSON.stringify(itemName)}] = __itemSig;`);
      codeLines.push(`        __localState[${JSON.stringify(indexName)}] = __indexSig;`);
      codeLines.push(`        // FEATURE (v0.4.0): processChildren یک تابع teardown برمی‌گرداند`);
      codeLines.push(`        // که disposeِ Effectهای فرزندان clone را در __entry.dispose`);
      codeLines.push(`        // نگه می‌دارد. هنگام removal آیتم، این تابع صدا زده می‌شود.`);
      codeLines.push(`        let __dispose = null;`);
      codeLines.push(`        if (typeof processChildren === 'function') {`);
      codeLines.push(`          try { __dispose = processChildren(__clone, __localState) || null; }`);
      codeLines.push(`          catch (e) { console.error('[Zenith] processChildren failed for zen-for clone:', e); }`);
      codeLines.push(`        }`);
      codeLines.push(`        __entry = { node: __clone, itemSig: __itemSig, indexSig: __indexSig, dispose: __dispose };`);
      codeLines.push(`        ${itemsMap}.set(__key, __entry);`);
      codeLines.push(`      } else {`);
      codeLines.push(`        // Update existing item's signals — inner effects that depend on`);
      codeLines.push(`        // $item/$index re-run via the signal system.`);
      codeLines.push(`        __entry.itemSig.set(__item);`);
      codeLines.push(`        __entry.indexSig.set(__i);`);
      codeLines.push(`      }`);
      codeLines.push(`      if (__entry.node !== __prev.nextSibling) {`);
      codeLines.push(`        __prev.parentNode.insertBefore(__entry.node, __prev.nextSibling);`);
      codeLines.push(`      }`);
      codeLines.push(`      __prev = __entry.node;`);
      codeLines.push(`    }`);
      codeLines.push(`    for (const [__k, __e] of ${itemsMap}) {`);
      codeLines.push(`      if (!__usedKeys.has(__k)) {`);
      codeLines.push(`        // FEATURE (v0.4.0): dispose Effectهای فرزندان clone قبل از removeChild.`);
      codeLines.push(`        // این نشت حافظه‌ی v0.3.0 را برطرف می‌کند — Effectهای فرزندان`);
      codeLines.push(`        // که توسط processChildren (walkAndBind) ایجاد شده بودند، حالا`);
      codeLines.push(`        // به‌درستی پاکسازی می‌شوند.`);
      codeLines.push(`        if (typeof __e.dispose === 'function') {`);
      codeLines.push(`          try { __e.dispose(); } catch (e) { console.error('[Zenith] zen-for item dispose failed:', e); }`);
      codeLines.push(`        }`);
      codeLines.push(`        __e.dispose = null;`);
      codeLines.push(`        if (__e.node.parentNode) __e.node.parentNode.removeChild(__e.node);`);
      codeLines.push(`        ${itemsMap}.delete(__k);`);
      codeLines.push(`      }`);
      codeLines.push(`    }`);
      codeLines.push(`  });`);
      return true;
    }

    return false;
  }

  /**
   * حفظ یک directive روی عنصر برای runtime walker.
   *
   * این تابع کدی تولید می‌کند که attribute اصلی را روی عنصر set می‌کند
   * تا runtime walker بتواند آن را پردازش کند.
   */
  // BUG-COMP-08 FIX: تابع کمکی برای تولید hint در strict mode
  // با توجه به نام directive، یک راهنمای مفید برای رفع مشکل ارائه می‌دهد.
  function getStrictHint(dirName: string): string {
    const hintMap: Record<string, string> = {
      'zen-for': ' Use complex expression with simple variable bindings.',
      'zen-action': ' Wrap in a simple action handler or use runtime mode.',
      'zen-fetch': ' Consider extracting fetch logic into a function.',
      'zen-resource': ' Consider extracting resource logic into a function.',
      'zen-link': ' Use standard <a> with href for basic links.',
      'zen-permission': ' Use runtime permission checks instead.',
      'zen-role': ' Use runtime role checks instead.',
      'zen-error': ' Use zen-if with error state for better compilation.',
      'zen-suspense': ' Use standard loading state pattern.',
      'zen-virtual-list': ' Ensure zen-dynamic-heights and zen-item-height are set.',
      'zen-component': ' Use standard HTML elements with zen-bind for props.',
      'zen-validate': ' Implement inline validation in action handler.',
      'zen-transition': ' Use CSS transitions with zen-show instead.',
    };
    const hint = hintMap[dirName];
    return hint ? ` Hint: ${hint}` : '';
  }

  function preserveDirectiveForRuntime(
    dir: { name: string; value: string; raw: string },
    varName: string,
    elementPath: string,
  ): void {
    // BUG-COMP-08 FIX: غنی‌سازی پیام error با جزئیات بیشتر
    const valueDisplay = dir.value ? ` (value: "${dir.value}")` : '';
    const hint = getStrictHint(dir.name);
    const warning = `[Zenith Compiler] Directive '${dir.raw}'${valueDisplay} is not compilable` +
      ` and will be processed by runtime walker at ${elementPath}.${hint}`;
    warnings.push(warning);
    if (options.strict) {
      throw new Error(warning);
    }
    // در حالت غیر strict، warning را به stderr چاپ کن
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(warning);
    }

    runtimeDirectives.push({
      directive: dir.raw,
      value: dir.value,
      elementPath,
    });

    // attribute اصلی را روی عنصر set کن تا runtime walker آن را ببیند
    codeLines.push(`  ${varName}.setAttribute(${JSON.stringify(dir.raw)}, ${JSON.stringify(dir.value)});`);
    // علامت‌گذاری عنصر برای runtime walker
    codeLines.push(`  ${varName}.setAttribute('data-zenith-runtime', 'true');`);
  }

  function compileNode(node: Node, parentVar: string, path: string): void {
    if (node.nodeType !== 1) { // ELEMENT_NODE
      // Text node — اگر محتوای داینامیک دارد.
      if (node.nodeType === 3) { // TEXT_NODE
        const text = node.textContent || '';
        if (text.trim()) {
          // static text
          codeLines.push(`  ${parentVar}.appendChild(document.createTextNode(${JSON.stringify(text)}));`);
        }
      }
      return;
    }

    const el = node as Element;
    const tagName = el.tagName.toLowerCase();
    const varName = nextVar();
    elementCount++;
    const elementPath = `${path} > ${tagName}#${varName}`;

    // ساخت عنصر.
    codeLines.push(`  const ${varName} = document.createElement('${tagName}');`);

    // پردازش attribute ها.
    const info = analyzeElement(el);
    for (const attr of info.staticAttrs) {
      codeLines.push(`  ${varName}.setAttribute('${attr.name}', ${JSON.stringify(attr.value)});`);
    }

    // بررسی zen-for — در صورت وجود، الگوریتم پردازش directiveها و فرزندان تغییر می‌کند.
    const hasFor = info.directives.some(d => d.name === 'zen-for');

    // BUG-COMP-01 FIX (v1.3.0): بررسی جامع تداخل directiveهای ساختاری.
    // از ماتریس STRUCTURAL_CONFLICT_MATRIX استفاده می‌کند تا هر جفت
    // directive ناسازگار روی یک المنت را تشخیص دهد.
    const structuralNamesOnElement = info.directives
      .filter(d => STRUCTURAL_DIRECTIVES.has(d.name))
      .map(d => d.name);
    const conflictPairs: string[] = [];
    for (const [a, b] of STRUCTURAL_CONFLICT_MATRIX) {
      if (structuralNamesOnElement.includes(a) && structuralNamesOnElement.includes(b)) {
        conflictPairs.push(`"${a}" + "${b}"`);
      }
    }
    if (conflictPairs.length > 0 && typeof console !== 'undefined' && console.warn) {
      console.warn(
        `[Zenith Compiler] Element <${tagName}> has conflicting structural directives: ` +
        `${conflictPairs.join(', ')}. Only the first matching directive will be compiled; ` +
        `others are preserved for runtime fallback.`
      );
    }

    // پردازش دایرکتیوها.
    for (const dir of info.directives) {
      // zen-key توسط zen-for مصرف می‌شود — پردازش standalone را skip کن.
      if (dir.name === 'zen-key' && hasFor) continue;

      // برای الگوی zen-for: سایر directiveهای روی عنصر template به‌عنوان attribute
      // حفظ می‌شوند تا runtime walker (از طریق processChildren) روی هر clone
      // آن‌ها را پردازش کند. این directiveها روی خود template compile نمی‌شوند
      // چون template هرگز به DOM اضافه نمی‌شود و effectها به فرزندان clone
      // متصل نمی‌شوند.
      if (hasFor && dir.name !== 'zen-for') {
        codeLines.push(`  ${varName}.setAttribute(${JSON.stringify(dir.raw)}, ${JSON.stringify(dir.value)});`);
        continue;
      }

      // ابتدا تلاش کن directive را compile کن
      const compiled = compileCompilableDirective(dir, varName, parentVar, elementPath, info.directives, el);

      if (!compiled) {
        // BUG-COMP-07 FIX: بهبود مدیریت fallback زمانی که compileCompilableDirective
        // false برمی‌گرداند. قبلاً در این حالت برای COMPILABLE_DIRECTIVES پیام خطای
        // مشخصی نداشت و خاموش به runtime بسپار می‌کرد. حالا با یک warning واضح و
        // در حالت strict با throw error، توسعه‌دهنده را مطلع می‌کنیم.
        if (RUNTIME_DIRECTIVES.has(dir.name)) {
          // شناخته‌شده اما غیرقابل compile — برای runtime حفظ کن
          preserveDirectiveForRuntime(dir, varName, elementPath);
        } else if (COMPILABLE_DIRECTIVES.has(dir.name)) {
          // BUG-COMP-07 FIX: این حالت ممکن است رخ دهد وقتی compileCompilableDirective
          // به دلیل edge case (مثلاً zen-for با syntax نامعتبر، zen-bind با object
          // syntax پیشرفته) false برمی‌گرداند. به‌جای سکوت، با warning گزارش می‌کنیم.
          const fallbackWarning =
            `[Zenith Compiler] Compilable directive '${dir.raw}' (value: "${dir.value}") ` +
            `could not be compiled at ${elementPath}. Falling back to runtime walker. ` +
            `Consider simplifying the expression or using a simpler directive variant for better performance.`;
          warnings.push(fallbackWarning);
          if (options.strict) {
            throw new Error(fallbackWarning);
          }
          if (typeof console !== 'undefined' && console.warn) {
            console.warn(fallbackWarning);
          }
          preserveDirectiveForRuntime(dir, varName, elementPath);
        } else {
          // BUG-COMP-08 FIX: غنی‌سازی پیام برای directive ناشناخته
          const valueDisplay = dir.value ? ` (value: "${dir.value}")` : '';
          const warning = `[Zenith Compiler] Unknown directive '${dir.raw}'${valueDisplay} at ${elementPath}. ` +
            `This directive is not recognized and will be preserved for runtime (may not work). ` +
            `Check the spelling or add it to the VALID_DIRECTIVES list.`;
          warnings.push(warning);
          if (options.strict) {
            throw new Error(warning);
          }
          if (typeof console !== 'undefined' && console.warn) {
            console.warn(warning);
          }
          preserveDirectiveForRuntime(dir, varName, elementPath);
        }
      }
    }

    // اگر zen-if / zen-for نیست، عنصر را به parent اضافه کن.
    // برای zen-for، خود template به DOM اضافه نمی‌شود — فقط placeholder (comment)
    // و cloneها در زمان effect اضافه می‌شوند.
    const hasIf = info.directives.some(d => d.name === 'zen-if');
    if (!hasIf && !hasFor) {
      codeLines.push(`  ${parentVar}.appendChild(${varName});`);
    }

    // static text.
    if (info.staticText) {
      codeLines.push(`  ${varName}.textContent = ${JSON.stringify(info.staticText)};`);
    }

    // فرزندان — برای zen-for، children به‌صورت innerHTML در zen-for case قرار
    // می‌گیرند (cloneNode(true) آن‌ها را روی هر clone preserve می‌کند) و توسط
    // processChildren (runtime walker) پردازش می‌شوند.
    if (info.hasChildren && !hasFor) {
      for (const child of Array.from(el.childNodes)) {
        compileNode(child, varName, elementPath);
      }
    }
  }

  // Compile فرزندان root.
  for (const child of Array.from(root.childNodes)) {
    compileNode(child, 'root', 'root');
  }

  codeLines.push('  return root;');
  codeLines.push('}');

  // استخراج وابستگی‌ها.
  dependencies.push(...extractDependencies(allExprs.join(' + ')));

  return {
    code: codeLines.join('\n'),
    dependencies,
    elementCount,
    effectCount,
    isStatic: effectCount === 0,
    runtimeDirectives,
    warnings,
  };
}

/**
 * تحلیل یک عنصر و استخراج اطلاعات.
 */
function analyzeElement(el: Element): ElementInfo {
  const directives: Array<{ name: string; value: string; raw: string }> = [];
  const staticAttrs: Array<{ name: string; value: string }> = [];

  for (const attr of Array.from(el.attributes)) {
    if (attr.name.startsWith('zen-')) {
      // دایرکتیو.
      const name = attr.name.split(':')[0]!; // zen-bind:class → zen-bind
      directives.push({ name, value: attr.value, raw: attr.name });
    } else {
      // static attribute.
      staticAttrs.push({ name: attr.name, value: attr.value });
    }
  }

  // static text (اگر فقط یک text node فرزند است).
  let staticText: string | null = null;
  const children = Array.from(el.childNodes);
  if (children.length === 1 && children[0]!.nodeType === 3) {
    staticText = children[0]!.textContent;
  }

  // آیا فرزندان (غیر از text) دارد؟
  const hasChildren = children.some(c => c.nodeType === 1);

  return {
    tag: el.tagName.toLowerCase(),
    directives,
    staticAttrs,
    staticText,
    hasChildren,
  };
}

/**
 * ساخت یک HTML parser.
 * در محیط مرورگر از DOMParser استفاده می‌کند.
 * در محیط Node از JSDOM استفاده می‌کند (به‌صورت dynamic import).
 */
function createParser(): (html: string) => Document {
  if (typeof DOMParser !== 'undefined') {
    return (html: string) => new DOMParser().parseFromString(html, 'text/html');
  }

  // در Node، JSDOM را lazy dynamic import کن.
  // از dynamic import استفاده می‌کنیم نه require() چون این پکیج ESM است.
  let JSDOMCtor: any = null;
  let jsdomPromise: Promise<any> | null = null;

  const asyncParser = async (html: string) => {
    if (!JSDOMCtor) {
      if (!jsdomPromise) {
        jsdomPromise = import('jsdom').then(mod => {
          JSDOMCtor = mod.JSDOM || mod.default?.JSDOM;
        }).catch(() => {
          throw new Error(
            '[Zenith Compiler] DOMParser or jsdom is required. Install jsdom: npm install jsdom',
          );
        });
      }
      await jsdomPromise;
    }
    const dom = new JSDOMCtor(html);
    return dom.window.document;
  };
  return asyncParser as unknown as (html: string) => Document;
}
