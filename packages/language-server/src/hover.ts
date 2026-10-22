/**
 * @zenith/language-server — hover (#160).
 *
 * Directives hover from the curated `describeDirective` prose (seed registry
 * first, kind-grounded core notes where the seed is silent); `$signal` hover
 * reports the references visible in the same document. Anything else hovers
 * to `null` — the server never invents documentation.
 */
import { scanSignalOccurrences, scanZenithAttributes } from './analysis.js';
import { describeDirective, directiveBaseName } from './directives.js';
import { lspPositionAt } from './documents.js';
import type { LspHover } from './types.js';

/**
 * Hover at a UTF-16 offset: directive documentation, signal references, or
 * `null` when the cursor is on nothing the server knows.
 *
 * @public
 */
export function hoverAt(text: string, offset: number): LspHover | null {
  const safe = Math.max(0, Math.min(offset, text.length));
  for (const attr of scanZenithAttributes(text)) {
    if (safe >= attr.nameStart && safe <= attr.nameEnd) {
      const base = directiveBaseName(attr.raw);
      const info = describeDirective(base);
      if (info === null) return null;
      const lines = [`\`${info.name}\` — ${info.kind} directive`, '', info.description];
      if (info.syntax !== undefined) lines.push('', '```html', info.syntax, '```');
      if (info.docs !== undefined) lines.push('', info.docs);
      return {
        contents: { kind: 'markdown', value: lines.join('\n') },
        range: {
          start: lspPositionAt(text, attr.nameStart),
          end: lspPositionAt(text, attr.nameEnd),
        },
      };
    }
  }
  const occurrences = scanSignalOccurrences(text);
  const hit = occurrences.find((occurrence) => safe >= occurrence.start && safe <= occurrence.end);
  if (hit === undefined) return null;
  const same = occurrences.filter((occurrence) => occurrence.name === hit.name);
  const first = same[0]!;
  return {
    contents: {
      kind: 'markdown',
      value:
        `\`$${hit.name}\` — signal reference\n\n` +
        `${same.length === 1 ? '1 reference' : `${same.length} references`} in this document` +
        ` (first at line ${first.line + 1}).`,
    },
    range: {
      start: lspPositionAt(text, hit.start),
      end: lspPositionAt(text, hit.end),
    },
  };
}
