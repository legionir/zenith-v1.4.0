// packages/cli/src/check-report.ts
//
// گزارش و رنگی‌سازی خروجی دستور `zenith check` — استخراج مکانیکی از
// check.ts بدون تغییر رفتار (#40، code-first: نوشته‌شده، اجرا نشده).

import { output } from './output';
import type { Finding } from './check-findings';


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

export function colorize(text: string, color: keyof typeof COLORS): string {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

/**
 * نمایش یک یافته.
 */
export function printFinding(finding: Finding): void {
  const severityLabel = {
    error: colorize('error', 'red'),
    warning: colorize('warning', 'yellow'),
    info: colorize('info', 'blue'),
  }[finding.severity];

  const location = colorize(`${finding.file}:${finding.line}:${finding.column}`, 'gray');
  const rule = colorize(finding.rule, 'bold');
  output.line(`  ${severityLabel}  ${rule}  ${finding.message}`);
  output.line(`            ${location}`);
}