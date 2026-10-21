// packages/cli/src/check-analyze.ts
//
// تحلیل یک فایل HTML در دستور `zenith check` — استخراج مکانیکی از check.ts
// بدون تغییر رفتار (#40، code-first: نوشته‌شده، اجرا نشده).

import fs from 'fs';
import { compile } from '@zenith/expressions';
import {
  DEPRECATED_DIRECTIVES,
  VALID_DIRECTIVES,
  type Finding,
} from './check-findings';
import { extractExpression, getLineColumn } from './check-scan';


/**
 * بررسی یک فایل HTML.
 */
export function checkHtmlFile(filePath: string): Finding[] {
  const findings: Finding[] = [];
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    return [
      {
        file: filePath,
        line: 0,
        column: 0,
        severity: 'error',
        rule: 'ZEN-9001',
        message: `Cannot read file: ${(e as Error).message}`,
      },
    ];
  }

  // ── Rule ZEN-9010: استفاده از compileAndRender حذف‌شده ──
  // این rule روی کل content (شامل comments) اجرا می‌شود چون مهم است.
  if (content.includes('compileAndRender') || content.includes('zen-compile')) {
    const idx = content.indexOf('compileAndRender');
    if (idx >= 0) {
      const { line, column } = getLineColumn(content, idx);
      findings.push({
        file: filePath,
        line,
        column,
        severity: 'error',
        rule: 'ZEN-9010',
        message:
          'compileAndRender was removed for security (XSS). Use zen-text or zen-html with pre-compiled expressions.',
      });
    }
  }

  // ── حذف comments برای جلوگیری از false positive در ruleهای بعدی ──
  // comments با <!-- ... --> مشخص می‌شوند.
  // برای حفظ line numbers، comments را با هم‌اندازه‌ی فاصله جایگزین می‌کنیم.
  const stripped: string = content.replace(/<!--[\s\S]*?-->/g, (match) => {
    // جایگزینی با همان تعداد کاراکتر (همه به فاصله تبدیل می‌شوند جز \n)
    let out = '';
    for (const ch of match) {
      out += ch === '\n' ? '\n' : ' ';
    }
    return out;
  });

  // ── Rule ZEN-9011: الگوی <script> با eval/Function در کد JavaScript ──
  // بررسی داخل <script>ها برای استفاده از eval یا new Function.
  // از stripped استفاده می‌کنیم تا comments درون script هم در نظر گرفته نشوند.
  const scriptRegex = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch: RegExpExecArray | null;
  while ((scriptMatch = scriptRegex.exec(stripped)) !== null) {
    const scriptContent = scriptMatch[1] ?? '';
    if (scriptContent.includes('eval(') || scriptContent.includes('new Function(')) {
      const idx =
        scriptMatch.index +
        scriptContent.indexOf(scriptContent.includes('eval(') ? 'eval(' : 'new Function(');
      const { line, column } = getLineColumn(stripped, idx);
      findings.push({
        file: filePath,
        line,
        column,
        severity: 'error',
        rule: 'ZEN-9011',
        message:
          'Use of eval() or new Function() detected in <script>. This is forbidden in Zenith for security.',
      });
    }
  }

  // ── Rule ZEN-9020: بررسی صحت directiveها ──
  // پیدا کردن تمام attributeهای zen-* (داخل stripped که comments حذف شده‌اند)
  const attrRegex = /\s(zen-[a-z][a-z0-9-]*)(?:=("[^"]*"|'[^']*'|[^\s>]+))?/gi;
  let attrMatch: RegExpExecArray | null;
  while ((attrMatch = attrRegex.exec(stripped)) !== null) {
    const directive = attrMatch[1] ?? '';
    const value = attrMatch[2] ? attrMatch[2].replace(/^["']|["']$/g, '') : '';
    const idx = attrMatch.index + 1; // +1 برای رد کردن فاصله
    const { line, column } = getLineColumn(stripped, idx);

    // چک validity
    if (!VALID_DIRECTIVES.has(directive)) {
      // چک deprecated
      if (DEPRECATED_DIRECTIVES[directive]) {
        findings.push({
          file: filePath,
          line,
          column,
          severity: 'error',
          rule: 'ZEN-9020',
          message: `Directive '${directive}' is deprecated. ${DEPRECATED_DIRECTIVES[directive]}`,
        });
      } else {
        findings.push({
          file: filePath,
          line,
          column,
          severity: 'warning',
          rule: 'ZEN-9021',
          message: `Unknown directive '${directive}'. Valid: ${Array.from(VALID_DIRECTIVES).slice(0, 10).join(', ')}...`,
        });
      }
    }

    // Rule ZEN-9030: zen-for بدون zen-key (warning)
    if (directive === 'zen-for' && !value.includes('zen-key')) {
      const tagEnd = stripped.indexOf('>', idx);
      const tagContent = stripped.substring(idx, tagEnd);
      if (!tagContent.includes('zen-key')) {
        findings.push({
          file: filePath,
          line,
          column,
          severity: 'warning',
          rule: 'ZEN-9030',
          message: `zen-for without zen-key: list rendering without a stable key can cause DOM thrashing and state loss. Add zen-key="$item.id" or similar.`,
        });
      }
    }

    // Rule ZEN-9031: expression خالی در zen-text
    if (directive === 'zen-text' && (!value || value.trim() === '')) {
      findings.push({
        file: filePath,
        line,
        column,
        severity: 'error',
        rule: 'ZEN-9031',
        message: `zen-text has empty expression. Remove the directive or provide an expression like zen-text="$count".`,
      });
    }

    // Rule ZEN-9032: expression خالی در zen-if
    if (directive === 'zen-if' && (!value || value.trim() === '')) {
      findings.push({
        file: filePath,
        line,
        column,
        severity: 'error',
        rule: 'ZEN-9032',
        message: `zen-if has empty condition. Provide a boolean expression like zen-if="$count > 0".`,
      });
    }

    // Rule ZEN-9040: بررسی سینتکس expression با lexer + parser (compile)
    const expr = extractExpression(directive, value);
    if (
      expr &&
      (directive === 'zen-text' ||
        directive === 'zen-if' ||
        directive === 'zen-show' ||
        directive === 'zen-bind' ||
        directive === 'zen-model' ||
        directive === 'zen-html' ||
        directive === 'zen-for')
    ) {
      try {
        // استفاده از compile که lexer + parser + validator را با هم صدا می‌زند.
        // این برای کشف خطاهای سینتکس (مثل پرانتز بسته‌نشده، عملگر نامعتبر و ...)
        // کامل‌ترین روش است.
        compile(expr);
      } catch (e) {
        findings.push({
          file: filePath,
          line,
          column,
          severity: 'error',
          rule: 'ZEN-9040',
          message: `Expression syntax error in ${directive}: ${(e as Error).message}`,
        });
      }
    }

    // Rule ZEN-9050: zen-bind با دسترسی به $parent بدون context مناسب (info)
    if (directive === 'zen-bind' && value.includes('$parent') && !value.includes('$parent.')) {
      findings.push({
        file: filePath,
        line,
        column,
        severity: 'info',
        rule: 'ZEN-9050',
        message: `zen-bind uses '$parent' but does not access a property. Did you mean '$parent.someProperty'?`,
      });
    }
  }

  // ── Rule ZEN-9080: Compiler unsupported directives (warning) ──
  //
  // Bug Fix #3: قبلاً هیچ rule‌ای برای محدودیت‌های compiler وجود نداشت.
  // این rule بررسی می‌کند که آیا فایل HTML از directiveهای استفاده کرده که
  // compiler نمی‌تواند آن‌ها را به کد JS تبدیل کند (zen-for, zen-action, zen-fetch,
  // zen-resource, zen-link, zen-permission, zen-role, zen-error, zen-suspense,
  // zen-virtual-list, zen-component, zen-validate, zen-transition).
  //
  // این directiveها در compile-mode به runtime walker سپرده می‌شوند.
  // این کار می‌کند اما کاربر باید بداند که performance بهینه‌ی compile
  // برای این directiveها اعمال نمی‌شود. در حالت strict، این rule به error
  // تبدیل می‌شود چون ممکن است نشان‌دهنده‌ی اشتباه طراحی باشد.
  //
  // Compilable directives: zen-text, zen-if, zen-show, zen-bind, zen-html, zen-model
  const RUNTIME_ONLY_DIRECTIVES = new Set([
    'zen-for',
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
  ]);

  // پیدا کردن تمام zen-* directiveها (دوباره، چون روی stripped اجرا می‌کنیم)
  const runtimeDirRegex = /\s(zen-[a-z][a-z0-9-]*)(?:=("[^"]*"|'[^']*'|[^\s>]+))?/gi;
  let runtimeDirMatch: RegExpExecArray | null;
  while ((runtimeDirMatch = runtimeDirRegex.exec(stripped)) !== null) {
    const dirName = runtimeDirMatch[1]!;
    if (RUNTIME_ONLY_DIRECTIVES.has(dirName)) {
      const idx = runtimeDirMatch.index + 1;
      const { line, column } = getLineColumn(stripped, idx);
      findings.push({
        file: filePath,
        line,
        column,
        severity: 'warning',
        rule: 'ZEN-9080',
        message:
          `Directive '${dirName}' is not compilable by @zenith/compiler. ` +
          `In compile-mode, it will be preserved and processed by runtime walker (slower).`,
      });
    }
  }

  // ── Rule ZEN-9081: zen-virtual-list without zen-dynamic-heights (info) ──
  //
  // Bug Fix #4: Virtual List dynamic heights یک قابلیت opt-in است.
  // اگر کاربر از zen-virtual-list استفاده کند ولی zen-dynamic-heights="true"
  // تنظیم نکند، فقط static heights پشتیبانی می‌شود. این یک info است (نه warning)
  // چون static heights کاملاً معتبر است، اما کاربر باید بداند dynamic heights
  // هم موجود است.
  const vlistRegex = /<[^>]+zen-virtual-list\b[^>]*>/gi;
  let vlistMatch: RegExpExecArray | null;
  while ((vlistMatch = vlistRegex.exec(stripped)) !== null) {
    const tag = vlistMatch[0];
    if (!tag.includes('zen-dynamic-heights')) {
      const idx = vlistMatch.index;
      const { line, column } = getLineColumn(stripped, idx);
      findings.push({
        file: filePath,
        line,
        column,
        severity: 'info',
        rule: 'ZEN-9081',
        message:
          `zen-virtual-list is using static heights (default). ` +
          `If items have varying content heights, add zen-dynamic-heights="true" ` +
          `for ResizeObserver-based measurement.`,
      });
    }
  }

  // ── Rule ZEN-9082: i18n helper functions awareness (info) ──
  //
  // Bug Fix #7: CLI check باید آگاه باشد که توابع i18n مثل $toJalali،
  // $toPersianNums، $formatNumber، $formatPrice ممکن است در context باشند
  // بدون اینکه به‌عنوان Signal ثبت شوند. این rule اطلاع‌رسانی می‌کند که
  // اگر از این توابع استفاده شده، کاربر باید مطمئن شود که در context ثبت شده‌اند.
  const i18nRegex =
    /\$(toJalali|toPersianNums|toArabicNums|formatNumber|formatPrice|jalaliNow)\s*\(/g;
  let i18nMatch: RegExpExecArray | null;
  const seenI18n = new Set<string>();
  while ((i18nMatch = i18nRegex.exec(stripped)) !== null) {
    const funcName = i18nMatch[1]!;
    if (seenI18n.has(funcName)) continue; // فقط یک بار گزارش کن
    seenI18n.add(funcName);
    const idx = i18nMatch.index;
    const { line, column } = getLineColumn(stripped, idx);
    findings.push({
      file: filePath,
      line,
      column,
      severity: 'info',
      rule: 'ZEN-9082',
      message:
        `i18n function '$${funcName}' is used. Make sure it's registered in Zen.start() context: ` +
        `Zen.start(root, { ${funcName}: <function> }) — otherwise expression will throw "Variable not defined".`,
    });
  }

  // ── Rule ZEN-9060: zen-route بدون src ──
  const routeRegex = /<zen-route\b[^>]*>/gi;
  let routeMatch: RegExpExecArray | null;
  while ((routeMatch = routeRegex.exec(stripped)) !== null) {
    const tag = routeMatch[0];
    if (!tag.includes('src=') && !tag.includes('src =')) {
      const idx = routeMatch.index;
      const { line, column } = getLineColumn(stripped, idx);
      findings.push({
        file: filePath,
        line,
        column,
        severity: 'error',
        rule: 'ZEN-9060',
        message: `<zen-route> without src attribute. Add src="/pages/your-page.html".`,
      });
    }
    if (!tag.includes('path=') && !tag.includes('path =')) {
      const idx = routeMatch.index;
      const { line, column } = getLineColumn(stripped, idx);
      findings.push({
        file: filePath,
        line,
        column,
        severity: 'error',
        rule: 'ZEN-9061',
        message: `<zen-route> without path attribute. Add path="/your-route".`,
      });
    }
  }

  // ── Rule ZEN-9070: zen-link بدون href (warning) ──
  const linkRegex = /<[^>]+zen-link\b[^>]*>/gi;
  let linkMatch: RegExpExecArray | null;
  while ((linkMatch = linkRegex.exec(stripped)) !== null) {
    const tag = linkMatch[0];
    if (!tag.includes('href=') && !tag.includes('zen-link="')) {
      const idx = linkMatch.index;
      const { line, column } = getLineColumn(stripped, idx);
      findings.push({
        file: filePath,
        line,
        column,
        severity: 'warning',
        rule: 'ZEN-9070',
        message: `Element with zen-link but no href or zen-link target. Add href="/route/path".`,
      });
    }
  }

  return findings;
}