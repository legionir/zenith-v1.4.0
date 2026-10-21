/**
 * @zenith/language-server — document analysis (#160).
 *
 * `analyzeZenithDocument` is the byte-compatible core introduced with the
 * package skeleton (pinned by `scripts/test/wave5-batch1.test.mjs`): a grep
 * over `zen-*` names and `$signal` references with exact line/character
 * positions. `scanZenithAttributes` builds on the same positions with
 * attribute values, mirroring how the compiler splits names
 * (`packages/compiler/src/analyze-element.ts`: `attr.name.split(':')[0]`).
 */
import { lspPositionAt } from './documents.js';

/** Grep-style document match for directives/signals. @public */
export interface ZenithGrepMatch {
  line: number;
  character: number;
  length: number;
  name: string;
}

/** Document analysis result (directives + signals). @public */
export interface ZenithDocumentAnalysis {
  directives: ZenithGrepMatch[];
  signals: ZenithGrepMatch[];
}

function countLinesUpTo(text: string, index: number): { line: number; character: number } {
  const prefix = text.slice(0, index);
  const line = (prefix.match(/\n/g) ?? []).length;
  const lastNewline = prefix.lastIndexOf('\n');
  const character = index - (lastNewline === -1 ? 0 : lastNewline + 1);
  return { line, character };
}

/**
 * #160: تحلیل متن سند و استخراج دایرکتیوها (`zen-*`) و سیگنال‌ها (`$name`).
 * @public
 */
export function analyzeZenithDocument(text: string): ZenithDocumentAnalysis {
  const directives: ZenithGrepMatch[] = [];
  const signals: ZenithGrepMatch[] = [];

  const directiveRe = /\b(zen-[a-z][a-z0-9-]*)\b/g;
  let m: RegExpExecArray | null;
  while ((m = directiveRe.exec(text)) !== null) {
    const pos = countLinesUpTo(text, m.index);
    directives.push({ ...pos, length: m[0].length, name: m[1]! });
  }

  const signalRe = /\$([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
  while ((m = signalRe.exec(text)) !== null) {
    // skip jQuery-like `$(` or template `${`
    const prev = text[m.index - 1];
    if (prev === '(' || prev === '{') continue;
    const pos = countLinesUpTo(text, m.index);
    signals.push({ ...pos, length: m[0].length, name: m[1]! });
  }

  return { directives, signals };
}

/**
 * One `zen-*` attribute occurrence with its value span (when present).
 *
 * `raw` keeps the full attribute name (`zen-bind:href`,
 * `zen-action:click.prevent`); `base` is the compiler-style lookup name
 * (`zen-bind`, `zen-action`). Boolean attributes (`zen-cloak`, `zen-else`)
 * have `value: null`.
 *
 * @public
 */
export interface ZenithAttributeScan {
  raw: string;
  base: string;
  value: string | null;
  nameStart: number;
  nameEnd: number;
  valueStart: number | null;
  valueEnd: number | null;
  line: number;
  character: number;
}

/**
 * Scan every `zen-*` attribute with offsets and (quoted or unquoted) values.
 *
 * The scanner is intentionally shallow — it never parses the HTML tree, so a
 * truncated document still yields positions for everything before the cut.
 * An unterminated quote yields `value: null` (boolean reading) instead of
 * swallowing the rest of the document.
 *
 * @public
 */
export function scanZenithAttributes(text: string): ZenithAttributeScan[] {
  const out: ZenithAttributeScan[] = [];
  const nameRe = /zen-[a-z][a-z0-9-]*(?::[^\s=/>;"']+)?(?:\.[a-zA-Z0-9_-]+)*/g;
  let m: RegExpExecArray | null;
  while ((m = nameRe.exec(text)) !== null) {
    const raw = m[0];
    const nameStart = m.index;
    const nameEnd = nameStart + raw.length;
    const pos = lspPositionAt(text, nameStart);
    let value: string | null = null;
    let valueStart: number | null = null;
    let valueEnd: number | null = null;
    let cursor = nameEnd;
    while (cursor < text.length && /[ \t\r\n]/.test(text[cursor]!)) cursor++;
    if (text[cursor] === '=') {
      cursor++;
      while (cursor < text.length && /[ \t\r\n]/.test(text[cursor]!)) cursor++;
      const quote = text[cursor];
      if (quote === '"' || quote === "'") {
        const close = text.indexOf(quote, cursor + 1);
        if (close !== -1) {
          valueStart = cursor + 1;
          valueEnd = close;
          value = text.slice(valueStart, valueEnd);
        }
      } else if (cursor < text.length && text[cursor] !== '>' && text[cursor] !== '/') {
        valueStart = cursor;
        while (cursor < text.length && !/[\s>]/.test(text[cursor]!)) cursor++;
        valueEnd = cursor;
        value = text.slice(valueStart, valueEnd);
      }
    }
    out.push({
      raw,
      base: raw.split(':')[0]!,
      value,
      nameStart,
      nameEnd,
      valueStart,
      valueEnd,
      line: pos.line,
      character: pos.character,
    });
  }
  return out;
}

/** One `$signal` occurrence with offsets. @public */
export interface ZenithSignalOccurrence {
  name: string;
  start: number;
  end: number;
  line: number;
  character: number;
}

/**
 * Scan every `$signal` reference with offsets (same skip rule as
 * `analyzeZenithDocument`: `$(` and `${` are not signals).
 *
 * @public
 */
export function scanSignalOccurrences(text: string): ZenithSignalOccurrence[] {
  const out: ZenithSignalOccurrence[] = [];
  const signalRe = /\$([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
  let m: RegExpExecArray | null;
  while ((m = signalRe.exec(text)) !== null) {
    const prev = text[m.index - 1];
    if (prev === '(' || prev === '{') continue;
    const pos = lspPositionAt(text, m.index);
    out.push({
      name: m[1]!,
      start: m.index,
      end: m.index + m[0].length,
      line: pos.line,
      character: pos.character,
    });
  }
  return out;
}
