/**
 * @zenith/language-server — diagnostics with `ZEN-xxx` codes (#160).
 *
 * Two diagnostic families, both grounded in shipped catalogs:
 *
 * - unknown directives → `ZEN-501` (`Unknown directive at compile time.`,
 *   `packages/errors/src/error-locale.ts`), the same condition the compiler
 *   warns about in `packages/compiler/src/walk.ts` (strict mode throws).
 * - deprecated API identifiers inside directive expressions → their own
 *   `ZEN-DEPR-xxx` code from `packages/errors/src/deprecation-codes.ts`.
 *   Only single-identifier renames are covered (safe for quick-fix); every
 *   structural migration stays manual, like the codemod (#167) policy.
 *
 * A defensive `ZEN-2510` (metadata failed to load,
 * `packages/errors/src/reserved-codes-b.ts`) fires when the known-directive
 * set is empty — unreachable through the public barrel, which always imports
 * `@zenith/compiler`, but it keeps the "server never goes silent" contract.
 */
import { scanZenithAttributes } from './analysis.js';
import { analyzeTemplateTypes, type TemplateStateTypes } from '@zenith/compiler';
import { closestDirectiveName, directiveBaseName, isKnownDirective, KNOWN_DIRECTIVES } from './directives.js';
import { lspPositionAt } from './documents.js';
import type { LspDiagnostic, LspDocumentUri } from './types.js';
import { LSP_DIAGNOSTIC_SEVERITY, LSP_DIAGNOSTIC_TAG } from './types.js';

/** Diagnostics options. @public */
export interface ZenithDiagnosticsOptions {
  /**
   * Mirror the compiler strict mode: unknown directives become errors
   * instead of warnings.
   *
   * @default false
   */
  strict?: boolean;
  /**
   * Opt-in template type schema (#111, shared engine with the compiler).
   *
   * When present, directive expressions are checked against the declared
   * state types: unknown identifiers and incompatible uses surface as
   * `ZEN-502` errors with exact spans. Absent = legacy behavior (no
   * expression checking at all).
   */
  stateTypes?: TemplateStateTypes;
}

/**
 * Machine-readable diagnostic payload (consumed by `codeActionsFor`).
 *
 * @public
 */
export interface ZenithDiagnosticData {
  kind: 'unknown-directive' | 'deprecated-api' | 'unknown-identifier' | 'incompatible-type';
  /** The unknown base name, or the deprecated identifier. */
  from: string;
  /** Suggested replacement (closest directive / new identifier). */
  to?: string;
  /** The catalog code (`ZEN-501` / `ZEN-DEPR-xxx`). */
  code: string;
}

/**
 * Deprecated identifiers the server flags inside directive expressions.
 * Single-identifier renames only, with exact codes/replacements from
 * `packages/errors/src/deprecation-codes.ts`.
 *
 * @public
 */
export const DEPRECATED_IDENTIFIER_RENAMES: Readonly<Record<string, { code: string; replacement: string }>> = {
  processVirtualList: { code: 'ZEN-DEPR-001', replacement: 'createVirtualList' },
  clearCache: { code: 'ZEN-DEPR-005', replacement: 'clearHttpCache' },
  registerCache: { code: 'ZEN-DEPR-042', replacement: 'registerDevtoolsCache' },
  registerStore: { code: 'ZEN-DEPR-043', replacement: 'registerDevtoolsStore' },
  registerSignal: { code: 'ZEN-DEPR-044', replacement: 'registerPanelSignal' },
};

function stripQuotedSpans(value: string): string {
  return value
    .replace(/'(?:[^'\\]|\\.)*'/g, (span) => ' '.repeat(span.length))
    .replace(/"(?:[^"\\]|\\.)*"/g, (span) => ' '.repeat(span.length));
}

/**
 * Compute diagnostics for a document. Total: never throws on any input
 * (the server wraps it in try/catch regardless).
 *
 * @public
 */
export function computeDiagnostics(
  text: string,
  uri?: LspDocumentUri,
  options?: ZenithDiagnosticsOptions,
): LspDiagnostic[] {
  const strict = options?.strict === true;
  void uri;
  if (KNOWN_DIRECTIVES.size === 0) {
    return [
      {
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
        severity: LSP_DIAGNOSTIC_SEVERITY.Error,
        code: 'ZEN-2510',
        source: 'zenith',
        message: 'Directive metadata failed to load (ZEN-2510).',
      },
    ];
  }
  const diagnostics: LspDiagnostic[] = [];
  // #111 — type-safe opt-in via the shared compiler engine (same findings,
  // same spans as `compileTemplate` with `stateTypes`; severity is always
  // Error here because the user explicitly opted in).
  if (options?.stateTypes !== undefined) {
    for (const finding of analyzeTemplateTypes(text, options.stateTypes)) {
      diagnostics.push({
        range: {
          start: { line: finding.line, character: finding.character },
          end: { line: finding.endLine, character: finding.endCharacter },
        },
        severity: LSP_DIAGNOSTIC_SEVERITY.Error,
        code: finding.code,
        source: 'zenith',
        // The engine message already carries the nearest-name suggestion.
        message: finding.message,
        data: {
          kind: finding.kind,
          from: finding.name,
          code: finding.code,
          ...(finding.suggestion === undefined ? {} : { to: finding.suggestion }),
        } satisfies ZenithDiagnosticData,
      });
    }
  }
  for (const attr of scanZenithAttributes(text)) {
    const base = directiveBaseName(attr.raw);
    if (!isKnownDirective(attr.raw)) {
      const suggestion = closestDirectiveName(base);
      const data: ZenithDiagnosticData = {
        kind: 'unknown-directive',
        from: base,
        code: 'ZEN-501',
        ...(suggestion === null ? {} : { to: suggestion }),
      };
      diagnostics.push({
        range: {
          start: lspPositionAt(text, attr.nameStart),
          end: lspPositionAt(text, attr.nameEnd),
        },
        severity: strict ? LSP_DIAGNOSTIC_SEVERITY.Error : LSP_DIAGNOSTIC_SEVERITY.Warning,
        code: 'ZEN-501',
        source: 'zenith',
        message:
          `Unknown directive '${attr.raw}' (ZEN-501: Unknown directive at compile time.)` +
          (suggestion === null ? '' : ` Did you mean '${suggestion}'?`),
        data,
      });
    }
    if (attr.value !== null && attr.valueStart !== null) {
      const masked = stripQuotedSpans(attr.value);
      const names = Object.keys(DEPRECATED_IDENTIFIER_RENAMES);
      if (names.length > 0) {
        for (const name of names) {
          const entry = DEPRECATED_IDENTIFIER_RENAMES[name]!;
          const identifierRe = new RegExp(`\\b${name}\\b`, 'g');
          let m: RegExpExecArray | null;
          while ((m = identifierRe.exec(masked)) !== null) {
            // Skip the `$`-prefixed signal form (`$registerStore` is a
            // signal reference, not the deprecated global).
            if (masked[m.index - 1] === '$') continue;
            const start = attr.valueStart + m.index;
            diagnostics.push({
              range: {
                start: lspPositionAt(text, start),
                end: lspPositionAt(text, start + name.length),
              },
              severity: LSP_DIAGNOSTIC_SEVERITY.Warning,
              code: entry.code,
              source: 'zenith',
              message: `'${name}' is deprecated (${entry.code}); use '${entry.replacement}'.`,
              tags: [LSP_DIAGNOSTIC_TAG.Deprecated],
              data: {
                kind: 'deprecated-api',
                from: name,
                to: entry.replacement,
                code: entry.code,
              } satisfies ZenithDiagnosticData,
            });
          }
        }
      }
    }
  }
  return diagnostics.sort((a, b) => {
    if (a.range.start.line !== b.range.start.line) return a.range.start.line - b.range.start.line;
    if (a.range.start.character !== b.range.start.character)
      return a.range.start.character - b.range.start.character;
    return a.code.localeCompare(b.code);
  });
}
