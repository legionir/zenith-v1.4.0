/**
 * @zenith/language-server — semantic tokens (#160).
 *
 * Two token types, no modifiers: directive attribute names (`decorator`) and
 * `$signal` references (`variable`). The encoding is the standard LSP
 * five-integer delta form, and `decodeSemanticTokens` round-trips it for
 * tests and thin clients that want positions without re-parsing.
 */
import { scanSignalOccurrences, scanZenithAttributes } from './analysis.js';
import { lspPositionAt } from './documents.js';
import type { LspSemanticTokens, LspSemanticTokensLegend } from './types.js';

/** The legend served in `ServerCapabilities`. @public */
export const LSP_SEMANTIC_TOKENS_LEGEND: LspSemanticTokensLegend = {
  tokenTypes: ['decorator', 'variable'],
  tokenModifiers: [],
};

/** One decoded token. @public */
export interface ZenithDecodedSemanticToken {
  line: number;
  character: number;
  length: number;
  tokenType: number;
}

/**
 * Encode directive names (type 0) and signal references (type 1) as LSP
 * semantic tokens.
 *
 * @public
 */
export function semanticTokensFor(text: string): LspSemanticTokens {
  const flat: ZenithDecodedSemanticToken[] = [];
  for (const attr of scanZenithAttributes(text)) {
    const pos = lspPositionAt(text, attr.nameStart);
    flat.push({ line: pos.line, character: pos.character, length: attr.nameEnd - attr.nameStart, tokenType: 0 });
  }
  for (const occurrence of scanSignalOccurrences(text)) {
    flat.push({
      line: occurrence.line,
      character: occurrence.character,
      length: occurrence.end - occurrence.start,
      tokenType: 1,
    });
  }
  flat.sort((a, b) => a.line - b.line || a.character - b.character);
  const data: number[] = [];
  let previousLine = 0;
  let previousCharacter = 0;
  for (const token of flat) {
    const deltaLine = token.line - previousLine;
    data.push(deltaLine, deltaLine === 0 ? token.character - previousCharacter : token.character, token.length, token.tokenType, 0);
    previousLine = token.line;
    previousCharacter = token.character;
  }
  return { data };
}

/**
 * Decode an LSP semantic-tokens payload back to absolute positions.
 *
 * @public
 */
export function decodeSemanticTokens(data: readonly number[]): ZenithDecodedSemanticToken[] {
  const out: ZenithDecodedSemanticToken[] = [];
  let line = 0;
  let character = 0;
  for (let i = 0; i + 5 <= data.length; i += 5) {
    const deltaLine = data[i]!;
    const deltaStart = data[i + 1]!;
    line += deltaLine;
    character = deltaLine === 0 ? character + deltaStart : deltaStart;
    out.push({ line, character, length: data[i + 2]!, tokenType: data[i + 3]! });
  }
  return out;
}
