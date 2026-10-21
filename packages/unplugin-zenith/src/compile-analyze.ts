// packages/unplugin-zenith/src/compile-analyze.ts
import { compile as compileExpression } from '@zenith/expressions';
import { EXPRESSION_DIRECTIVES, hasZenithDirectives } from './compile-scan';

/**
 * اعتبارسنجی فایل HTML و بازگشت لیست warningها بدون transform.
 *
 * کاربرد: در `zenith check` یا قبل از build برای بررسی زودهنگام.
 */
export function analyzeHtml(
  html: string,
  htmlPath: string = '<inline>',
): {
  directiveCount: number;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!hasZenithDirectives(html)) {
    return { directiveCount: 0, warnings, errors };
  }

  const directiveRegex = /\s(zen-[a-z][a-z0-9-]*)(?:=("[^"]*"|'[^']*'|[^\s>]+))?/gi;
  let match: RegExpExecArray | null;
  let count = 0;

  while ((match = directiveRegex.exec(html)) !== null) {
    const name = match[1] ?? '';
    const value = (match[2] || '').replace(/^["']|["']$/g, '');
    count++;

    // FIX (B-9): از EXPRESSION_DIRECTIVES سطح ماژول استفاده می‌کنیم
    // به‌جای تعریف دوباره در اینجا.
    if (EXPRESSION_DIRECTIVES.has(name)) {
      if (!value) {
        errors.push(`${htmlPath}: ${name} has empty expression`);
        continue;
      }
      try {
        compileExpression(value);
      } catch (e) {
        errors.push(`${htmlPath}: ${name}="${value}" — ${(e as Error).message}`);
      }
    }
  }

  return { directiveCount: count, warnings, errors };
}
