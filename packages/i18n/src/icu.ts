// packages/i18n/src/icu.ts — زیرمجموعهٔ ICU MessageFormat (#150, SPEC §۳.۱).
//
// پشتیبانی‌شده:
//   {name}                          — جایگذاری پارامتر (با escapeParams در core)
//   {count, plural, =0{…} one{…} other{…}}   — plural با کلید دقیق =N و قواعد Intl
//   {gender, select, male{…} female{…} other{…}}
//   {price, number, <fmt>}          — fmt نام‌دار از numberFormats یا short-hand
//   {when, date, <fmt>}             — fmt نام‌دار از dateFormats
//   #                               — count قالب‌بندی‌شده درون شاخهٔ plural
// لینک `@:key` در core.tm (با guard چرخه) حل می‌شود، نه اینجا.

import { createReservedError, type ZenithError } from '@zenith/errors';
import type { I18nParams } from './types';

/** API کوچک فرمت‌کننده که core در اختیار icu می‌گذارد (جداکردن Intl از parse). */
export interface FormatHooks {
  /** فرمت عدد با fmt نام‌دار یا undefined (پیش‌فرض). */
  n(value: number, fmt?: string): string;
  /** فرمت تاریخ با fmt نام‌دار یا undefined. */
  d(value: Date | number, fmt?: string): string;
  /** انتخاب کلمهٔ plural برای locale فعلی (Intl.PluralRules). */
  plural(count: number): string;
  /** فرمت `#` (count در شاخهٔ plural). */
  formatCount(count: number): string;
  /** خروجی‌سازی پارامتر (escapeParams رود core اینجا اعمال می‌شود — ورودی escape‌شده). */
  formatParam(value: unknown): string;
  /**
   * خطای قالب ICU (ZEN-1312). مقدار بازگشتی جایگزین متن در خروجی می‌شود —
   * بنابراین قالب نامعتبر پیام را کلاً نمی‌شکند.
   */
  onInvalid(message: string, err?: unknown): string;
}

export function icuInvalid(formatProblem: string, details?: Record<string, unknown>): ZenithError {
  return createReservedError('ZEN-1312', { details: { problem: formatProblem, ...details } });
}

/** تقسیم رشتهٔ style در اولین کامای سطح بالا (داخل {…} شمرده نمی‌شود). */
function splitTopLevel(s: string, maxParts = 3): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    if (ch === ',' && depth === 0 && out.length < maxParts - 1) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** استخراج متن متوازن از بعد از اولین '{' (index برگشتی: بعد از '}'). */
function readBalanced(src: string, from: number): { body: string; end: number } | null {
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return { body: src.slice(from + 1, i), end: i + 1 };
    }
  }
  return null;
}

/**
 * شکستن بدنهٔ plural/select به جفت‌های `key {message}`.
 * کلیدها: `=N` (plural) یا کلمات (one/other/male/…).
 */
function parseCases(style: string): Array<{ key: string; body: string }> | null {
  const cases: Array<{ key: string; body: string }> = [];
  let i = 0;
  while (i < style.length) {
    while (i < style.length && /\s/.test(style[i]!)) i++;
    if (i >= style.length) break;
    const m = /^(?:=[0-9]+|[a-zA-Z]+)/.exec(style.slice(i));
    if (!m) return null;
    const key = m[0];
    i += key.length;
    while (i < style.length && /\s/.test(style[i]!)) i++;
    if (style[i] !== '{') return null;
    const block = readBalanced(style, i);
    if (!block) return null;
    cases.push({ key, body: block.body });
    i = block.end;
  }
  return cases.length > 0 ? cases : null;
}

/** رندر یک قالب ICU-subset. */
export function formatTemplate(template: string, params: I18nParams, hooks: FormatHooks): string {
  let out = '';
  let i = 0;
  while (i < template.length) {
    const open = template.indexOf('{', i);
    if (open === -1) {
      out += template.slice(i);
      break;
    }
    out += template.slice(i, open);
    const block = readBalanced(template, open);
    if (!block) {
      out += hooks.onInvalid('unclosed brace', { pos: open });
      i = open + 1;
      continue;
    }
    out += renderPlaceholder(block.body.trim(), params, hooks);
    i = block.end;
  }
  return out;
}

function renderPlaceholder(body: string, params: I18nParams, hooks: FormatHooks): string {
  const parts = splitTopLevel(body).map((x) => x.trim());
  const [name] = parts;
  if (!name) return hooks.onInvalid('empty placeholder', {});
  const raw = params[name];

  // {name}
  if (parts.length === 1) {
    if (raw === undefined || raw === null) return hooks.onInvalid(`missing param ${name}`, {});
    return hooks.formatParam(raw);
  }

  const type = parts[1];
  if (type === 'number') {
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n)) return hooks.onInvalid(`number expects numeric ${name}`, {});
    return hooks.n(n, parts[2]);
  }
  if (type === 'date') {
    const d = raw instanceof Date ? raw : typeof raw === 'number' ? new Date(raw) : null;
    if (!d) return hooks.onInvalid(`date expects Date|number for ${name}`, {});
    return hooks.d(d, parts[2]);
  }
  if (type === 'plural') {
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n)) return hooks.onInvalid(`plural expects numeric ${name}`, {});
    const style = parts[2] ?? '';
    const cases = parseCases(style);
    if (!cases) return hooks.onInvalid('bad plural cases', { style: style.slice(0, 40) });
    const exact = cases.find((c) => c.key === `=${n}`);
    const keyword = exact ? exact.key : hooks.plural(n);
    const pick =
      cases.find((c) => c.key === (exact ? `=${n}` : keyword)) ??
      cases.find((c) => c.key === 'other');
    if (!pick) return hooks.onInvalid('plural without other case', {});
    // # → count قالب‌بندی‌شده
    const body = pick.body.replace(/#/g, () => hooks.formatCount(n));
    return formatTemplate(body, params, hooks);
  }
  if (type === 'select') {
    const sel = raw === undefined || raw === null ? 'other' : String(raw);
    const cases = parseCases(parts[2] ?? '');
    if (!cases) return hooks.onInvalid('bad select cases', {});
    const pick = cases.find((c) => c.key === sel) ?? cases.find((c) => c.key === 'other');
    if (!pick) return hooks.onInvalid('select without other case', { value: sel });
    return formatTemplate(pick.body, params, hooks);
  }
  return hooks.onInvalid(`unknown type ${type}`, {});
}
