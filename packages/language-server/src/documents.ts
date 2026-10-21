/**
 * @zenith/language-server — versioned document store + offset math (#160).
 *
 * The store is a plain factory (no module-level `let`, per the `no-module-state`
 * lint contract); offset helpers are total functions (clamped, never throwing)
 * so every handler above them stays crash-free.
 */
import type { LspDocumentUri, LspPosition } from './types.js';

/** An open document snapshot. @public */
export interface ZenithTextDocument {
  uri: LspDocumentUri;
  languageId: string;
  version: number;
  text: string;
}

/** Versioned in-memory document store. @public */
export interface ZenithDocumentStore {
  open(document: {
    uri: LspDocumentUri;
    text: string;
    version: number;
    languageId?: string;
  }): void;
  change(uri: LspDocumentUri, text: string, version: number): boolean;
  close(uri: LspDocumentUri): boolean;
  get(uri: LspDocumentUri): ZenithTextDocument | undefined;
  uris(): LspDocumentUri[];
}

/**
 * Create an empty versioned document store.
 *
 * Stale `change` notifications (older version than stored) are ignored and
 * report `false`; the stored text is left untouched.
 *
 * @public
 */
export function createDocumentStore(): ZenithDocumentStore {
  const documents = new Map<LspDocumentUri, ZenithTextDocument>();
  return {
    open(document) {
      documents.set(document.uri, {
        uri: document.uri,
        languageId: document.languageId ?? 'zenith-template',
        version: document.version,
        text: document.text,
      });
    },
    change(uri, text, version) {
      const current = documents.get(uri);
      if (current === undefined) return false;
      if (version < current.version) return false;
      documents.set(uri, { ...current, text, version });
      return true;
    },
    close(uri) {
      return documents.delete(uri);
    },
    get(uri) {
      return documents.get(uri);
    },
    uris() {
      return [...documents.keys()];
    },
  };
}

/**
 * Convert a UTF-16 offset to an LSP position (clamped into the text).
 *
 * @public
 */
export function lspPositionAt(text: string, offset: number): LspPosition {
  const safe = Math.max(0, Math.min(offset, text.length));
  const prefix = text.slice(0, safe);
  const line = (prefix.match(/\n/g) ?? []).length;
  const lastNewline = prefix.lastIndexOf('\n');
  return { line, character: safe - (lastNewline === -1 ? 0 : lastNewline + 1) };
}

/**
 * Convert an LSP position to a UTF-16 offset (clamped into the text).
 *
 * A `\r\n` line ending counts as one break; the column is clamped to the
 * visible line length (the `\r` itself is not addressable).
 *
 * @public
 */
export function lspOffsetAt(text: string, position: LspPosition): number {
  const line = Math.max(0, Math.floor(position.line));
  const character = Math.max(0, Math.floor(position.character));
  let offset = 0;
  for (let current = 0; current < line; current++) {
    const newline = text.indexOf('\n', offset);
    if (newline === -1) return text.length;
    offset = newline + 1;
  }
  const lineEnd = text.indexOf('\n', offset);
  const end = lineEnd === -1 ? text.length : lineEnd;
  const visibleEnd = end > offset && text[end - 1] === '\r' ? end - 1 : end;
  return offset + Math.min(character, Math.max(0, visibleEnd - offset));
}
