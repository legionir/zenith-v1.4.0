/**
 * @zenith/language-server — safe document formatting (#160).
 *
 * Deliberately minimal: trailing-whitespace trimming plus exactly one
 * trailing newline. No re-indentation, no attribute sorting — the server has
 * no opinion about style, only about invisible noise. The operation is
 * idempotent (`format(format(x)) === format(x)`) and returns `[]` when the
 * document is already clean, so editors can call it unconditionally.
 */
import { lspPositionAt } from './documents.js';
import type { LspTextEdit } from './types.js';

/** Formatting options. @public */
export interface ZenithFormatOptions {
  /**
   * Strip trailing spaces/tabs on every line.
   *
   * @default true
   */
  trimTrailingWhitespace?: boolean;
  /**
   * End the document with exactly one `\n`.
   *
   * @default true
   */
  insertFinalNewline?: boolean;
}

/**
 * Compute the formatting edits for a document (empty when already clean).
 *
 * @public
 */
export function formatDocument(text: string, options?: ZenithFormatOptions): LspTextEdit[] {
  const trim = options?.trimTrailingWhitespace !== false;
  const newline = options?.insertFinalNewline !== false;
  if (text.length === 0) return [];
  let next = text;
  if (trim) {
    next = next
      .split('\n')
      .map((line) => line.replace(/[ \t]+$/, ''))
      .join('\n');
  }
  if (newline) next = next.replace(/\s*$/, '\n');
  if (next === text) return [];
  const end = lspPositionAt(text, text.length);
  return [
    {
      range: { start: { line: 0, character: 0 }, end },
      newText: next,
    },
  ];
}
