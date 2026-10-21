/**
 * @zenith/language-server (Tooling, node) — real LSP 3.17 server (#160).
 *
 * Thin-client contract: `vscode-extension` (and any other editor) speaks
 * JSON-RPC over stdio via `attachStdioTransport`, or drives
 * `createZenithLanguageServer` in-process. The legacy in-memory core
 * (`createZenithServerCore`, `createServerLifecycle`,
 * `analyzeZenithDocument`) stays byte-compatible underneath.
 */
export type {
  JsonRpcNotification,
  JsonRpcRequest,
  JsonRpcResponse,
  LspCodeAction,
  LspCompletionItem,
  LspCompletionItemKind,
  LspDiagnostic,
  LspDiagnosticSeverity,
  LspDiagnosticTag,
  LspDocumentLink,
  LspDocumentSymbol,
  LspDocumentUri,
  LspFoldingRange,
  LspFormattingOptions,
  LspHover,
  LspInitializeResult,
  LspLocation,
  LspMarkupContent,
  LspPosition,
  LspPublishDiagnosticsParams,
  LspRange,
  LspReferenceContext,
  LspSemanticTokens,
  LspSemanticTokensLegend,
  LspServerCapabilities,
  LspSymbolKind,
  LspTextDocumentItem,
  LspTextDocumentPositionParams,
  LspTextEdit,
  LspVersionedTextDocumentIdentifier,
} from './types.js';
export {
  LSP_COMPLETION_ITEM_KIND,
  LSP_DIAGNOSTIC_SEVERITY,
  LSP_DIAGNOSTIC_TAG,
  LSP_ERROR_CODES,
  LSP_METHODS,
  LSP_SYMBOL_KIND,
} from './types.js';
export type { ZenithDocumentStore, ZenithTextDocument } from './documents.js';
export { createDocumentStore, lspOffsetAt, lspPositionAt } from './documents.js';
export type {
  ZenithAttributeScan,
  ZenithDocumentAnalysis,
  ZenithGrepMatch,
  ZenithSignalOccurrence,
} from './analysis.js';
export { analyzeZenithDocument, scanSignalOccurrences, scanZenithAttributes } from './analysis.js';
export type { ZenithLanguageServerCore } from './memory-core.js';
export { createServerLifecycle, createZenithServerCore } from './memory-core.js';
export type { ZenithDirectiveInfo, ZenithDirectiveKind } from './directives.js';
export {
  closestDirectiveName,
  describeDirective,
  directiveBaseName,
  directiveKindOf,
  isKnownDirective,
  KNOWN_DIRECTIVES,
  listKnownDirectives,
} from './directives.js';
export type { ZenithDiagnosticData, ZenithDiagnosticsOptions } from './diagnostics.js';
export { computeDiagnostics, DEPRECATED_IDENTIFIER_RENAMES } from './diagnostics.js';
export { completeAt, completeDirectives, completeSignals } from './completion.js';
export { hoverAt } from './hover.js';
export type { ZenithRenameOutcome } from './references.js';
export {
  findSignalDefinition,
  findSignalReferences,
  findSignalReferencesInDocuments,
  renameSignal,
  signalNameAt,
  signalReferenceAtPosition,
} from './references.js';
export { documentSymbols, foldingRanges } from './symbols.js';
export { documentLinks } from './links.js';
export type { ZenithDecodedSemanticToken } from './tokens.js';
export { decodeSemanticTokens, LSP_SEMANTIC_TOKENS_LEGEND, semanticTokensFor } from './tokens.js';
export type { ZenithFormatOptions } from './format.js';
export { formatDocument } from './format.js';
export { codeActionsFor } from './actions.js';
export type {
  ZenithLanguageServer,
  ZenithLanguageServerOptions,
  ZenithTextDocumentChange,
} from './server.js';
export { createZenithLanguageServer } from './server.js';
export type { LspMessageBuffer, LspStdioTransport, ZenithStdioTransportOptions } from './stdio.js';
export {
  attachStdioTransport,
  createLspMessageBuffer,
  decodeLspMessages,
  encodeLspMessage,
} from './stdio.js';
