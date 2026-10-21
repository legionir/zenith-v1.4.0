/**
 * @zenith/language-server — document links for `zen-link` (#160).
 *
 * Only literal targets become links: a value that is exactly a root-relative
 * path or an `http(s)` URL with no whitespace. Expressions (`$route.path`,
 * ternaries, concatenations) are left alone — guessing a target from code
 * would be a lie the editor would render as truth.
 */
import { scanZenithAttributes } from './analysis.js';
import { lspPositionAt } from './documents.js';
import type { LspDocumentLink } from './types.js';

const LITERAL_TARGET_RE = /^(?:\/[^\s'"<>]*|https?:\/\/[^\s'"<>]+)$/;

/**
 * Links for `zen-link="…"` attributes with literal targets. The range covers
 * the value without quotes.
 *
 * @public
 */
export function documentLinks(text: string): LspDocumentLink[] {
  const links: LspDocumentLink[] = [];
  for (const attr of scanZenithAttributes(text)) {
    if (attr.base !== 'zen-link') continue;
    if (attr.value === null || attr.valueStart === null || attr.valueEnd === null) continue;
    if (!LITERAL_TARGET_RE.test(attr.value)) continue;
    links.push({
      range: {
        start: lspPositionAt(text, attr.valueStart),
        end: lspPositionAt(text, attr.valueEnd),
      },
      target: attr.value,
      tooltip: 'Open link',
    });
  }
  return links;
}
