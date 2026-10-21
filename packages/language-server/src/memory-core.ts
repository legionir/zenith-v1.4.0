/**
 * @zenith/language-server — the original in-memory core (#160).
 *
 * Kept byte-compatible for the thin `vscode-extension` client and its tests:
 * a string document map with grep analysis plus the minimal
 * initialize/shutdown lifecycle. New integrations should use
 * `createZenithLanguageServer` (`server.ts`), which speaks full LSP 3.17.
 */
import { analyzeZenithDocument, type ZenithDocumentAnalysis } from './analysis.js';
import { LSP_METHODS } from './types.js';

/** In-memory/stdio server core shape. @public */
export interface ZenithLanguageServerCore {
  type: 'in-memory' | 'stdio';
  documents: Map<string, string>;
  getAnalysis(uri: string): ZenithDocumentAnalysis | null;
  setDocument(uri: string, text: string): void;
  removeDocument(uri: string): void;
}

/**
 * #160: ساخت هستهٔ سرور زبان Zenith در حافظه (برای تست و کلاینت‌های نازک).
 * @public
 */
export function createZenithServerCore(): ZenithLanguageServerCore {
  const documents = new Map<string, string>();
  return {
    type: 'in-memory',
    documents,
    getAnalysis(uri: string) {
      const text = documents.get(uri);
      return text === undefined ? null : analyzeZenithDocument(text);
    },
    setDocument(uri: string, text: string) {
      documents.set(uri, text);
    },
    removeDocument(uri: string) {
      documents.delete(uri);
    },
  };
}

/** Minimal LSP connection lifecycle (initialize/shutdown). @public */
export function createServerLifecycle() {
  let initialized = false;
  return {
    handleMessage(method: string): { ok: boolean; shutdown: boolean } {
      switch (method) {
        case LSP_METHODS.InitializeRequest:
          initialized = true;
          return { ok: true, shutdown: false };
        case LSP_METHODS.ShutdownRequest:
          return { ok: true, shutdown: true };
        default:
          return { ok: initialized, shutdown: false };
      }
    },
  };
}
