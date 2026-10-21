/**
 * @zenith/language-server — hand-written LSP 3.17 protocol types (#160).
 *
 * No new dependency: the five wire shapes the server speaks are declared here
 * instead of pulling `vscode-languageserver-protocol` (Tooling→Tooling already
 * depends on `@zenith/compiler`; nothing else is needed). Only the subset the
 * server implements is modelled; every name is `Lsp`-prefixed so the
 * repo-wide unique-type audit (#50) stays green.
 */

/** A document URI (`file:///…`, `untitled:…`). @public */
export type LspDocumentUri = string;

/** Zero-based line/character, UTF-16 code units (LSP 3.17 `Position`). @public */
export interface LspPosition {
  line: number;
  character: number;
}

/** A half-open range (`start` inclusive, `end` exclusive). @public */
export interface LspRange {
  start: LspPosition;
  end: LspPosition;
}

/** A range inside a document. @public */
export interface LspLocation {
  uri: LspDocumentUri;
  range: LspRange;
}

/** Diagnostic severity values (LSP 3.17 `DiagnosticSeverity`). @public */
export type LspDiagnosticSeverity = 1 | 2 | 3 | 4;

/** Diagnostic severity constants. @public */
export const LSP_DIAGNOSTIC_SEVERITY = /* @__PURE__ */ Object.freeze({
  Error: 1,
  Warning: 2,
  Information: 3,
  Hint: 4,
});

/** Diagnostic tag values (LSP 3.17 `DiagnosticTag`). @public */
export type LspDiagnosticTag = 1 | 2;

/** Diagnostic tag constants. @public */
export const LSP_DIAGNOSTIC_TAG = /* @__PURE__ */ Object.freeze({
  Unnecessary: 1,
  Deprecated: 2,
});

/** A diagnostic with a Zenith `ZEN-xxx` / `ZEN-DEPR-xxx` code. @public */
export interface LspDiagnostic {
  range: LspRange;
  severity: LspDiagnosticSeverity;
  /** e.g. `'ZEN-501'`, `'ZEN-DEPR-005'`, `'ZEN-2510'`. */
  code: string;
  source: string;
  message: string;
  tags?: LspDiagnosticTag[];
  /** Machine-readable payload consumed by `codeActionsFor`. */
  data?: unknown;
}

/** A single text replacement. @public */
export interface LspTextEdit {
  range: LspRange;
  newText: string;
}

/** Completion item kinds used by the server. @public */
export type LspCompletionItemKind = 6 | 10 | 14 | 15;

/** Completion item kind constants (subset of LSP 3.17). @public */
export const LSP_COMPLETION_ITEM_KIND = /* @__PURE__ */ Object.freeze({
  Variable: 6,
  Property: 10,
  Keyword: 14,
  Snippet: 15,
});

/** A completion suggestion. @public */
export interface LspCompletionItem {
  label: string;
  kind: LspCompletionItemKind;
  detail?: string;
  documentation?: string | LspMarkupContent;
  insertText?: string;
  filterText?: string;
}

/** Markdown (or plain-text) hover/documentation payload. @public */
export interface LspMarkupContent {
  kind: 'plaintext' | 'markdown';
  value: string;
}

/** Hover result. @public */
export interface LspHover {
  contents: LspMarkupContent;
  range?: LspRange;
}

/** Symbol kinds used by `documentSymbols`. @public */
export type LspSymbolKind = 5 | 6 | 8 | 12 | 13;

/** Symbol kind constants (subset of LSP 3.17). @public */
export const LSP_SYMBOL_KIND = /* @__PURE__ */ Object.freeze({
  Class: 5,
  Method: 6,
  Field: 8,
  Function: 12,
  Variable: 13,
});

/** A document symbol (elements carrying `zen-*` directives). @public */
export interface LspDocumentSymbol {
  name: string;
  kind: LspSymbolKind;
  range: LspRange;
  selectionRange: LspRange;
  children?: LspDocumentSymbol[];
}

/** A folding range (multi-line element). @public */
export interface LspFoldingRange {
  startLine: number;
  endLine: number;
  kind?: 'region';
}

/** A document link (`zen-link="…"` with a literal target). @public */
export interface LspDocumentLink {
  range: LspRange;
  target: string;
  tooltip?: string;
}

/** Semantic tokens payload (delta-encoded, LSP 3.17). @public */
export interface LspSemanticTokens {
  resultId?: string;
  data: number[];
}

/** The token legend served in `ServerCapabilities`. @public */
export interface LspSemanticTokensLegend {
  tokenTypes: string[];
  tokenModifiers: string[];
}

/** A quick-fix code action. @public */
export interface LspCodeAction {
  title: string;
  kind: 'quickfix';
  diagnostics: LspDiagnostic[];
  edit: {
    changes: Record<string, LspTextEdit[]>;
  };
}

/** An opened text document. @public */
export interface LspTextDocumentItem {
  uri: LspDocumentUri;
  languageId?: string;
  version: number;
  text: string;
}

/** A versioned document reference. @public */
export interface LspVersionedTextDocumentIdentifier {
  uri: LspDocumentUri;
  version: number;
}

/** Position params shared by hover/definition/completion. @public */
export interface LspTextDocumentPositionParams {
  textDocument: { uri: LspDocumentUri };
  position: LspPosition;
}

/** Reference lookup context. @public */
export interface LspReferenceContext {
  includeDeclaration: boolean;
}

/** Formatting options (subset of LSP 3.17). @public */
export interface LspFormattingOptions {
  tabSize?: number;
  insertSpaces?: boolean;
}

/** Diagnostics push payload. @public */
export interface LspPublishDiagnosticsParams {
  uri: LspDocumentUri;
  version?: number;
  diagnostics: LspDiagnostic[];
}

/** Server capabilities advertised on `initialize`. @public */
export interface LspServerCapabilities {
  textDocumentSync: number;
  completionProvider: { triggerCharacters: string[] };
  hoverProvider: boolean;
  definitionProvider: boolean;
  referencesProvider: boolean;
  renameProvider: boolean;
  documentFormattingProvider: boolean;
  foldingRangeProvider: boolean;
  documentLinkProvider: Record<string, never>;
  semanticTokensProvider: { legend: LspSemanticTokensLegend; full: boolean };
  codeActionProvider: { codeActionKinds: string[] };
}

/** The `initialize` result. @public */
export interface LspInitializeResult {
  capabilities: LspServerCapabilities;
  serverInfo: { name: string };
}

/** JSON-RPC 3.17 LSP message names spoken by this server. @public */
export const LSP_METHODS = /* @__PURE__ */ Object.freeze({
  InitializeRequest: 'initialize',
  InitializedNotification: 'initialized',
  ShutdownRequest: 'shutdown',
  ExitNotification: 'exit',
  DidOpenTextDocumentNotification: 'textDocument/didOpen',
  DidChangeTextDocumentNotification: 'textDocument/didChange',
  DidCloseTextDocumentNotification: 'textDocument/didClose',
  PublishDiagnosticsNotification: 'textDocument/publishDiagnostics',
  CompletionRequest: 'textDocument/completion',
  HoverRequest: 'textDocument/hover',
  DefinitionRequest: 'textDocument/definition',
  ReferencesRequest: 'textDocument/references',
  RenameRequest: 'textDocument/rename',
  FormattingRequest: 'textDocument/formatting',
  FoldingRangeRequest: 'textDocument/foldingRange',
  DocumentLinkRequest: 'textDocument/documentLink',
  SemanticTokensRequest: 'textDocument/semanticTokens/full',
  CodeActionRequest: 'textDocument/codeAction',
});

/** Standard JSON-RPC error codes. @public */
export const LSP_ERROR_CODES = /* @__PURE__ */ Object.freeze({
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
});

/** A JSON-RPC request (or notification when `id` is absent). @public */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: unknown;
}

/** A JSON-RPC response. @public */
export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

/** A server-to-client JSON-RPC notification. @public */
export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}
