/**
 * @zenith/language-server — quick-fix code actions (#160, SPEC §3.11).
 *
 * Actions are derived from the machine-readable `data` on diagnostics, so
 * the editor only ever offers a fix the diagnostic itself justifies:
 *
 * - unknown directive with a close match → replace with the match, plus a
 *   remove-attribute fallback (a misspelled directive that "works" nowhere
 *   is worse than no directive);
 * - deprecated identifier → replace with the catalogued replacement
 *   (single-identifier renames only, mirroring the diagnostics contract).
 *
 * Applying the produced edits and re-running `computeDiagnostics` removes
 * the source diagnostic — pinned by test, not by promise.
 */
import { scanZenithAttributes } from './analysis.js';
import { lspPositionAt } from './documents.js';
import type { LspCodeAction, LspDiagnostic, LspDocumentUri, LspTextEdit } from './types.js';
import type { ZenithDiagnosticData } from './diagnostics.js';

function isDiagnosticData(data: unknown): data is ZenithDiagnosticData {
  if (typeof data !== 'object' || data === null) return false;
  const kind = (data as { kind?: unknown }).kind;
  return kind === 'unknown-directive' || kind === 'deprecated-api';
}

/**
 * Quick-fixes for previously computed diagnostics in one document.
 *
 * @public
 */
export function codeActionsFor(
  text: string,
  uri: LspDocumentUri,
  diagnostics: readonly LspDiagnostic[],
): LspCodeAction[] {
  const actions: LspCodeAction[] = [];
  const attributes = scanZenithAttributes(text);
  for (const diagnostic of diagnostics) {
    if (!isDiagnosticData(diagnostic.data)) continue;
    const data = diagnostic.data;
    if (data.kind === 'unknown-directive') {
      const attr = attributes.find(
        (candidate) =>
          lspPositionAt(text, candidate.nameStart).line === diagnostic.range.start.line &&
          lspPositionAt(text, candidate.nameStart).character === diagnostic.range.start.character,
      );
      if (attr === undefined) continue;
      if (data.to !== undefined) {
        const replace: LspTextEdit = {
          range: {
            start: lspPositionAt(text, attr.nameStart),
            end: lspPositionAt(text, attr.nameEnd),
          },
          newText: data.to,
        };
        actions.push({
          title: `Replace with '${data.to}'`,
          kind: 'quickfix',
          diagnostics: [diagnostic],
          edit: { changes: { [uri]: [replace] } },
        });
      }
      const attributeEnd =
        attr.valueEnd !== null ? attr.valueEnd + 1 : attr.nameEnd;
      const remove: LspTextEdit = {
        range: {
          start: lspPositionAt(text, attr.nameStart),
          end: lspPositionAt(text, attributeEnd),
        },
        newText: '',
      };
      actions.push({
        title: `Remove '${attr.raw}' attribute`,
        kind: 'quickfix',
        diagnostics: [diagnostic],
        edit: { changes: { [uri]: [remove] } },
      });
    } else if (data.kind === 'deprecated-api' && data.to !== undefined) {
      const replace: LspTextEdit = { range: diagnostic.range, newText: data.to };
      actions.push({
        title: `Replace '${data.from}' with '${data.to}'`,
        kind: 'quickfix',
        diagnostics: [diagnostic],
        edit: { changes: { [uri]: [replace] } },
      });
    }
  }
  return actions;
}
