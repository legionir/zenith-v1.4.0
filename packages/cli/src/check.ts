// packages/cli/src/check.ts
//
// دستور `zenith check` — Production Readiness #30
//
// تحلیل استاتیک فایل‌های HTML پروژه برای کشف مشکلات رایج:
//   1) خطاهای سینتکس در expressionهای Zenith (مثلاً پرانتز بسته نشده).
//   2) دسترسی به متغیرهای تعریف‌نشده در context.
//   3) استفاده از directiveهای نامعتبر یاdeprecated.
//   4) مشکلات امنیتی (مثلاً استفاده از compileAndRender حذف‌شده).
//   5) zen-if بدون zen-else مرتبط (warning).
//   6) zen-for بدون zen-key (warning).
//   7) zen-action با handler تعریف‌نشده در کد (اطلاعات).
//
// کاربرد:
//   zenith check                # بررسی کل پروژه (پوشه فعلی)
//   zenith check ./src          # بررسی پوشه‌ی مشخص
//   zenith check ./src --strict # خطا در CI اگر warning وجود دارد
//
// خروجی:
//   - در حالت عادی: لیست warningها و errorها به‌صورت رنگی.
//   - در CI (--strict یا --ci): کد exit غیر صفر اگر خطا یا warning وجود دارد.

import fs from 'fs';
import path from 'path';
import { compile } from '@zenith/expressions';

/**
 * شدت یافته‌های تحلیل.
 */
type Severity = 'error' | 'warning' | 'info';

/**
 * یک یافته‌ی تحلیل.
 */
interface Finding {
  file: string;
  line: number;
  column: number;
  severity: Severity;
  rule: string;
  message: string;
}

/**
 * 所有 directives معتبر Zenith.
 *
 * BUG-20 FIX (v1.2.2): لیست کامل دایرکتیوها اضافه شد. قبلاً بسیاری از
 * دایرکتیوهای معتبر (مثل zen-optimistic، zen-track، zen-date-picker،
 * zen-virtual، zen-island، zen-memo، zen-portal، zen-intersection، zen-cloak،
 * zen-else، zen-else-if، zen-action-button، zen-auth-view، zen-resource-view،
 * zen-suspense، zen-router، zen-route، zen-html-slot، zen-outlet، zen-form،
 * zen-field، zen-submit، zen-store، zen-auth، zen-login، zen-logout،
 * zen-validate، zen-transition، zen-animate، zen-props، zen-key، zen-static،
 * immutable، loading-text، hydrate، zen-virtual-list، zen-item-height،
 * zen-buffer، zen-dynamic-heights) وجود نداشتند و false positive تولید
 * می‌کردند.
 */
const VALID_DIRECTIVES = new Set([
  // Core directives
  'zen-text', 'zen-if', 'zen-show', 'zen-for', 'zen-bind', 'zen-model',
  'zen-html', 'zen-html-trusted', 'zen-fetch', 'zen-resource', 'zen-action',
  'zen-link', 'zen-validate', 'zen-permission', 'zen-role', 'zen-error',
  'zen-suspense', 'zen-virtual-list', 'zen-key', 'zen-item-height',
  'zen-buffer', 'zen-dynamic-heights', 'zen-transition', 'zen-cloak',
  'zen-ref', 'zen-html-slot', 'zen-props', 'zen-static', 'zen-animate',
  'zen-portal', 'zen-intersection', 'zen-error-text',
  // BUG-20 FIX (v1.2.2): directives جدید اضافه شدند.
  'zen-optimistic', 'zen-track', 'zen-date-picker', 'zen-virtual',
  'zen-island', 'zen-memo', 'zen-else', 'zen-else-if',
  'zen-action-button', 'zen-auth-view', 'zen-resource-view',
  // Router element directives (tags)
  'zen-route', 'zen-outlet', 'zen-router',
  // Form-related
  'zen-form', 'zen-field', 'zen-submit',
  // Store
  'zen-store',
  // Auth
  'zen-auth', 'zen-login', 'zen-logout',
  // Misc attribute directives
  'immutable', 'loading-text', 'hydrate',
]);

/**
 * دستورالعمل‌های deprecated.
 */
const DEPRECATED_DIRECTIVES: Record<string, string> = {
  'zen-compile': 'Use zen-text or zen-html with proper expressions instead. compileAndRender was removed for security.',
};

/**
 * پیدا کردن تمام فایل‌های HTML در یک پوشه.
 */
function findHtmlFiles(dir: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    // پوشه‌های نادیده گرفته شده
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
      findHtmlFiles(fullPath, files);
    } else if (entry.isFile() && (entry.name.endsWith('.html') || entry.name.endsWith('.htm'))) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * محاسبه‌ی line و column از offset در متن.
 */
function getLineColumn(content: string, offset: number): { line: number; column: number } {
  const lines = content.substring(0, offset).split('\n');
  return {
    line: lines.length,
    column: lines[lines.length - 1]!.length + 1,
  };
}

/**
 * استخراج نام directive از نام attribute.
 * مثال: zen-text → "zen-text"
 */

/**
 * استخراج expression از value یک attribute.
 * مثال: "$user.name" → "$user.name"
 *       "click:saveUser" → "saveUser"
 */
function extractExpression(directive: string, value: string): string | null {
  if (!value) return null;
  // برای zen-action: مقدار ممکن است "click:handlerName" یا فقط "handlerName" باشد
  if (directive === 'zen-action') {
    const parts = value.split(':');
    // آخرین بخش handler است
    return parts[parts.length - 1]!.trim();
  }
  // برای zen-fetch و zen-resource: مقدار شامل URL یا expression است
  if (directive === 'zen-fetch' || directive === 'zen-resource') {
    // سعی کنیم JSON parse کنیم
    try {
      const obj = JSON.parse(value);
      return obj.url || obj.id || null;
    } catch {
      return value;
    }
  }
  return value;
}

/**
 * بررسی یک فایل HTML.
 */
function checkHtmlFile(filePath: string): Finding[] {
  const findings: Finding[] = [];
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    return [{
      file: filePath,
      line: 0,
      column: 0,
      severity: 'error',
      rule: 'Z001',
      message: `Cannot read file: ${(e as Error).message}`,
    }];
  }

  // ── Rule Z100: استفاده از compileAndRender حذف‌شده ──
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
        rule: 'Z100',
        message: 'compileAndRender was removed for security (XSS). Use zen-text or zen-html with pre-compiled expressions.',
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

  // ── Rule Z101: الگوی <script> با eval/Function در کد JavaScript ──
  // بررسی داخل <script>ها برای استفاده از eval یا new Function.
  // از stripped استفاده می‌کنیم تا comments درون script هم در نظر گرفته نشوند.
  const scriptRegex = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch: RegExpExecArray | null;
  while ((scriptMatch = scriptRegex.exec(stripped)) !== null) {
    const scriptContent = scriptMatch[1] ?? '';
    if (scriptContent.includes('eval(') || scriptContent.includes('new Function(')) {
      const idx = scriptMatch.index + scriptContent.indexOf(
        scriptContent.includes('eval(') ? 'eval(' : 'new Function(',
      );
      const { line, column } = getLineColumn(stripped, idx);
      findings.push({
        file: filePath,
        line,
        column,
        severity: 'error',
        rule: 'Z101',
        message: 'Use of eval() or new Function() detected in <script>. This is forbidden in Zenith for security.',
      });
    }
  }

  // ── Rule Z200: بررسی صحت directiveها ──
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
          rule: 'Z200',
          message: `Directive '${directive}' is deprecated. ${DEPRECATED_DIRECTIVES[directive]}`,
        });
      } else {
        findings.push({
          file: filePath,
          line,
          column,
          severity: 'warning',
          rule: 'Z201',
          message: `Unknown directive '${directive}'. Valid: ${Array.from(VALID_DIRECTIVES).slice(0, 10).join(', ')}...`,
        });
      }
    }

    // Rule Z300: zen-for بدون zen-key (warning)
    if (directive === 'zen-for' && !value.includes('zen-key')) {
      const tagEnd = stripped.indexOf('>', idx);
      const tagContent = stripped.substring(idx, tagEnd);
      if (!tagContent.includes('zen-key')) {
        findings.push({
          file: filePath,
          line,
          column,
          severity: 'warning',
          rule: 'Z300',
          message: `zen-for without zen-key: list rendering without a stable key can cause DOM thrashing and state loss. Add zen-key="$item.id" or similar.`,
        });
      }
    }

    // Rule Z301: expression خالی در zen-text
    if (directive === 'zen-text' && (!value || value.trim() === '')) {
      findings.push({
        file: filePath,
        line,
        column,
        severity: 'error',
        rule: 'Z301',
        message: `zen-text has empty expression. Remove the directive or provide an expression like zen-text="$count".`,
      });
    }

    // Rule Z302: expression خالی در zen-if
    if (directive === 'zen-if' && (!value || value.trim() === '')) {
      findings.push({
        file: filePath,
        line,
        column,
        severity: 'error',
        rule: 'Z302',
        message: `zen-if has empty condition. Provide a boolean expression like zen-if="$count > 0".`,
      });
    }

    // Rule Z400: بررسی سینتکس expression با lexer + parser (compile)
    const expr = extractExpression(directive, value);
    if (expr && (directive === 'zen-text' || directive === 'zen-if' || directive === 'zen-show' ||
                 directive === 'zen-bind' || directive === 'zen-model' || directive === 'zen-html' ||
                 directive === 'zen-for')) {
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
          rule: 'Z400',
          message: `Expression syntax error in ${directive}: ${(e as Error).message}`,
        });
      }
    }

    // Rule Z500: zen-bind با دسترسی به $parent بدون context مناسب (info)
    if (directive === 'zen-bind' && value.includes('$parent') && !value.includes('$parent.')) {
      findings.push({
        file: filePath,
        line,
        column,
        severity: 'info',
        rule: 'Z500',
        message: `zen-bind uses '$parent' but does not access a property. Did you mean '$parent.someProperty'?`,
      });
    }
  }

  // ── Rule Z800: Compiler unsupported directives (warning) ──
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
    'zen-for', 'zen-action', 'zen-fetch', 'zen-resource', 'zen-link',
    'zen-permission', 'zen-role', 'zen-error', 'zen-suspense',
    'zen-virtual-list', 'zen-component', 'zen-validate', 'zen-transition',
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
        rule: 'Z800',
        message: `Directive '${dirName}' is not compilable by @zenith/compiler. ` +
          `In compile-mode, it will be preserved and processed by runtime walker (slower).`,
      });
    }
  }

  // ── Rule Z810: zen-virtual-list without zen-dynamic-heights (info) ──
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
        rule: 'Z810',
        message: `zen-virtual-list is using static heights (default). ` +
          `If items have varying content heights, add zen-dynamic-heights="true" ` +
          `for ResizeObserver-based measurement.`,
      });
    }
  }

  // ── Rule Z820: i18n helper functions awareness (info) ──
  //
  // Bug Fix #7: CLI check باید آگاه باشد که توابع i18n مثل $toJalali،
  // $toPersianNums، $formatNumber، $formatPrice ممکن است در context باشند
  // بدون اینکه به‌عنوان Signal ثبت شوند. این rule اطلاع‌رسانی می‌کند که
  // اگر از این توابع استفاده شده، کاربر باید مطمئن شود که در context ثبت شده‌اند.
  const i18nRegex = /\$(toJalali|toPersianNums|toArabicNums|formatNumber|formatPrice|jalaliNow)\s*\(/g;
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
      rule: 'Z820',
      message: `i18n function '$${funcName}' is used. Make sure it's registered in Zen.start() context: ` +
        `Zen.start(root, { ${funcName}: <function> }) — otherwise expression will throw "Variable not defined".`,
    });
  }

  // ── Rule Z600: zen-route بدون src ──
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
        rule: 'Z600',
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
        rule: 'Z601',
        message: `<zen-route> without path attribute. Add path="/your-route".`,
      });
    }
  }

  // ── Rule Z700: zen-link بدون href (warning) ──
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
        rule: 'Z700',
        message: `Element with zen-link but no href or zen-link target. Add href="/route/path".`,
      });
    }
  }

  return findings;
}

/**
 * رنگی کردن خروجی terminal (ANSI).
 */
const COLORS = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
};

function colorize(text: string, color: keyof typeof COLORS): string {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

/**
 * نمایش یک یافته.
 */
function printFinding(finding: Finding): void {
  const severityLabel = {
    error: colorize('error', 'red'),
    warning: colorize('warning', 'yellow'),
    info: colorize('info', 'blue'),
  }[finding.severity];

  const location = colorize(
    `${finding.file}:${finding.line}:${finding.column}`,
    'gray',
  );
  const rule = colorize(finding.rule, 'bold');
  console.log(`  ${severityLabel}  ${rule}  ${finding.message}`);
  console.log(`            ${location}`);
}

/**
 * دستور اصلی check.
 *
 * @param target مسیر پوشه یا فایل برای بررسی (پیش‌فرض: current directory)
 * @param options گزینه‌ها: --strict, --ci, --quiet
 */
export function runCheck(
  target: string = '.',
  options: { strict?: boolean; ci?: boolean; quiet?: boolean } = {},
): number {
  if (!fs.existsSync(target)) {
    console.error(colorize(`❌ Path not found: ${target}`, 'red'));
    return 2;
  }

  const stat = fs.statSync(target);
  const files: string[] = [];

  if (stat.isDirectory()) {
    findHtmlFiles(target, files);
  } else if (stat.isFile() && (target.endsWith('.html') || target.endsWith('.htm'))) {
    files.push(target);
  } else {
    console.error(colorize(`❌ Not an HTML file: ${target}`, 'red'));
    return 2;
  }

  if (files.length === 0) {
    console.log(colorize('ℹ️  No HTML files found.', 'blue'));
    return 0;
  }

  if (!options.quiet) {
    console.log(colorize(`🔍 Checking ${files.length} HTML file${files.length === 1 ? '' : 's'}...`, 'bold'));
    console.log('');
  }

  let totalErrors = 0;
  let totalWarnings = 0;
  let totalInfos = 0;
  let filesWithIssues = 0;

  for (const file of files) {
    const findings = checkHtmlFile(file);
    if (findings.length === 0) continue;

    filesWithIssues++;
    if (!options.quiet) {
      console.log(colorize(`━━━ ${file} ━━━`, 'bold'));
    }
    for (const finding of findings) {
      if (finding.severity === 'error') totalErrors++;
      else if (finding.severity === 'warning') totalWarnings++;
      else totalInfos++;
      if (!options.quiet) {
        printFinding(finding);
      }
    }
    if (!options.quiet) {
      console.log('');
    }
  }

  // ── Summary ──
  console.log(colorize('━━━ Summary ━━━', 'bold'));
  console.log(`  Files checked:   ${files.length}`);
  console.log(`  Files with issues: ${filesWithIssues}`);
  console.log(`  ${colorize('Errors:', 'red')}   ${totalErrors}`);
  console.log(`  ${colorize('Warnings:', 'yellow')} ${totalWarnings}`);
  console.log(`  ${colorize('Info:', 'blue')}      ${totalInfos}`);

  // کد exit:
  //   0 → موفقیت (no errors)
  //   1 → خطا دارد
  //   2 → مشکلات اجرایی (مثلاً فایل پیدا نشد)
  const strictMode = options.strict || options.ci;
  if (totalErrors > 0) {
    console.log(colorize('\n❌ Check failed with errors.', 'red'));
    return 1;
  }
  if (strictMode && totalWarnings > 0) {
    console.log(colorize('\n⚠️  Check failed with warnings (--strict mode).', 'yellow'));
    return 1;
  }
  if (totalWarnings > 0 || totalInfos > 0) {
    console.log(colorize('\n✅ Check passed with warnings.', 'green'));
  } else {
    console.log(colorize('\n✅ All checks passed!', 'green'));
  }
  return 0;
}
