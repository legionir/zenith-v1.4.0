/**
 * @zenith/language-server (Tooling)
 *
 * #160: هستهٔ Language Server Protocol برای فریم‌ورک Zenith.
 * این پکیج مستقل از vscode است و تحلیل‌های دایرکتیو/سیگنال را ارائه می‌دهد.
 */

export interface ZenithGrepMatch {
  line: number;
  character: number;
  length: number;
  name: string;
}

export interface ZenithDocumentAnalysis {
  directives: ZenithGrepMatch[];
  signals: ZenithGrepMatch[];
}

function countLinesUpTo(text: string, index: number): { line: number; character: number } {
  const prefix = text.slice(0, index);
  const line = (prefix.match(/\n/g) ?? []).length;
  const lastNewline = prefix.lastIndexOf('\n');
  const character = index - (lastNewline === -1 ? 0 : lastNewline + 1);
  return { line, character };
}

/**
 * #160: تحلیل متن سند و استخراج دایرکتیوها (`zen-*`) و سیگنال‌ها (`$name`).
 */
export function analyzeZenithDocument(text: string): ZenithDocumentAnalysis {
  const directives: ZenithGrepMatch[] = [];
  const signals: ZenithGrepMatch[] = [];

  const directiveRe = /\b(zen-[a-z][a-z0-9-]*)\b/g;
  let m: RegExpExecArray | null;
  while ((m = directiveRe.exec(text)) !== null) {
    const pos = countLinesUpTo(text, m.index);
    directives.push({ ...pos, length: m[0].length, name: m[1]! });
  }

  const signalRe = /\$([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
  while ((m = signalRe.exec(text)) !== null) {
    // skip jQuery-like `$(` or template `${`
    const prev = text[m.index - 1];
    if (prev === '(' || prev === '{') continue;
    const pos = countLinesUpTo(text, m.index);
    signals.push({ ...pos, length: m[0].length, name: m[1]! });
  }

  return { directives, signals };
}

/**
 * #160: پیام‌های مینیمال LSP برای اتصال کلاینت نازک vscode-extension.
 */
export const LSP_METHODS = /* @__PURE__ */ Object.freeze({
  InitializeRequest: 'initialize',
  InitializedNotification: 'initialized',
  ShutdownRequest: 'shutdown',
  ExitNotification: 'exit',
  DidOpenTextDocumentNotification: 'textDocument/didOpen',
  DidChangeTextDocumentNotification: 'textDocument/didChange',
  PublishDiagnosticsNotification: 'textDocument/publishDiagnostics',
});

export interface ZenithLanguageServerCore {
  type: 'in-memory' | 'stdio';
  documents: Map<string, string>;
  getAnalysis(uri: string): ZenithDocumentAnalysis | null;
  setDocument(uri: string, text: string): void;
  removeDocument(uri: string): void;
}

/**
 * #160: ساخت هستهٔ سرور زبان Zenith در حافظه (برای تست و کلاینت‌های نازک).
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
