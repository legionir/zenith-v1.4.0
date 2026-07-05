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
import { extractDependencies } from '@zenith/dependency-graph';
/**
 * Directiveهایی که compiler می‌تواند به‌طور کامل به کد JS تبدیل کند.
 *
 * این directiveها در generated render function به effect تبدیل می‌شوند
 * و نیازی به runtime walker ندارند.
 */
// FIX (v1.2.9): BUG-06 — Structural directive priority.
const STRUCTURAL_DIRECTIVES = new Set(['zen-for', 'zen-if', 'zen-else-if', 'zen-else']);
const COMPILABLE_DIRECTIVES = new Set([
    'zen-text',
    'zen-if',
    'zen-show',
    'zen-bind',
    'zen-html',
    // FEATURE (v0.4.0): zen-html-trusted — escape hatch برای محتوای Trusted.
    // مثل zen-html اما به‌جای sanitizeHTML از sanitizeHTMLTrusted استفاده می‌کند.
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
    'zen-animate',
    'zen-cloak',
    'zen-ref',
    // FEATURE (v0.5.0): zen-portal و zen-intersection — runtime-only directives.
    'zen-portal',
    'zen-intersection',
    'zen-props',
    'zen-key',
    // FEATURE (v1.0.0): zen-static — fast path attribute برای zen-for.
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
    // IMPROVEMENT-05 (v1.0.1): zen-else و zen-else-if
    'zen-else',
    'zen-else-if',
    // FIX (v1.2.7): six runtime directives were missing — the compiler
    // silently dropped them (treated as unknown) which meant that compiled
    // output lost zen-track (analytics), zen-date-picker, zen-optimistic,
    // zen-island, zen-memo, and zen-virtual attributes on elements.
    'zen-track',
    'zen-date-picker',
    'zen-optimistic',
    'zen-island',
    'zen-memo',
    'zen-virtual',
]);
/**
 * Compile یک رشته‌ی HTML به کد JavaScript.
 *
 * @param html رشته‌ی HTML.
 * @param options گزینه‌های compile.
 * @returns نتیجه‌ی compile (Promise در محیط Node به دلیل async jsdom import).
 */
export async function compileTemplate(html, options = {}) {
    // Parse HTML با DOMParser (در محیط Node با JSDOM).
    const parser = createParser();
    const doc = await parser(html);
    const root = doc.body;
    const dependencies = [];
    const allExprs = [];
    let elementCount = 0;
    let effectCount = 0;
    const runtimeDirectives = [];
    const warnings = [];
    // تولید کد.
    const codeLines = [];
    codeLines.push('// Compiled by @zenith/compiler');
    codeLines.push('// SECURITY: sanitizeHTML parameter is used by zen-html to prevent XSS.');
    // v0.3.0: processChildren (7th param) is used by compiled zen-for to delegate
    // per-clone child directive processing to the runtime walker (Zen.start).
    //
    // FEATURE (v0.4.0): sanitizeHTMLTrusted (8th param) is used by compiled
    // zen-html-trusted. این یک Identity function است (هیچ پاکسازی‌ای نمی‌کند)
    // اما در Dev یک console.warn چاپ می‌کند تا escape hatch ها قابل‌حسابرسی
    // باشند. vite-plugin آن را از @zenith/security import و تزریق می‌کند.
    codeLines.push('function render(root, ctx, effect, signal, sanitizeHTML, state, processChildren, sanitizeHTMLTrusted, evalExpr) {');
    let varCounter = 0;
    function nextVar() {
        return `el${varCounter++}`;
    }
    /**
     * تولید کد برای یک directive قابل compile.
     *
     * @returns true اگر directive پردازش شد، false اگر پشتیبانی نمی‌شود.
     */
    function compileCompilableDirective(dir, varName, parentVar, _elementPath, allDirectives, el) {
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
            // نکته: اگر sanitizeHTMLTrusted به‌طور ناگهانی undefined شد (مثلاً
            // vite-plugin قدیمی)، fallback به sanitizeHTML می‌کنیم تا ایمن بماند.
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
            codeLines.push(`      // Defensive fallback: اگر sanitizeHTMLTrusted تزریق نشده بود.`);
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
                const parsedPairs = [];
                for (const pair of pairs) {
                    const colonIdx = pair.indexOf(':');
                    if (colonIdx === -1) {
                        allSimple = false;
                        break;
                    }
                    const key = pair.slice(0, colonIdx).trim().replace(/^['"]|['"]$/g, '');
                    const expr = pair.slice(colonIdx + 1).trim();
                    if (!key || !expr) {
                        allSimple = false;
                        break;
                    }
                    parsedPairs.push({ key, expr });
                }
                if (!allSimple || parsedPairs.length === 0) {
                    return false; // به runtime بسپار
                }
                // تولید کد برای object syntax
                codeLines.push(`  effect(() => {`);
                for (const { key, expr } of parsedPairs) {
                    const cond = expr.replace(/^\$/, '');
                    codeLines.push(`    if (ctx.$${cond}) ${varName}.classList.add(${JSON.stringify(key)});`);
                    codeLines.push(`    else ${varName}.classList.remove(${JSON.stringify(key)});`);
                }
                codeLines.push(`  });`);
            }
            else {
                // مقدار ساده: zen-bind:disabled="$isDisabled"
                const cond = value.replace(/^\$/, '').replace(/[{}]/g, '');
                codeLines.push(`  effect(() => {`);
                codeLines.push(`    const v = ctx.$${cond};`);
                codeLines.push(`    ${varName}.setAttribute('${attrName}', v ? '' : null);`);
                codeLines.push(`    if (!v) ${varName}.removeAttribute('${attrName}');`);
                codeLines.push(`  });`);
            }
            return true;
        }
        if (dir.name === 'zen-model') {
            // zen-model برای two-way binding روی input/textarea/select
            // نیاز به event listener دارد.
            // BUG FIX (v7.0): قبلاً `ctx.$fieldName = value` تولید می‌شد که شکست
            // می‌خورد چون ctx.$fieldName getter-only است. حالا از state (Signal)
            // استفاده می‌شود.
            const fieldName = dir.value.replace(/^\$/, '');
            allExprs.push(dir.value);
            effectCount++;
            // initial value
            codeLines.push(`  effect(() => {`);
            codeLines.push(`    const v = ctx.$${fieldName};`);
            codeLines.push(`    if (${varName}.value !== String(v ?? '')) ${varName}.value = String(v ?? '');`);
            codeLines.push(`  });`);
            // event listener for two-way binding — از state (Signal) برای set.
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
            // Keyed-diffing effect that clones the template element per item.
            // Child directives inside each clone are processed by `processChildren`
            // (7th param of render), which the vite-plugin wires to Zen.start.
            const forValue = dir.value.trim();
            const forMatch = forValue.match(/^\(?\s*([a-zA-Z_$][\w$]*)\s*(?:,\s*([a-zA-Z_$][\w$]*)\s*)?\)?\s+in\s+(.+)$/);
            if (!forMatch) {
                return false;
            }
            const itemName = forMatch[1];
            const indexName = forMatch[2] || 'index';
            const listExprRaw = forMatch[3].trim();
            const keyDir = allDirectives.find(d => d.name === 'zen-key');
            const keyExprRaw = keyDir ? keyDir.value.trim() : '';
            const listExprJs = listExprRaw.replace(/\$/g, 'ctx.$');
            let keyJs;
            if (keyExprRaw) {
                const keyFieldMatch = keyExprRaw.match(new RegExp(`^${itemName}\\.(\\w+)$`));
                if (keyFieldMatch) {
                    keyJs = `String(__item.${keyFieldMatch[1]})`;
                }
                else if (keyExprRaw === itemName) {
                    keyJs = `String(__item)`;
                }
                else if (keyExprRaw === indexName) {
                    keyJs = `String(__i)`;
                }
                else {
                    keyJs = `String(${keyExprRaw.replace(new RegExp(`\\b(${itemName}|${indexName})\\b`, 'g'), (m) => m === itemName ? '__item' : '__i')})`;
                }
            }
            else {
                keyJs = `String(__i)`;
            }
            effectCount++;
            allExprs.push(listExprRaw);
            const ph = `__forPh_${varName}`;
            const tpl = `__forTpl_${varName}`;
            const itemsMap = `__forItems_${varName}`;
            const templateInnerHTML = el.innerHTML;
            codeLines.push(`  // zen-for compiled (v0.4.0): keyed diffing; child directives via processChildren`);
            codeLines.push(`  // FEATURE (v0.4.0): processChildren حالا یک تابع teardown برمی‌گرداند که`);
            codeLines.push(`  // در __entry.dispose ذخیره می‌شود و هنگام removal آیتم صدا زده می‌شود`);
            codeLines.push(`  // تا Effectهای فرزندان clone پاکسازی شوند (رفع نشت حافظه‌ی v0.3.0).`);
            codeLines.push(`  const ${ph} = document.createComment('zen-for');`);
            codeLines.push(`  ${parentVar}.appendChild(${ph});`);
            codeLines.push(`  const ${tpl} = ${varName}; // template element (NOT appended to DOM)`);
            codeLines.push(`  ${tpl}.innerHTML = ${JSON.stringify(templateInnerHTML)};`);
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
    function preserveDirectiveForRuntime(dir, varName, elementPath) {
        const warning = `[Zenith Compiler] Directive '${dir.raw}' is not compilable and will be processed by runtime walker at ${elementPath}.`;
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
    function compileNode(node, parentVar, path) {
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
        const el = node;
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
        // FIX (v1.2.9): BUG-06 — Structural directive conflict detection.
        if (hasFor) {
            const conflicting = info.directives.filter(d => STRUCTURAL_DIRECTIVES.has(d.name) && d.name !== 'zen-for');
            if (conflicting.length > 0 && typeof console !== 'undefined' && console.warn) {
                console.warn(`[Zenith Compiler] Element has both zen-for and ${conflicting.map(d => d.name).join(', ')} — zen-for takes priority.`);
            }
        }
        // پردازش دایرکتیوها.
        for (const dir of info.directives) {
            // zen-key توسط zen-for مصرف می‌شود.
            if (dir.name === 'zen-key' && hasFor)
                continue;
            // برای الگوی zen-for: سایر directiveها به‌عنوان attribute روی template
            // حفظ می‌شوند تا runtime walker روی هر clone آن‌ها را پردازش کند.
            if (hasFor && dir.name !== 'zen-for') {
                codeLines.push(`  ${varName}.setAttribute(${JSON.stringify(dir.raw)}, ${JSON.stringify(dir.value)});`);
                continue;
            }
            // ابتدا تلاش کن directive را compile کن
            const compiled = compileCompilableDirective(dir, varName, parentVar, elementPath, info.directives, el);
            if (!compiled) {
                // اگر compile نشد، بررسی کن که آیا یک runtime directive شناخته‌شده است
                if (RUNTIME_DIRECTIVES.has(dir.name)) {
                    // شناخته‌شده اما غیرقابل compile — برای runtime حفظ کن
                    preserveDirectiveForRuntime(dir, varName, elementPath);
                }
                else if (COMPILABLE_DIRECTIVES.has(dir.name)) {
                    // این نمی‌تواند رخ دهد (compileCompilableDirective باید true برگرداند)
                    // اما برای safety:
                    preserveDirectiveForRuntime(dir, varName, elementPath);
                }
                else {
                    // directive کاملاً ناشناخته — warning و حفظ برای runtime
                    const warning = `[Zenith Compiler] Unknown directive '${dir.raw}' at ${elementPath}. Preserving for runtime (may not work).`;
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
        const hasIf = info.directives.some(d => d.name === 'zen-if');
        if (!hasIf && !hasFor) {
            codeLines.push(`  ${parentVar}.appendChild(${varName});`);
        }
        // static text.
        if (info.staticText) {
            codeLines.push(`  ${varName}.textContent = ${JSON.stringify(info.staticText)};`);
        }
        // فرزندان — برای zen-for، children به‌صورت innerHTML در zen-for case قرار می‌گیرند.
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
function analyzeElement(el) {
    const directives = [];
    const staticAttrs = [];
    for (const attr of Array.from(el.attributes)) {
        if (attr.name.startsWith('zen-')) {
            // دایرکتیو.
            const name = attr.name.split(':')[0]; // zen-bind:class → zen-bind
            directives.push({ name, value: attr.value, raw: attr.name });
        }
        else {
            // static attribute.
            staticAttrs.push({ name: attr.name, value: attr.value });
        }
    }
    // static text (اگر فقط یک text node فرزند است).
    let staticText = null;
    const children = Array.from(el.childNodes);
    if (children.length === 1 && children[0].nodeType === 3) {
        staticText = children[0].textContent;
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
function createParser() {
    if (typeof DOMParser !== 'undefined') {
        return (html) => new DOMParser().parseFromString(html, 'text/html');
    }
    // در Node، JSDOM را lazy dynamic import کن.
    // از dynamic import استفاده می‌کنیم نه require() چون این پکیج ESM است.
    let JSDOMCtor = null;
    let jsdomPromise = null;
    const asyncParser = async (html) => {
        if (!JSDOMCtor) {
            if (!jsdomPromise) {
                jsdomPromise = import('jsdom').then(mod => {
                    JSDOMCtor = mod.JSDOM || mod.default?.JSDOM;
                }).catch(() => {
                    throw new Error('[Zenith Compiler] DOMParser or jsdom is required. Install jsdom: npm install jsdom');
                });
            }
            await jsdomPromise;
        }
        const dom = new JSDOMCtor(html);
        return dom.window.document;
    };
    return asyncParser;
}
//# sourceMappingURL=compiler.js.map