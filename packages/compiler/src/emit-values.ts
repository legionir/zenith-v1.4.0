import type { DirectiveInfo } from './syntax-types';
import type { DirectiveInput } from './session';
/** Emit in the original directive order and shared session. @internal */
export function emitValueDirective(dir: DirectiveInfo, input: DirectiveInput): boolean {
  const { session, varName, parentVar } = input;
  const { codeLines, allExprs } = session;
  if (dir.name === 'zen-text') {
    session.effectCount++;
    allExprs.push(dir.value);
    codeLines.push(`  effect(() => {`);
    codeLines.push(`    const v = evalExpr(${JSON.stringify(dir.value)}, ctx);`);
    codeLines.push(
      `    ${varName}.textContent = (v === null || v === undefined) ? '' : String(v);`,
    );
    codeLines.push(`  });`);
    return true;
  }

  if (dir.name === 'zen-if') {
    session.effectCount++;
    allExprs.push(dir.value);
    codeLines.push(`  effect(() => {`);
    codeLines.push(`    const cond = Boolean(evalExpr(${JSON.stringify(dir.value)}, ctx));`);
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
    session.effectCount++;
    allExprs.push(dir.value);
    codeLines.push(`  effect(() => {`);
    codeLines.push(`    const v = evalExpr(${JSON.stringify(dir.value)}, ctx);`);
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
    session.effectCount++;
    allExprs.push(dir.value);
    codeLines.push(`  effect(() => {`);
    codeLines.push(`    const v = evalExpr(${JSON.stringify(dir.value)}, ctx);`);
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
    session.effectCount++;
    allExprs.push(dir.value);
    codeLines.push(`  effect(() => {`);
    codeLines.push(`    const v = evalExpr(${JSON.stringify(dir.value)}, ctx);`);
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
    session.effectCount++;
    allExprs.push(value);

    if (value.startsWith('{') && value.endsWith('}')) {
      // Object syntax: { key1: $cond1, key2: $cond2 }
      // بررسی اینکه آیا object syntax ساده است (فقط identifier: $signal)
      // اگر نه، به runtime بسپار
      const inner = value.slice(1, -1).trim();
      const pairs = inner
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      let allSimple = true;
      const parsedPairs: Array<{ key: string; expr: string }> = [];
      for (const pair of pairs) {
        const colonIdx = pair.indexOf(':');
        if (colonIdx === -1) {
          allSimple = false;
          break;
        }
        const key = pair
          .slice(0, colonIdx)
          .trim()
          .replace(/^['"]|['"]$/g, '');
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
      // BUG-COMP-02 FIX: استفاده از evalExpr به‌جای دسترسی مستقیم ctx.$
      // قبلاً برای object syntax از ctx.$isActive استفاده می‌کرد که
      // برای expressionهای پیچیده کار نمی‌کرد. حالا evalExpr(expr, ctx)
      // تمام انواع expression را پشتیبانی می‌کند.
      codeLines.push(`  effect(() => {`);
      for (const { key, expr } of parsedPairs) {
        codeLines.push(
          `    if (evalExpr(${JSON.stringify(expr)}, ctx)) ${varName}.classList.add(${JSON.stringify(key)});`,
        );
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


  return false;
}
