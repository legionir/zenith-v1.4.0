/**
 * @zenith/language-server — completion (directives, signals) (#160).
 *
 * Directives complete from the compiler-fresh `KNOWN_DIRECTIVES` set with the
 * curated `describeDirective` prose; `$signal` names complete from the
 * references visible in the same document (the server has no project-wide
 * state index — open documents are its world, like the store in
 * `documents.ts`). Plain-text `insertText` only: no snippet assumptions about
 * the client (`zenith.completion.snippets` stays editor-side with #67).
 */
import { scanSignalOccurrences, scanZenithAttributes } from './analysis.js';
import { describeDirective, listKnownDirectives } from './directives.js';
import type { LspCompletionItem } from './types.js';
import { LSP_COMPLETION_ITEM_KIND } from './types.js';

/**
 * Directive completions whose base name starts with `prefix`
 * (empty prefix lists everything, sorted).
 *
 * @public
 */
export function completeDirectives(prefix: string): LspCompletionItem[] {
  return listKnownDirectives()
    .filter((name) => name.startsWith(prefix))
    .map((name) => {
      const info = describeDirective(name);
      const detail = info === null ? 'directive' : `${info.kind} directive`;
      const documentation =
        info === null || info.syntax === undefined
          ? info?.description
          : `${info.description}\n\n${info.syntax}`;
      return {
        label: name,
        kind: LSP_COMPLETION_ITEM_KIND.Property,
        detail,
        ...(documentation === undefined ? {} : { documentation }),
        insertText: name,
        filterText: name,
      };
    });
}

/**
 * `$signal` completions from the names referenced in `text`, filtered by
 * `prefix` (the `$` itself is not part of the prefix).
 *
 * @public
 */
export function completeSignals(text: string, prefix: string): LspCompletionItem[] {
  const seen = new Set<string>();
  const items: LspCompletionItem[] = [];
  for (const occurrence of scanSignalOccurrences(text)) {
    if (seen.has(occurrence.name) || !occurrence.name.startsWith(prefix)) continue;
    seen.add(occurrence.name);
    items.push({
      label: `$${occurrence.name}`,
      kind: LSP_COMPLETION_ITEM_KIND.Variable,
      detail: 'signal reference',
      insertText: `$${occurrence.name}`,
      filterText: `$${occurrence.name}`,
    });
  }
  return items.sort((a, b) => a.label.localeCompare(b.label));
}

function attributeNameFragment(text: string, offset: number): string | null {
  const before = text.slice(0, offset);
  const match = /(zen-[a-z0-9-:]*)$/.exec(before);
  if (match === null) return null;
  // Only inside a tag: the nearest `<` must come after the nearest `>`.
  if (before.lastIndexOf('<') < before.lastIndexOf('>')) return null;
  return match[1]!;
}

function signalFragment(text: string, offset: number): string | null {
  const before = text.slice(0, offset);
  const match = /\$([a-zA-Z_][a-zA-Z0-9_]*)?$/.exec(before);
  return match === null ? null : (match[1] ?? '');
}

/**
 * Route a completion request by cursor context: inside an attribute name →
 * directives; inside an attribute value or after `$` → signals in scope.
 *
 * @public
 */
export function completeAt(text: string, offset: number): LspCompletionItem[] {
  const safe = Math.max(0, Math.min(offset, text.length));
  for (const attr of scanZenithAttributes(text)) {
    if (safe >= attr.nameStart && safe <= attr.nameEnd) {
      const fragment = text.slice(attr.nameStart, safe);
      // Past the `:` the user names a foreign attribute/event (`href`,
      // `click`) — not server vocabulary, so there is nothing to complete.
      if (fragment.includes(':')) return [];
      return completeDirectives(fragment);
    }
    if (attr.valueStart !== null && attr.valueEnd !== null && safe >= attr.valueStart && safe <= attr.valueEnd) {
      const fragment = signalFragment(attr.value, safe - attr.valueStart);
      if (fragment !== null) return completeSignals(text, fragment);
      return [];
    }
  }
  const nameFragment = attributeNameFragment(text, safe);
  if (nameFragment !== null) {
    if (nameFragment.includes(':')) return [];
    return completeDirectives(nameFragment);
  }
  const bareSignal = signalFragment(text, safe);
  if (bareSignal !== null && bareSignal.length > 0) return completeSignals(text, bareSignal);
  return [];
}
