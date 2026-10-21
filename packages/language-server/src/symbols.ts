/**
 * @zenith/language-server — document symbols and folding (#160).
 *
 * A tiny dependency-free tag walk (no HTML parser): elements carrying at
 * least one `zen-*` attribute become symbols, nested by tag balance.
 * Void elements and self-closing tags never open a scope; anything the walk
 * cannot balance is left un-nested rather than mis-nested. Folding reuses the
 * same walk and keeps only multi-line spans.
 */
import { lspPositionAt } from './documents.js';
import type { LspDocumentSymbol, LspFoldingRange } from './types.js';
import { LSP_SYMBOL_KIND } from './types.js';

const VOID_ELEMENTS: ReadonlySet<string> = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

interface ElementSpan {
  tag: string;
  start: number;
  end: number;
  tagNameEnd: number;
  hasDirective: boolean;
  firstDirective: string;
  selfClosing: boolean;
}

function walkElements(text: string): { spans: ElementSpan[]; pairs: Array<{ open: ElementSpan; close: number }> } {
  const spans: ElementSpan[] = [];
  const pairs: Array<{ open: ElementSpan; close: number }> = [];
  const stack: ElementSpan[] = [];
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9-]*)\b([^<>]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(text)) !== null) {
    const full = m[0];
    const tag = m[1]!.toLowerCase();
    const start = m.index;
    if (full.startsWith('</')) {
      for (let depth = stack.length - 1; depth >= 0; depth--) {
        if (stack[depth]!.tag === tag) {
          const open = stack.splice(depth, 1)[0]!;
          pairs.push({ open, close: start + full.length });
          break;
        }
      }
      continue;
    }
    const attrsText = m[2] ?? '';
    const directive = /zen-[a-z][a-z0-9-]*/.exec(attrsText)?.[0] ?? null;
    const selfClosing = full.endsWith('/>') || VOID_ELEMENTS.has(tag);
    const span: ElementSpan = {
      tag,
      start,
      end: start + full.length,
      tagNameEnd: start + 1 + m[1]!.length,
      hasDirective: directive !== null,
      firstDirective: directive ?? '',
      selfClosing,
    };
    spans.push(span);
    if (!selfClosing) stack.push(span);
  }
  return { spans, pairs };
}

/**
 * Nested symbols for elements carrying `zen-*` directives. The symbol name
 * is the tag plus its first directive (`li[zen-for]`); the selection range
 * covers the tag name.
 *
 * @public
 */
export function documentSymbols(text: string): LspDocumentSymbol[] {
  const { pairs, spans } = walkElements(text);
  // Parents open earlier and close later: start ascending, close descending.
  const sorted = [...pairs].sort(
    (a, b) => a.open.start - b.open.start || b.close - a.close,
  );
  const roots: LspDocumentSymbol[] = [];
  const stack: Array<{ close: number; symbol: LspDocumentSymbol }> = [];
  const attach = (symbol: LspDocumentSymbol): void => {
    const parent = stack[stack.length - 1];
    if (parent === undefined) roots.push(symbol);
    else parent.symbol.children = [...(parent.symbol.children ?? []), symbol];
  };
  const toSymbol = (tag: string, directive: string, start: number, end: number, tagNameEnd: number): LspDocumentSymbol => ({
    name: `${tag}[${directive}]`,
    kind: LSP_SYMBOL_KIND.Field,
    range: {
      start: lspPositionAt(text, start),
      end: lspPositionAt(text, end),
    },
    selectionRange: {
      start: lspPositionAt(text, start + 1),
      end: lspPositionAt(text, tagNameEnd),
    },
  });
  const leaves = spans
    .filter((span) => span.hasDirective && span.selfClosing)
    .sort((a, b) => a.start - b.start);
  // One position-ordered sweep: pairs open scopes, leaves attach to the
  // innermost scope still open at their offset. Anything unbalanceable is
  // left out rather than mis-nested.
  const events: Array<{ start: number; pair?: { open: ElementSpan; close: number }; leaf?: ElementSpan }> = [
    ...sorted.map(({ open, close }) => ({ start: open.start, pair: { open, close } })),
    ...leaves.map((leaf) => ({ start: leaf.start, leaf })),
  ].sort((a, b) => a.start - b.start);
  for (const event of events) {
    while (stack.length > 0 && stack[stack.length - 1]!.close <= event.start) stack.pop();
    if (event.pair !== undefined) {
      const { open, close } = event.pair;
      if (!open.hasDirective) continue;
      const symbol = toSymbol(open.tag, open.firstDirective, open.start, close, open.tagNameEnd);
      attach(symbol);
      stack.push({ close, symbol });
    } else if (event.leaf !== undefined) {
      const leaf = event.leaf;
      attach(toSymbol(leaf.tag, leaf.firstDirective, leaf.start, leaf.end, leaf.tagNameEnd));
    }
  }
  return roots;
}

/**
 * Folding ranges for multi-line elements (directive or not — structure is
 * structure).
 *
 * @public
 */
export function foldingRanges(text: string): LspFoldingRange[] {
  return walkElements(text)
    .pairs.map(({ open, close }) => ({
      startLine: lspPositionAt(text, open.start).line,
      endLine: lspPositionAt(text, close).line,
    }))
    .filter((range) => range.endLine > range.startLine)
    .map((range) => ({ ...range, kind: 'region' as const }));
}
