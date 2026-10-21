/**
 * @zenith/language-server — the real LSP 3.17 server (#160, SPEC §3.11).
 *
 * A dependency-free dispatcher over the versioned document store: every
 * request handler is a pure feature function (`diagnostics.ts`,
 * `completion.ts`, …), so the server itself only validates params, routes,
 * and pushes `textDocument/publishDiagnostics`. It never throws and never
 * crashes on client input — malformed messages become JSON-RPC errors,
 * unknown documents become `InvalidParams`, and anything unexpected is
 * caught, logged via `onLog`, and answered with `InternalError`.
 */
import { codeActionsFor } from './actions.js';
import { completeAt as completeAtOffset } from './completion.js';
import { computeDiagnostics } from './diagnostics.js';
import type { TemplateStateTypes } from '@zenith/compiler';
import { createDocumentStore, lspOffsetAt, type ZenithDocumentStore } from './documents.js';
import { documentSymbols, foldingRanges } from './symbols.js';
import { formatDocument } from './format.js';
import { hoverAt as hoverAtOffset } from './hover.js';
import { documentLinks } from './links.js';
import {
  findSignalDefinition,
  findSignalReferences,
  renameSignal,
  signalNameAt,
} from './references.js';
import { LSP_SEMANTIC_TOKENS_LEGEND, semanticTokensFor } from './tokens.js';
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  LspCodeAction,
  LspCompletionItem,
  LspDiagnostic,
  LspDocumentLink,
  LspDocumentSymbol,
  LspDocumentUri,
  LspFoldingRange,
  LspFormattingOptions,
  LspHover,
  LspInitializeResult,
  LspLocation,
  LspPosition,
  LspPublishDiagnosticsParams,
  LspRange,
  LspSemanticTokens,
} from './types.js';
import { LSP_ERROR_CODES, LSP_METHODS } from './types.js';

/** Server options. @public */
export interface ZenithLanguageServerOptions {
  /**
   * Mirror the compiler strict mode (unknown directives are errors).
   *
   * @default false
   */
  strict?: boolean;
  /**
   * Opt-in template type schema (#111, shared engine with the compiler).
   *
   * When present, published diagnostics include `ZEN-502` expression
   * findings with exact spans. Absent = legacy behavior.
   */
  stateTypes?: TemplateStateTypes;
  /**
   * Documents larger than this (UTF-16 code units) get empty features —
   * the server stays responsive on accidental megabyte pastes.
   *
   * @default 1024
   */
  maxFileSizeKb?: number;
  /** Diagnostics push sink (`textDocument/publishDiagnostics`). */
  onDiagnostics?: (params: LspPublishDiagnosticsParams) => void;
  /** Internal log sink (never the host console — `no-console` contract). */
  onLog?: (message: string) => void;
}

/** One document change (full text, or a single range replacement). @public */
export interface ZenithTextDocumentChange {
  text: string;
  range?: LspRange;
}

/** The language server handle. @public */
export interface ZenithLanguageServer {
  openDocument(document: { uri: LspDocumentUri; text: string; version: number; languageId?: string }): void;
  changeDocument(uri: LspDocumentUri, changes: readonly ZenithTextDocumentChange[], version: number): boolean;
  closeDocument(uri: LspDocumentUri): void;
  diagnosticsFor(uri: LspDocumentUri): LspDiagnostic[];
  completionFor(uri: LspDocumentUri, position: LspPosition): LspCompletionItem[];
  hoverFor(uri: LspDocumentUri, position: LspPosition): LspHover | null;
  definitionFor(uri: LspDocumentUri, position: LspPosition): LspLocation | null;
  referencesFor(uri: LspDocumentUri, position: LspPosition, includeDeclaration?: boolean): LspLocation[];
  renameFor(uri: LspDocumentUri, position: LspPosition, newName: string): { changes: Record<string, { range: LspRange; newText: string }[]> } | { error: string };
  formatFor(uri: LspDocumentUri, options?: LspFormattingOptions): { range: LspRange; newText: string }[];
  symbolsFor(uri: LspDocumentUri): LspDocumentSymbol[];
  foldingFor(uri: LspDocumentUri): LspFoldingRange[];
  linksFor(uri: LspDocumentUri): LspDocumentLink[];
  tokensFor(uri: LspDocumentUri): LspSemanticTokens;
  actionsFor(uri: LspDocumentUri, diagnostics: readonly LspDiagnostic[]): LspCodeAction[];
  handleMessage(message: unknown): JsonRpcResponse | null;
  dispose(): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asPosition(value: unknown): LspPosition | null {
  if (!isRecord(value)) return null;
  const { line, character } = value;
  if (typeof line !== 'number' || typeof character !== 'number') return null;
  if (!Number.isFinite(line) || !Number.isFinite(character)) return null;
  return { line, character };
}

function asRange(value: unknown): LspRange | null {
  if (!isRecord(value)) return null;
  const start = asPosition(value.start);
  const end = asPosition(value.end);
  return start === null || end === null ? null : { start, end };
}

function asUri(value: unknown): LspDocumentUri | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function errorResponse(id: string | number | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function okResponse(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

/**
 * Create the language server. All options are optional (`{}` is valid).
 *
 * @public
 */
export function createZenithLanguageServer(
  options?: ZenithLanguageServerOptions,
): ZenithLanguageServer {
  const strict = options?.strict === true;
  const stateTypes: TemplateStateTypes | undefined = options?.stateTypes;
  const maxBytes = (options?.maxFileSizeKb ?? 1024) * 1024;
  const onDiagnostics = options?.onDiagnostics;
  const onLog = options?.onLog;
  const store: ZenithDocumentStore = createDocumentStore();
  let shutDown = false;
  let disposed = false;

  const log = (message: string): void => {
    try {
      onLog?.(message);
    } catch {
      // A logging sink must never break the server.
    }
  };

  const isTooLarge = (text: string): boolean => text.length > maxBytes;

  const pushDiagnostics = (uri: LspDocumentUri, version?: number): void => {
    if (onDiagnostics === undefined) return;
    const document = store.get(uri);
    const diagnostics =
      document === undefined || isTooLarge(document.text)
        ? []
        : computeDiagnostics(document.text, uri, { strict, ...(stateTypes === undefined ? {} : { stateTypes }) });
    try {
      onDiagnostics({ uri, version, diagnostics });
    } catch (error) {
      log(`onDiagnostics failed for ${uri}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const readableText = (uri: LspDocumentUri): string | null => {
    const document = store.get(uri);
    if (document === undefined || isTooLarge(document.text)) return null;
    return document.text;
  };

  const server: ZenithLanguageServer = {
    openDocument(document) {
      store.open(document);
      pushDiagnostics(document.uri, document.version);
    },
    changeDocument(uri, changes, version) {
      const current = store.get(uri);
      if (current === undefined) return false;
      let text = current.text;
      for (const change of changes) {
        if (change.range === undefined) {
          text = change.text;
        } else {
          const start = lspOffsetAt(text, change.range.start);
          const end = lspOffsetAt(text, change.range.end);
          text = text.slice(0, start) + change.text + text.slice(Math.max(start, end));
        }
      }
      const applied = store.change(uri, text, version);
      if (applied) pushDiagnostics(uri, version);
      return applied;
    },
    closeDocument(uri) {
      if (store.close(uri) && onDiagnostics !== undefined) {
        try {
          onDiagnostics({ uri, diagnostics: [] });
        } catch (error) {
          log(`onDiagnostics failed for ${uri}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    },
    diagnosticsFor(uri) {
      const text = readableText(uri);
      return text === null
        ? []
        : computeDiagnostics(text, uri, { strict, ...(stateTypes === undefined ? {} : { stateTypes }) });
    },
    completionFor(uri, position) {
      const text = readableText(uri);
      return text === null ? [] : completeAtOffset(text, lspOffsetAt(text, position));
    },
    hoverFor(uri, position) {
      const text = readableText(uri);
      return text === null ? null : hoverAtOffset(text, lspOffsetAt(text, position));
    },
    definitionFor(uri, position) {
      const text = readableText(uri);
      if (text === null) return null;
      const name = signalNameAt(text, lspOffsetAt(text, position));
      return name === null ? null : findSignalDefinition(text, uri, name);
    },
    referencesFor(uri, position, includeDeclaration = true) {
      const text = readableText(uri);
      if (text === null) return [];
      const name = signalNameAt(text, lspOffsetAt(text, position));
      if (name === null) return [];
      const references = findSignalReferences(text, uri, name);
      return includeDeclaration ? references : references.slice(1);
    },
    renameFor(uri, position, newName) {
      const text = readableText(uri);
      if (text === null) return { error: `Unknown text document "${uri}".` };
      const name = signalNameAt(text, lspOffsetAt(text, position));
      if (name === null) return { error: 'No signal reference at this position.' };
      const outcome = renameSignal(text, name, newName);
      if (!outcome.ok) return { error: outcome.error };
      return { changes: { [uri]: outcome.edits } };
    },
    formatFor(uri, options) {
      void options;
      const text = readableText(uri);
      return text === null ? [] : formatDocument(text);
    },
    symbolsFor(uri) {
      const text = readableText(uri);
      return text === null ? [] : documentSymbols(text);
    },
    foldingFor(uri) {
      const text = readableText(uri);
      return text === null ? [] : foldingRanges(text);
    },
    linksFor(uri) {
      const text = readableText(uri);
      return text === null ? [] : documentLinks(text);
    },
    tokensFor(uri) {
      const text = readableText(uri);
      return text === null ? { data: [] } : semanticTokensFor(text);
    },
    actionsFor(uri, diagnostics) {
      const text = readableText(uri);
      return text === null ? [] : codeActionsFor(text, uri, diagnostics);
    },
    handleMessage(message) {
      if (!isRecord(message)) {
        return errorResponse(null, LSP_ERROR_CODES.InvalidRequest, 'Message must be an object.');
      }
      const method = typeof message.method === 'string' ? message.method : null;
      if (method === null) {
        return errorResponse(null, LSP_ERROR_CODES.InvalidRequest, 'Message must carry a method string.');
      }
      const request: JsonRpcRequest = { jsonrpc: '2.0', id: undefined, method, params: message.params };
      const rawId = message.id;
      if (typeof rawId === 'string' || typeof rawId === 'number' || rawId === null) request.id = rawId;
      const id = typeof request.id === 'string' || typeof request.id === 'number' ? request.id : null;
      const isNotification = request.id === undefined;
      if (disposed && !isNotification) {
        return errorResponse(id, LSP_ERROR_CODES.InvalidRequest, 'Server is disposed.');
      }
      if (shutDown && request.method !== LSP_METHODS.ExitNotification) {
        return isNotification
          ? null
          : errorResponse(id, LSP_ERROR_CODES.InvalidRequest, 'Server is shut down.');
      }
      try {
        switch (request.method) {
          case LSP_METHODS.InitializeRequest: {
            const result: LspInitializeResult = {
              capabilities: {
                textDocumentSync: 1,
                completionProvider: { triggerCharacters: ['-', ':', '$'] },
                hoverProvider: true,
                definitionProvider: true,
                referencesProvider: true,
                renameProvider: true,
                documentFormattingProvider: true,
                foldingRangeProvider: true,
                documentLinkProvider: {},
                semanticTokensProvider: { legend: LSP_SEMANTIC_TOKENS_LEGEND, full: true },
                codeActionProvider: { codeActionKinds: ['quickfix'] },
              },
              serverInfo: { name: 'zenith-language-server' },
            };
            return isNotification ? null : okResponse(id, result);
          }
          case LSP_METHODS.InitializedNotification:
            return null;
          case LSP_METHODS.ShutdownRequest:
            shutDown = true;
            return isNotification ? null : okResponse(id, null);
          case LSP_METHODS.ExitNotification:
            server.dispose();
            return null;
          case LSP_METHODS.DidOpenTextDocumentNotification: {
            const params = isRecord(request.params) ? request.params.textDocument : undefined;
            const item = isRecord(params)
              ? {
                  uri: asUri(params.uri),
                  text: typeof params.text === 'string' ? params.text : null,
                  version: typeof params.version === 'number' ? params.version : 0,
                  languageId: typeof params.languageId === 'string' ? params.languageId : undefined,
                }
              : null;
            if (item === null || item.uri === null || item.text === null) {
              if (!isNotification) return errorResponse(id, LSP_ERROR_CODES.InvalidParams, 'didOpen needs textDocument { uri, text, version }.');
              return null;
            }
            server.openDocument({ uri: item.uri, text: item.text, version: item.version, languageId: item.languageId });
            return null;
          }
          case LSP_METHODS.DidChangeTextDocumentNotification: {
            const params = isRecord(request.params) ? request.params : null;
            const textDocument = params !== null && isRecord(params.textDocument) ? params.textDocument : null;
            const document =
              textDocument === null
                ? null
                : {
                    uri: asUri(textDocument.uri),
                    version: textDocument.version,
                  };
            const rawChanges = params !== null && Array.isArray(params.contentChanges) ? params.contentChanges : null;
            if (document === null || document.uri === null || rawChanges === null) {
              if (!isNotification) return errorResponse(id, LSP_ERROR_CODES.InvalidParams, 'didChange needs textDocument { uri, version } and contentChanges.');
              return null;
            }
            const changes: ZenithTextDocumentChange[] = [];
            for (const raw of rawChanges) {
              if (!isRecord(raw) || typeof raw.text !== 'string') {
                if (!isNotification) return errorResponse(id, LSP_ERROR_CODES.InvalidParams, 'Each content change needs a text string.');
                return null;
              }
              const range = raw.range === undefined ? undefined : asRange(raw.range);
              if (raw.range !== undefined && range === null) {
                if (!isNotification) return errorResponse(id, LSP_ERROR_CODES.InvalidParams, 'Invalid change range.');
                return null;
              }
              changes.push(range === undefined ? { text: raw.text } : { text: raw.text, range });
            }
            server.changeDocument(
              document.uri,
              changes,
              typeof document.version === 'number' ? document.version : 0,
            );
            return null;
          }
          case LSP_METHODS.DidCloseTextDocumentNotification: {
            const params = isRecord(request.params) ? request.params.textDocument : undefined;
            const uri = isRecord(params) ? asUri(params.uri) : null;
            if (uri === null) {
              if (!isNotification) return errorResponse(id, LSP_ERROR_CODES.InvalidParams, 'didClose needs textDocument { uri }.');
              return null;
            }
            server.closeDocument(uri);
            return null;
          }
          case LSP_METHODS.CompletionRequest: {
            const position = readPositionParams(request.params);
            if (position === null) return errorResponse(id, LSP_ERROR_CODES.InvalidParams, 'completion needs textDocument { uri } and position.');
            return okResponse(id, server.completionFor(position.uri, position.position));
          }
          case LSP_METHODS.HoverRequest: {
            const position = readPositionParams(request.params);
            if (position === null) return errorResponse(id, LSP_ERROR_CODES.InvalidParams, 'hover needs textDocument { uri } and position.');
            return okResponse(id, server.hoverFor(position.uri, position.position));
          }
          case LSP_METHODS.DefinitionRequest: {
            const position = readPositionParams(request.params);
            if (position === null) return errorResponse(id, LSP_ERROR_CODES.InvalidParams, 'definition needs textDocument { uri } and position.');
            return okResponse(id, server.definitionFor(position.uri, position.position));
          }
          case LSP_METHODS.ReferencesRequest: {
            const position = readPositionParams(request.params);
            if (position === null) return errorResponse(id, LSP_ERROR_CODES.InvalidParams, 'references needs textDocument { uri } and position.');
            const includeDeclaration =
              isRecord(request.params) && isRecord(request.params.context)
                ? (request.params.context as Record<string, unknown>).includeDeclaration !== false
                : true;
            return okResponse(id, server.referencesFor(position.uri, position.position, includeDeclaration));
          }
          case LSP_METHODS.RenameRequest: {
            const position = readPositionParams(request.params);
            const newName =
              isRecord(request.params) && typeof request.params.newName === 'string'
                ? request.params.newName
                : null;
            if (position === null || newName === null) return errorResponse(id, LSP_ERROR_CODES.InvalidParams, 'rename needs textDocument { uri }, position and newName.');
            const outcome = server.renameFor(position.uri, position.position, newName);
            if ('error' in outcome) return errorResponse(id, LSP_ERROR_CODES.InvalidParams, outcome.error);
            return okResponse(id, outcome);
          }
          case LSP_METHODS.FormattingRequest: {
            const params = readDocumentParams(request.params);
            if (params === null) return errorResponse(id, LSP_ERROR_CODES.InvalidParams, 'formatting needs textDocument { uri }.');
            return okResponse(id, server.formatFor(params.uri, undefined));
          }
          case LSP_METHODS.FoldingRangeRequest: {
            const params = readDocumentParams(request.params);
            if (params === null) return errorResponse(id, LSP_ERROR_CODES.InvalidParams, 'foldingRange needs textDocument { uri }.');
            return okResponse(id, server.foldingFor(params.uri));
          }
          case LSP_METHODS.DocumentLinkRequest: {
            const params = readDocumentParams(request.params);
            if (params === null) return errorResponse(id, LSP_ERROR_CODES.InvalidParams, 'documentLink needs textDocument { uri }.');
            return okResponse(id, server.linksFor(params.uri));
          }
          case LSP_METHODS.SemanticTokensRequest: {
            const params = readDocumentParams(request.params);
            if (params === null) return errorResponse(id, LSP_ERROR_CODES.InvalidParams, 'semanticTokens/full needs textDocument { uri }.');
            return okResponse(id, server.tokensFor(params.uri));
          }
          case LSP_METHODS.CodeActionRequest: {
            const params = isRecord(request.params) ? request.params : null;
            const context = params !== null && isRecord(params.context) ? params.context : null;
            const document = readDocumentParams(request.params);
            const rawDiagnostics =
              context !== null && Array.isArray(context.diagnostics)
                ? (context.diagnostics as LspDiagnostic[])
                : null;
            if (document === null) return errorResponse(id, LSP_ERROR_CODES.InvalidParams, 'codeAction needs textDocument { uri } and context { diagnostics }.');
            const diagnostics = rawDiagnostics ?? server.diagnosticsFor(document.uri);
            return okResponse(id, server.actionsFor(document.uri, diagnostics));
          }
          default:
            return isNotification
              ? null
              : errorResponse(id, LSP_ERROR_CODES.MethodNotFound, `Unknown method "${request.method}".`);
        }
      } catch (error) {
        log(`handler failed for ${request.method}: ${error instanceof Error ? error.message : String(error)}`);
        return isNotification
          ? null
          : errorResponse(id, LSP_ERROR_CODES.InternalError, 'Internal server error.');
      }
    },
    dispose() {
      disposed = true;
      for (const uri of store.uris()) store.close(uri);
    },
  };
  return server;
}

function readDocumentParams(params: unknown): { uri: LspDocumentUri } | null {
  if (!isRecord(params)) return null;
  const document = isRecord(params.textDocument) ? params.textDocument : null;
  if (document === null) return null;
  const uri = asUri(document.uri);
  return uri === null ? null : { uri };
}

function readPositionParams(params: unknown): { uri: LspDocumentUri; position: LspPosition } | null {
  const document = readDocumentParams(params);
  if (document === null) return null;
  if (!isRecord(params)) return null;
  const position = asPosition(params.position);
  return position === null ? null : { uri: document.uri, position };
}
