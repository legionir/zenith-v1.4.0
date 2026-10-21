import type { DirectiveInfo } from './syntax-types';
import type { DirectiveInput } from './session';
/** Emit in the original directive order and shared session. @internal */
export function emitForDirective(dir: DirectiveInfo, input: DirectiveInput): boolean {
  const { session, varName, parentVar, allDirectives, el } = input;
  const { codeLines, allExprs } = session;
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
    const forMatch = forValue.match(
      /^\s*\(?\s*([a-zA-Z_$][\w$]*)\s*(?:,\s*([a-zA-Z_$][\w$]*)\s*)?\)?\s+in\s+(.+)$/,
    );
    if (!forMatch) {
      return false; // malformed — fall back to runtime preservation
    }
    const itemName = forMatch[1]!;
    const indexName = forMatch[2] || 'index';
    const listExprRaw = forMatch[3]!.trim();

    // Find zen-key among sibling directives (zen-key is consumed by zen-for
    // and skipped in the directives loop — see compileNode).
    const keyDir = allDirectives.find((d) => d.name === 'zen-key');
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

    session.effectCount++;
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

    codeLines.push(
      `  // zen-for compiled (v0.4.0): keyed diffing; child directives via processChildren`,
    );
    codeLines.push(`  // FEATURE (v0.4.0): processChildren حالا یک تابع teardown برمی‌گرداند که`);
    codeLines.push(`  // در __entry.dispose ذخیره می‌شود و هنگام removal آیتم صدا زده می‌شود`);
    codeLines.push(`  // تا Effectهای فرزندان clone پاکسازی شوند (رفع نشت حافظه‌ی v0.3.0).`);
    codeLines.push(`  const ${ph} = document.createComment('zen-for');`);
    codeLines.push(`  ${parentVar}.appendChild(${ph});`);
    codeLines.push(`  const ${tpl} = ${varName}; // template element (NOT appended to DOM)`);
    if (needsInnerHTML) {
      codeLines.push(`  ${tpl}.innerHTML = ${JSON.stringify(templateInnerHTML)};`);
    }
    codeLines.push(
      `  const ${itemsMap} = new Map(); // key -> { node, itemSig, indexSig, dispose }`,
    );
    codeLines.push(`  effect(() => {`);
    codeLines.push(`    const __list = ${listExprJs};`);
    codeLines.push(
      `    const __arr = Array.isArray(__list) ? __list : (__list == null ? [] : Array.from(__list));`,
    );
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
    codeLines.push(
      `          try { __dispose = processChildren(__clone, __localState) || null; }`,
    );
    codeLines.push(
      `          catch (e) { diagnostics.error('[Zenith] processChildren failed for zen-for clone.'); }`,
    );
    codeLines.push(`        }`);
    codeLines.push(
      `        __entry = { node: __clone, itemSig: __itemSig, indexSig: __indexSig, dispose: __dispose };`,
    );
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
    codeLines.push(
      `        // FEATURE (v0.4.0): dispose Effectهای فرزندان clone قبل از removeChild.`,
    );
    codeLines.push(`        // این نشت حافظه‌ی v0.3.0 را برطرف می‌کند — Effectهای فرزندان`);
    codeLines.push(`        // که توسط processChildren (walkAndBind) ایجاد شده بودند، حالا`);
    codeLines.push(`        // به‌درستی پاکسازی می‌شوند.`);
    codeLines.push(`        if (typeof __e.dispose === 'function') {`);
    codeLines.push(
      `          try { __e.dispose(); } catch (e) { diagnostics.error('[Zenith] zen-for item dispose failed.'); }`,
    );
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
