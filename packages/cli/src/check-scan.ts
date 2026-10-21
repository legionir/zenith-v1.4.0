// packages/cli/src/check-scan.ts
//
// اسکن فایل‌ها و ابزارهای موقعیتی دستور `zenith check` — استخراج مکانیکی
// از check.ts بدون تغییر رفتار (#40، code-first: نوشته‌شده، اجرا نشده).

import fs from 'fs';
import path from 'path';


/**
 * پیدا کردن تمام فایل‌های HTML در یک پوشه.
 */
export function findHtmlFiles(dir: string, files: string[] = []): string[] {
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
export function getLineColumn(content: string, offset: number): { line: number; column: number } {
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
export function extractExpression(directive: string, value: string): string | null {
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