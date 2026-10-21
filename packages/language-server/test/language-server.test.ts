// #160 — contract tests for the real LSP server: analysis compat, known-set
// freshness (compiler + seed registry), diagnostics, completion, hover,
// references/rename, symbols/folding/links/tokens, formatting, code actions,
// server dispatch, stdio framing, and a deterministic fuzz.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import {
  analyzeZenithDocument,
  attachStdioTransport,
  closestDirectiveName,
  codeActionsFor,
  completeAt,
  completeDirectives,
  completeSignals,
  computeDiagnostics,
  createDocumentStore,
  createLspMessageBuffer,
  createZenithLanguageServer,
  decodeLspMessages,
  decodeSemanticTokens,
  describeDirective,
  directiveKindOf,
  documentLinks,
  documentSymbols,
  encodeLspMessage,
  findSignalReferencesInDocuments,
  foldingRanges,
  formatDocument,
  hoverAt,
  isKnownDirective,
  KNOWN_DIRECTIVES,
  lspOffsetAt,
  lspPositionAt,
  renameSignal,
  scanZenithAttributes,
  semanticTokensFor,
} from '../src/index';
import { COMPILABLE_DIRECTIVES, CORE_DIRECTIVES, RUNTIME_DIRECTIVES } from '@zenith/compiler';
import type { JsonRpcResponse, LspDiagnostic, LspPosition } from '../src/index';

const here = dirname(fileURLToPath(import.meta.url));
const seedPath = join(here, '..', '..', '..', 'docs', 'meta', 'zenith.meta.seed.json');

function position(line: number, character: number): LspPosition {
  return { line, character };
}

function applyEdits(text: string, edits: Array<{ range: { start: LspPosition; end: LspPosition }; newText: string }>): string {
  const withOffsets = edits.map((edit) => ({
    start: lspOffsetAt(text, edit.range.start),
    end: lspOffsetAt(text, edit.range.end),
    newText: edit.newText,
  }));
  withOffsets.sort((a, b) => b.start - a.start);
  let next = text;
  for (const edit of withOffsets) next = next.slice(0, edit.start) + edit.newText + next.slice(edit.end);
  return next;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

describe('@zenith/language-server analysis (#160)', () => {
  it('keeps analyzeZenithDocument byte-compatible (wave5 contract)', () => {
    const text = '<div zen-text="$msg">\n  <input zen-model="$name">\n  <span zen-if="$ok">Yes</span>\n</div>';
    const { directives, signals } = analyzeZenithDocument(text);
    expect(directives.map((d) => d.name)).toEqual(['zen-text', 'zen-model', 'zen-if']);
    expect(signals.map((s) => s.name)).toEqual(['msg', 'name', 'ok']);
    expect(directives[0]!.line).toBe(0);
    expect(signals[1]!.line).toBe(1);
  });

  it('scans parametric, boolean, quoted and unquoted attributes with spans', () => {
    const text = '<a zen-bind:href="item.url" zen-cloak data-x="1" zen-text=$title>link</a>';
    const attrs = scanZenithAttributes(text);
    expect(attrs.map((a) => a.raw)).toEqual(['zen-bind:href', 'zen-cloak', 'zen-text']);
    expect(attrs[0]).toMatchObject({ base: 'zen-bind', value: 'item.url' });
    expect(attrs[1]).toMatchObject({ base: 'zen-cloak', value: null, valueStart: null });
    expect(attrs[2]).toMatchObject({ base: 'zen-text', value: '$title' });
    expect(text.slice(attrs[0]!.nameStart, attrs[0]!.nameEnd)).toBe('zen-bind:href');
    expect(text.slice(attrs[0]!.valueStart ?? 0, attrs[0]!.valueEnd ?? 0)).toBe('item.url');
  });

  it('reads an unterminated quote as a boolean attribute instead of swallowing the document', () => {
    const attrs = scanZenithAttributes('<div zen-if="open>\n<span zen-text="x">');
    expect(attrs).toHaveLength(2);
    expect(attrs[0]).toMatchObject({ raw: 'zen-if', value: null });
    expect(attrs[1]).toMatchObject({ raw: 'zen-text', value: 'x' });
  });

  it('knows every compiler directive base (freshness)', () => {
    for (const name of [...COMPILABLE_DIRECTIVES, ...RUNTIME_DIRECTIVES, ...(CORE_DIRECTIVES as readonly string[])]) {
      expect(KNOWN_DIRECTIVES.has(name), name).toBe(true);
    }
  });

  it('knows every seed-registry directive (single source of truth)', () => {
    const seed = JSON.parse(readFileSync(seedPath, 'utf8')) as { directives: Array<{ name: string }> };
    expect(seed.directives.length).toBeGreaterThan(40);
    for (const entry of seed.directives) {
      expect(isKnownDirective(entry.name), entry.name).toBe(true);
      expect(describeDirective(entry.name)).not.toBeNull();
    }
  });

  it('classifies kinds from the compiler sets', () => {
    expect(directiveKindOf('zen-if')).toBe('compilable');
    expect(directiveKindOf('zen-fetch')).toBe('runtime');
    expect(directiveKindOf('zen-on')).toBe('core');
    expect(directiveKindOf('zen-t')).toBe('registered');
  });

  it('suggests the closest name for typos and nothing for noise', () => {
    expect(closestDirectiveName('zen-tex')).toBe('zen-text');
    expect(closestDirectiveName('zen-zzz-qqq')).toBeNull();
  });
});

describe('@zenith/language-server diagnostics (#160)', () => {
  it('flags unknown directives with ZEN-501 and a suggestion', () => {
    const text = '<div zen-tex="a" zen-zzz-qqq="b" zen-if="c">';
    const diagnostics = computeDiagnostics(text, 'file:///a.html');
    expect(diagnostics.map((d) => d.code)).toEqual(['ZEN-501', 'ZEN-501']);
    expect(diagnostics[0]!.severity).toBe(2);
    expect(diagnostics[0]!.message).toContain('zen-tex');
    expect(diagnostics[0]!.message).toContain('zen-text');
    expect(text.slice(lspOffsetAt(text, diagnostics[0]!.range.start), lspOffsetAt(text, diagnostics[0]!.range.end))).toBe('zen-tex');
  });

  it('escalates to errors in strict mode', () => {
    const diagnostics = computeDiagnostics('<div zen-nope="1">', undefined, { strict: true });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.severity).toBe(1);
  });

  it('accepts known parametric forms without diagnostics', () => {
    const text = '<a zen-bind:href="u">x</a><button zen-on:click="go()">y</button><button zen-action:click.prevent="save">z</button>';
    expect(computeDiagnostics(text)).toEqual([]);
  });

  it('flags deprecated identifiers with their catalog code and skips quoted text', () => {
    const text = '<div zen-text="clearCache()"><span zen-text="\'clearCache\'">$registerStore</span></div>';
    const diagnostics = computeDiagnostics(text);
    const codes = diagnostics.map((d) => d.code);
    expect(codes).toContain('ZEN-DEPR-005');
    expect(codes).not.toContain('ZEN-501');
    const deprecated = diagnostics.find((d) => d.code === 'ZEN-DEPR-005')!;
    expect(deprecated.tags).toEqual([2]);
    expect(deprecated.message).toContain('clearHttpCache');
    // The quoted 'clearCache' and the $-prefixed signal are not flagged.
    expect(diagnostics.filter((d) => d.code === 'ZEN-DEPR-005')).toHaveLength(1);
  });
});

describe('@zenith/language-server template typecheck opt-in (#111)', () => {
  const schema = { title: 'string', items: 'array', submitForm: 'function' };

  it('stays silent without stateTypes (legacy)', () => {
    expect(computeDiagnostics('<div zen-text="$bogus"></div>')).toEqual([]);
  });

  it('surfaces shared-engine ZEN-502 findings with exact ranges', () => {
    const text = '<div>\n  <span zen-text="$titel"></span>\n</div>';
    const diagnostics = computeDiagnostics(text, 'file:///a.html', { stateTypes: schema });
    expect(diagnostics).toHaveLength(1);
    const [finding] = diagnostics;
    expect(finding!.code).toBe('ZEN-502');
    expect(finding!.severity).toBe(1);
    expect(finding!.source).toBe('zenith');
    expect(finding!.range.start).toEqual({ line: 1, character: 18 });
    expect(
      text.slice(lspOffsetAt(text, finding!.range.start), lspOffsetAt(text, finding!.range.end)),
    ).toBe('$titel');
    expect(finding!.message).toContain('compile-time unknown');
    expect(finding!.message).toContain(`Did you mean '$title'?`);
    expect(finding!.data).toMatchObject({ kind: 'unknown-identifier', from: '$titel', code: 'ZEN-502' });
  });

  it('shares findings with the compiler and keeps for-scope locals quiet', () => {
    const text = '<ul><li zen-for="item in $items"><b zen-text="item"></b></li></ul>';
    expect(computeDiagnostics(text, undefined, { stateTypes: schema })).toEqual([]);
    const bad = computeDiagnostics('<div zen-text="$nope"></div>', undefined, { stateTypes: schema });
    expect(bad.map((d) => d.code)).toEqual(['ZEN-502']);
  });

  it('threads stateTypes through the server', () => {
    const server = createZenithLanguageServer({ stateTypes: schema });
    server.openDocument({ uri: 'file:///a.html', text: '<div zen-text="$bogus"></div>', version: 1 });
    const diagnostics = server.diagnosticsFor('file:///a.html');
    expect(diagnostics.map((d) => d.code)).toEqual(['ZEN-502']);
    server.dispose();
    const legacy = createZenithLanguageServer();
    legacy.openDocument({ uri: 'file:///a.html', text: '<div zen-text="$bogus"></div>', version: 1 });
    expect(legacy.diagnosticsFor('file:///a.html')).toEqual([]);
    legacy.dispose();
  });
});

describe('@zenith/language-server completion and hover (#160)', () => {
  it('completes directives by prefix, sorted', () => {
    const items = completeDirectives('zen-t');
    const labels = items.map((i) => i.label);
    expect(labels).toContain('zen-text');
    expect(labels).toContain('zen-t');
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
    expect(items[0]).toMatchObject({ kind: 10 });
  });

  it('completes signals visible in the document', () => {
    const items = completeSignals('<div zen-text="$user">$user $account</div>', 'us');
    expect(items.map((i) => i.label)).toEqual(['$user']);
  });

  it('routes completion by cursor context', () => {
    const inName = '<div zen-t';
    expect(completeAt(inName, inName.length).map((i) => i.label)).toContain('zen-text');
    const inValue = '<div zen-text="$user $us">';
    expect(completeAt(inValue, inValue.length - 2).map((i) => i.label)).toEqual(['$user']);
    const valueText = '<div zen-text="$user">$us';
    expect(completeAt(valueText, valueText.length).map((i) => i.label)).toEqual(['$user']);
    expect(completeAt('<div class="x">', 5)).toEqual([]);
    const afterColon = '<div zen-bind:h';
    expect(completeAt(afterColon, afterColon.length)).toEqual([]);
  });

  it('hovers directives with kind, prose and syntax', () => {
    const text = '<div zen-if="open">x</div>';
    const hover = hoverAt(text, 6);
    expect(hover).not.toBeNull();
    expect(hover!.contents.value).toContain('zen-if');
    expect(hover!.contents.value).toContain('compilable');
    expect(hover!.range).toBeDefined();
    expect(hoverAt(text, 0)).toBeNull();
  });

  it('hovers signals with reference counts and stays silent on unknown names', () => {
    const text = '<div zen-text="$user">$user</div>';
    const hover = hoverAt(text, 16);
    expect(hover!.contents.value).toContain('$user');
    expect(hover!.contents.value).toContain('2 references');
    expect(hoverAt('<div zen-tex="a">', 7)).toBeNull();
  });
});

describe('@zenith/language-server references and rename (#160)', () => {
  const text = '<div zen-text="$user">hi $user, meet $other</div>';

  it('defines a signal at its first occurrence and lists every reference', () => {
    const definition = findSignalReferencesInDocuments(
      [{ uri: 'file:///a.html', text }],
      'user',
    );
    expect(definition).toHaveLength(2);
    expect(definition[0]).toMatchObject({ uri: 'file:///a.html' });
  });

  it('renames only the $-prefixed occurrences and validates the new name', () => {
    const outcome = renameSignal(text, 'user', 'account');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(applyEdits(text, outcome.edits)).toBe('<div zen-text="$account">hi $account, meet $other</div>');
    }
    expect(renameSignal(text, 'user', 'not a name')).toEqual({ ok: false, error: "'not a name' is not a valid signal name." });
    expect(renameSignal(text, 'user', 'user')).toEqual({ ok: true, edits: [] });
  });
});

describe('@zenith/language-server structure features (#160)', () => {
  const doc = '<ul zen-for="item in items" zen-key="item.id">\n  <li zen-text="item.name">$label</li>\n  <input zen-model="form.q">\n</ul>\n<a zen-link="/users">Users</a>';

  it('builds nested symbols including void elements', () => {
    const symbols = documentSymbols(doc);
    expect(symbols.map((s) => s.name)).toEqual(['ul[zen-for]', 'a[zen-link]']);
    expect(symbols[0]!.children!.map((s) => s.name)).toEqual(['li[zen-text]', 'input[zen-model]']);
  });

  it('folds multi-line elements only', () => {
    const ranges = foldingRanges(doc);
    expect(ranges.map((r) => [r.startLine, r.endLine])).toContainEqual([0, 3]);
    expect(foldingRanges('<div>x</div>')).toEqual([]);
  });

  it('links literal zen-link targets and skips expressions', () => {
    const links = documentLinks(doc + '\n<a zen-link="$path">x</a>');
    expect(links.map((l) => l.target)).toEqual(['/users']);
    const link = links[0]!;
    expect(doc.slice(lspOffsetAt(doc, link.range.start), lspOffsetAt(doc, link.range.end))).toBe('/users');
  });

  it('round-trips semantic tokens', () => {
    const tokens = semanticTokensFor(doc);
    const decoded = decodeSemanticTokens(tokens.data);
    expect(decoded.length).toBeGreaterThan(4);
    expect(decoded.every((t) => t.tokenType === 0 || t.tokenType === 1)).toBe(true);
    expect(decodeSemanticTokens(semanticTokensFor(doc).data)).toEqual(decoded);
  });
});

describe('@zenith/language-server formatting and actions (#160)', () => {
  it('trims trailing whitespace, fixes the final newline, and is idempotent', () => {
    const dirty = '<div>   \n<span>x</span>';
    const edits = formatDocument(dirty);
    expect(edits).toHaveLength(1);
    const clean = applyEdits(dirty, edits);
    expect(clean).toBe('<div>\n<span>x</span>\n');
    expect(formatDocument(clean)).toEqual([]);
    expect(formatDocument('')).toEqual([]);
  });

  it('offers replace/remove for unknown directives and applying them clears the diagnostic', () => {
    const uri = 'file:///a.html';
    const text = '<div zen-tex="a">x</div>';
    const diagnostics = computeDiagnostics(text, uri);
    const actions = codeActionsFor(text, uri, diagnostics);
    expect(actions.map((a) => a.title)).toEqual(["Replace with 'zen-text'", "Remove 'zen-tex' attribute"]);
    const fixed = applyEdits(text, actions[0]!.edit.changes[uri]!);
    expect(computeDiagnostics(fixed, uri)).toEqual([]);
    const removed = applyEdits(text, actions[1]!.edit.changes[uri]!);
    expect(computeDiagnostics(removed, uri)).toEqual([]);
  });

  it('offers the catalogued replacement for deprecated identifiers', () => {
    const uri = 'file:///a.html';
    const text = '<div zen-text="clearCache()">x</div>';
    const diagnostics = computeDiagnostics(text, uri);
    const actions = codeActionsFor(text, uri, diagnostics);
    expect(actions).toHaveLength(1);
    expect(actions[0]!.title).toBe("Replace 'clearCache' with 'clearHttpCache'");
    expect(applyEdits(text, actions[0]!.edit.changes[uri]!)).toBe('<div zen-text="clearHttpCache()">x</div>');
  });
});

describe('@zenith/language-server document store (#160)', () => {
  it('tracks versions and ignores stale changes', () => {
    const store = createDocumentStore();
    store.open({ uri: 'file:///a.html', text: 'one', version: 1 });
    expect(store.change('file:///a.html', 'two', 2)).toBe(true);
    expect(store.change('file:///a.html', 'stale', 1)).toBe(false);
    expect(store.get('file:///a.html')!.text).toBe('two');
    expect(store.change('file:///missing.html', 'x', 1)).toBe(false);
    expect(store.close('file:///a.html')).toBe(true);
    expect(store.get('file:///a.html')).toBeUndefined();
  });

  it('clamps offsets and positions', () => {
    expect(lspPositionAt('a\nb', 99)).toEqual({ line: 1, character: 1 });
    expect(lspOffsetAt('a\nb', position(9, 9))).toBe(3);
    expect(lspOffsetAt('a\r\nb', position(1, 9))).toBe(4);
  });
});

describe('@zenith/language-server dispatch (#160)', () => {
  const uri = 'file:///a.html';
  const text = '<div zen-tex="$user">$user</div>';

  function opened(onDiagnostics?: (params: { uri: string; diagnostics: LspDiagnostic[] }) => void) {
    const seen: Array<{ uri: string; diagnostics: LspDiagnostic[] }> = [];
    const server = createZenithLanguageServer({
      onDiagnostics: (params) => {
        seen.push(params);
        onDiagnostics?.(params);
      },
    });
    const openedResponse = server.handleMessage({
      jsonrpc: '2.0',
      method: 'textDocument/didOpen',
      params: { textDocument: { uri, text, version: 1 } },
    });
    expect(openedResponse).toBeNull();
    return { server, seen };
  }

  it('advertises capabilities on initialize and pushes diagnostics on open', () => {
    const { server, seen } = opened();
    const response = server.handleMessage({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) as JsonRpcResponse;
    const capabilities = (response.result as { capabilities: { hoverProvider: boolean } }).capabilities;
    expect(capabilities.hoverProvider).toBe(true);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.diagnostics.map((d) => d.code)).toEqual(['ZEN-501']);
    server.dispose();
  });

  it('answers feature requests and rejects the rest without throwing', () => {
    const { server } = opened();
    const hover = server.handleMessage({
      jsonrpc: '2.0',
      id: 2,
      method: 'textDocument/hover',
      params: { textDocument: { uri }, position: position(0, 16) },
    }) as JsonRpcResponse;
    expect((hover.result as { contents: { value: string } }).contents.value).toContain('$user');
    const completion = server.handleMessage({
      jsonrpc: '2.0',
      id: 3,
      method: 'textDocument/completion',
      params: { textDocument: { uri }, position: position(0, 6) },
    }) as JsonRpcResponse;
    expect((completion.result as Array<{ label: string }>).length).toBeGreaterThan(0);
    const definition = server.handleMessage({
      jsonrpc: '2.0',
      id: 4,
      method: 'textDocument/definition',
      params: { textDocument: { uri }, position: position(0, 16) },
    }) as JsonRpcResponse;
    expect(definition.result).toMatchObject({ uri });
    const rename = server.handleMessage({
      jsonrpc: '2.0',
      id: 5,
      method: 'textDocument/rename',
      params: { textDocument: { uri }, position: position(0, 16), newName: 'account' },
    }) as JsonRpcResponse;
    expect(rename.error).toBeUndefined();
    const badRename = server.handleMessage({
      jsonrpc: '2.0',
      id: 6,
      method: 'textDocument/rename',
      params: { textDocument: { uri }, position: position(0, 16), newName: 'nope!' },
    }) as JsonRpcResponse;
    expect(badRename.error!.code).toBe(-32602);
    const unknown = server.handleMessage({ jsonrpc: '2.0', id: 7, method: 'nope/nothing', params: {} }) as JsonRpcResponse;
    expect(unknown.error!.code).toBe(-32601);
    expect(server.handleMessage(42)).toMatchObject({ error: { code: -32600 } });
    expect(server.handleMessage(null)).toMatchObject({ error: { code: -32600 } });
    server.dispose();
  });

  it('applies incremental changes and honors shutdown', () => {
    const { server, seen } = opened();
    server.handleMessage({
      jsonrpc: '2.0',
      method: 'textDocument/didChange',
      params: {
        textDocument: { uri, version: 2 },
        contentChanges: [{ text: 'zen-text', range: { start: position(0, 5), end: position(0, 12) } }],
      },
    });
    expect(seen).toHaveLength(2);
    expect(seen[1]!.diagnostics).toEqual([]);
    const shutdown = server.handleMessage({ jsonrpc: '2.0', id: 8, method: 'shutdown' }) as JsonRpcResponse;
    expect(shutdown.error).toBeUndefined();
    const gated = server.handleMessage({
      jsonrpc: '2.0',
      id: 9,
      method: 'textDocument/hover',
      params: { textDocument: { uri }, position: position(0, 0) },
    }) as JsonRpcResponse;
    expect(gated.error!.code).toBe(-32600);
    expect(server.handleMessage({ jsonrpc: '2.0', method: 'exit' })).toBeNull();
    server.dispose();
  });

  it('returns empty features for oversized documents', () => {
    const server = createZenithLanguageServer({ maxFileSizeKb: 0 });
    server.openDocument({ uri, text: 'x', version: 1 });
    expect(server.diagnosticsFor(uri)).toEqual([]);
    expect(server.completionFor(uri, position(0, 0))).toEqual([]);
    expect(server.hoverFor(uri, position(0, 0))).toBeNull();
    server.dispose();
  });
});

describe('@zenith/language-server stdio framing (#160)', () => {
  it('round-trips multibyte payloads with byte counts', () => {
    const payload = { jsonrpc: '2.0', id: 1, method: 'x', params: { text: 'سلام zenith' } };
    const framed = encodeLspMessage(payload);
    expect(framed.startsWith('Content-Length: ')).toBe(true);
    const { messages, rest } = decodeLspMessages(framed);
    expect(rest).toBe('');
    expect(JSON.parse(messages[0]!)).toEqual(payload);
  });

  it('buffers partial chunks and splits stacked messages', () => {
    const buffer = createLspMessageBuffer();
    const first = encodeLspMessage({ a: 1 });
    const second = encodeLspMessage({ b: 2 });
    const cut = Math.floor(first.length / 2);
    expect(buffer.push(first.slice(0, cut))).toEqual([]);
    const done = buffer.push(first.slice(cut) + second);
    expect(done).toHaveLength(2);
    expect(JSON.parse(done[0]!)).toEqual({ a: 1 });
    expect(JSON.parse(done[1]!)).toEqual({ b: 2 });
  });

  it('serves requests over memory streams', async () => {
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const server = createZenithLanguageServer();
    const transport = attachStdioTransport(server, stdin, stdout);
    const chunks: string[] = [];
    stdout.on('data', (chunk: unknown) => {
      chunks.push(String(chunk));
    });
    stdin.write(encodeLspMessage({ jsonrpc: '2.0', method: 'textDocument/didOpen', params: { textDocument: { uri: 'file:///m.html', text: '<div zen-if="x">', version: 1 } } }));
    stdin.write(
      encodeLspMessage({ jsonrpc: '2.0', id: 1, method: 'textDocument/hover', params: { textDocument: { uri: 'file:///m.html' }, position: { line: 0, character: 6 } } }),
    );
    for (let i = 0; i < 20 && chunks.join('').length === 0; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const { messages } = decodeLspMessages(chunks.join(''));
    expect(messages).toHaveLength(1);
    const response = JSON.parse(messages[0]!) as JsonRpcResponse;
    expect(response.id).toBe(1);
    expect((response.result as { contents: { value: string } }).contents.value).toContain('zen-if');
    transport.dispose();
    server.dispose();
  });
});

describe('@zenith/language-server fuzz (#160)', () => {
  it('never throws and keeps ranges in bounds on adversarial inputs', () => {
    const random = mulberry32(160);
    const tags = ['div', 'span', 'input', 'a', 'button', 'ul'];
    const attrs = ['zen-if', 'zen-tex', 'zen-foo', 'zen-bind:href', 'zen-on:click', 'zen-text', 'zen-model', 'class', 'zen-zzz'];
    const values = ['$a', 'clearCache()', "'quoted'", '', 'a"b', '$registerStore'];
    const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)]!;
    for (let i = 0; i < 300; i++) {
      let text = '';
      const parts = Math.floor(random() * 5);
      for (let p = 0; p < parts; p++) {
        const tag = pick(tags);
        const quote = random() < 0.5 ? '"' : "'";
        const attr = pick(attrs);
        const value = pick(values);
        const assigned = random() < 0.2 ? quote : quote + value + quote;
        const signalTail = pick(values).replace(/[^a-z]/g, '') || 'x';
        text += '<' + tag + ' ' + attr + '=' + assigned + '>\n$' + signalTail;
      }
      if (random() < 0.3) text += '<div zen-if="open>\n<span';
      const diagnostics = computeDiagnostics(text);
      for (const diagnostic of diagnostics) {
        expect(diagnostic.range.start.line).toBeGreaterThanOrEqual(0);
        expect(diagnostic.range.end.character).toBeGreaterThanOrEqual(diagnostic.range.start.character);
        const start = lspOffsetAt(text, diagnostic.range.start);
        const end = lspOffsetAt(text, diagnostic.range.end);
        expect(start).toBeLessThanOrEqual(end);
        expect(end).toBeLessThanOrEqual(text.length);
      }
      const offset = Math.floor(random() * (text.length + 1));
      expect(() => completeAt(text, offset)).not.toThrow();
      expect(() => hoverAt(text, offset)).not.toThrow();
      expect(() => semanticTokensFor(text)).not.toThrow();
      const formatted = applyEdits(text, formatDocument(text));
      expect(applyEdits(formatted, formatDocument(formatted))).toBe(formatted);
      const actions = codeActionsFor(text, 'file:///fuzz.html', diagnostics);
      for (const action of actions) {
        const edits = action.edit.changes['file:///fuzz.html']!;
        const fixed = applyEdits(text, edits);
        expect(computeDiagnostics(fixed).length).toBeLessThanOrEqual(diagnostics.length);
      }
    }
  });
});
