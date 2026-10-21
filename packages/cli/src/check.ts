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
import { output } from './output';
import { checkHtmlFile } from './check-analyze';
import { colorize, printFinding } from './check-report';
import { findHtmlFiles } from './check-scan';

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
    output.error(colorize(`❌ Path not found: ${target}`, 'red'));
    return 2;
  }

  const stat = fs.statSync(target);
  const files: string[] = [];

  if (stat.isDirectory()) {
    findHtmlFiles(target, files);
  } else if (stat.isFile() && (target.endsWith('.html') || target.endsWith('.htm'))) {
    files.push(target);
  } else {
    output.error(colorize(`❌ Not an HTML file: ${target}`, 'red'));
    return 2;
  }

  if (files.length === 0) {
    output.line(colorize('ℹ️  No HTML files found.', 'blue'));
    return 0;
  }

  if (!options.quiet) {
    output.line(
      colorize(`🔍 Checking ${files.length} HTML file${files.length === 1 ? '' : 's'}...`, 'bold'),
    );
    output.line('');
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
      output.line(colorize(`━━━ ${file} ━━━`, 'bold'));
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
      output.line('');
    }
  }

  output.result({ filesChecked: files.length, filesWithIssues, errors: totalErrors, warnings: totalWarnings, infos: totalInfos });

  // ── Summary ──
  output.line(colorize('━━━ Summary ━━━', 'bold'));
  output.line(`  Files checked:   ${files.length}`);
  output.line(`  Files with issues: ${filesWithIssues}`);
  output.line(`  ${colorize('Errors:', 'red')}   ${totalErrors}`);
  output.line(`  ${colorize('Warnings:', 'yellow')} ${totalWarnings}`);
  output.line(`  ${colorize('Info:', 'blue')}      ${totalInfos}`);

  // کد exit:
  //   0 → موفقیت (no errors)
  //   1 → خطا دارد
  //   2 → مشکلات اجرایی (مثلاً فایل پیدا نشد)
  const strictMode = options.strict || options.ci;
  if (totalErrors > 0) {
    output.line(colorize('\n❌ Check failed with errors.', 'red'));
    return 1;
  }
  if (strictMode && totalWarnings > 0) {
    output.line(colorize('\n⚠️  Check failed with warnings (--strict mode).', 'yellow'));
    return 1;
  }
  if (totalWarnings > 0 || totalInfos > 0) {
    output.line(colorize('\n✅ Check passed with warnings.', 'green'));
  } else {
    output.line(colorize('\n✅ All checks passed!', 'green'));
  }
  return 0;
}
