/**
 * @zenith/language-server — go-to-definition, references and rename for
 * `$signal` names (#160).
 *
 * One document has no declaration syntax for signals, so "definition" is the
 * first reference (stable, deterministic); references span every occurrence,
 * optionally across all open documents. Rename is a pure edit computation —
 * the name is validated and the outcome is a value, never a throw.
 */
import { scanSignalOccurrences } from './analysis.js';
import { lspOffsetAt, lspPositionAt } from './documents.js';
import type { LspDocumentUri, LspLocation, LspPosition, LspTextEdit } from './types.js';

/** The `$signal` under the cursor, or `null`. @public */
export function signalNameAt(text: string, offset: number): string | null {
  const safe = Math.max(0, Math.min(offset, text.length));
  return (
    scanSignalOccurrences(text).find(
      (occurrence) => safe >= occurrence.start && safe <= occurrence.end,
    )?.name ?? null
  );
}

/**
 * Every reference to `$name` in one document, in document order.
 *
 * @public
 */
export function findSignalReferences(
  text: string,
  uri: LspDocumentUri,
  name: string,
): LspLocation[] {
  return scanSignalOccurrences(text)
    .filter((occurrence) => occurrence.name === name)
    .map((occurrence) => ({
      uri,
      range: {
        start: lspPositionAt(text, occurrence.start),
        end: lspPositionAt(text, occurrence.end),
      },
    }));
}

/**
 * References across several open documents (`{ uri, text }` pairs), grouped
 * in the given document order.
 *
 * @public
 */
export function findSignalReferencesInDocuments(
  documents: ReadonlyArray<{ uri: LspDocumentUri; text: string }>,
  name: string,
): LspLocation[] {
  return documents.flatMap((document) => findSignalReferences(document.text, document.uri, name));
}

/**
 * The "definition" of `$name`: its first occurrence, or `null` when the
 * document never mentions it.
 *
 * @public
 */
export function findSignalDefinition(
  text: string,
  uri: LspDocumentUri,
  name: string,
): LspLocation | null {
  return findSignalReferences(text, uri, name)[0] ?? null;
}

/** Rename outcome: edits, or a validation error. @public */
export type ZenithRenameOutcome =
  | { ok: true; edits: LspTextEdit[] }
  | { ok: false; error: string };

/**
 * Compute the edits renaming `$name` to `$newName` in one document.
 * Only the `$`-prefixed occurrences move; a bare `name` in prose is left
 * alone. Invalid `newName` values yield `{ ok: false }` — never a throw.
 *
 * @public
 */
export function renameSignal(text: string, name: string, newName: string): ZenithRenameOutcome {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newName)) {
    return { ok: false, error: `'${newName}' is not a valid signal name.` };
  }
  if (newName === name) return { ok: true, edits: [] };
  const edits: LspTextEdit[] = scanSignalOccurrences(text)
    .filter((occurrence) => occurrence.name === name)
    .map((occurrence) => ({
      range: {
        start: lspPositionAt(text, occurrence.start + 1),
        end: lspPositionAt(text, occurrence.end),
      },
      newText: newName,
    }));
  return { ok: true, edits };
}

/**
 * Resolve an LSP position to the signal reference under it (used by the
 * definition/references/rename request handlers).
 *
 * @public
 */
export function signalReferenceAtPosition(
  text: string,
  position: LspPosition,
): { name: string; offset: number } | null {
  const offset = lspOffsetAt(text, position);
  const name = signalNameAt(text, offset);
  return name === null ? null : { name, offset };
}
