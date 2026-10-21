// Tests for the DevTools extension message schema (#67).
// The schema file is a plain classic script (it runs in SW/page contexts), so we
// load it exactly like the browser does: evaluate it in a fresh VM context and
// read `globalThis.ZenithDevtoolsSchema` — no require(), no reshaping.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const EXT_DIR = join(process.cwd(), 'tools', 'devtools-extension');
const RUNTIME_ID = 'abcdefghijklmnopabcdefghijklmnop';

// `runInThisContext` (نه یک context جدا) تا همان Object.prototype دامنهٔ تست
// دیده شود؛ در غیر این صورت هر plain object تست «cross-realm» و نامعتبر می‌شود.
const source = readFileSync(join(EXT_DIR, 'message-schema.js'), 'utf8');
const schema = vm.runInThisContext(`${source}\nglobalThis.ZenithDevtoolsSchema;`, {
  filename: 'message-schema.js',
});
delete globalThis.ZenithDevtoolsSchema;

describe('#67 devtools-extension — schema بارگذاری‌پذیر بدون require', () => {
  it('exposes its API on globalThis exactly as the browser script does', () => {
    expect(typeof schema).toBe('object');
    for (const fn of [
      'isPlainObject',
      'hasUnsafeKeys',
      'isTrustedSender',
      'validateRuntimeMessage',
      'validateNotification',
      'cleanText',
      'escapeHtml',
      'clampCount',
      'sanitizeGraphNode',
      'sanitizeGraphEdge',
      'sanitizeGraphPayload',
      'sanitizeInspectionResponse',
    ]) {
      expect(typeof schema[fn], fn).toBe('function');
    }
    expect(schema.LIMITS.stringLength).toBeGreaterThan(0);
    expect(schema.RUNTIME_MESSAGE_TYPES).toContain('ZENITH_REFRESH');
  });

  it('is loaded before every consumer page and in the service worker', () => {
    for (const page of ['popup.html', 'graph-viewer.html', 'devtools.html']) {
      const html = readFileSync(join(EXT_DIR, page), 'utf8');
      const schemaAt = html.indexOf('<script src="message-schema.js">');
      const firstScript = html.indexOf('<script');
      expect(schemaAt, `${page} loads message-schema.js`).toBeGreaterThanOrEqual(0);
      expect(schemaAt, `${page} loads schema first`).toBe(firstScript);
    }
    expect(readFileSync(join(EXT_DIR, 'background.js'), 'utf8')).toContain(
      "importScripts('message-schema.js')",
    );
    expect(readFileSync(join(EXT_DIR, 'content.js'), 'utf8')).toContain('ZenithDevtoolsSchema');
  });
});

describe('#67 devtools-extension — پیام‌های نامعتبر نادیده گرفته می‌شوند', () => {
  it('accepts only plain objects with an allow-listed type', () => {
    for (const type of schema.RUNTIME_MESSAGE_TYPES) {
      const res = schema.validateRuntimeMessage({ type });
      expect(res.ok, type).toBe(true);
    }
    const rejected = [
      undefined,
      null,
      'ZENITH_REFRESH',
      [1, 2],
      new Date(),
      { type: 'ZENITH_EXEC' },
      { type: 'zenith_refresh' },
      { type: 1 },
      {},
    ];
    for (const payload of rejected) {
      const res = schema.validateRuntimeMessage(payload);
      expect(res.ok, String(payload)).toBe(false);
      expect(typeof res.reason).toBe('string');
    }
  });

  it('rejects prototype-polluting payloads at any depth', () => {
    const shallow = JSON.parse('{"type":"ZENITH_REFRESH","__proto__":{"polluted":1}}');
    expect(schema.hasUnsafeKeys(shallow, 0)).toBe(true);
    expect(schema.validateRuntimeMessage(shallow).ok).toBe(false);
    expect(schema.hasUnsafeKeys({ a: { prototype: {} } }, 0)).toBe(true);
    expect(schema.hasUnsafeKeys({ a: { b: { constructor: 1 } } }, 0)).toBe(true);
    expect(schema.hasUnsafeKeys({ a: { b: 1 } }, 0)).toBe(false);
    expect({}.polluted).toBeUndefined();
  });

  it('trusts messages only when the sender is this very extension', () => {
    expect(schema.isTrustedSender({ id: RUNTIME_ID }, RUNTIME_ID)).toBe(true);
    expect(schema.isTrustedSender({ id: 'other' }, RUNTIME_ID)).toBe(false);
    expect(schema.isTrustedSender({}, RUNTIME_ID)).toBe(false);
    expect(schema.isTrustedSender({ id: RUNTIME_ID }, '')).toBe(false);
    expect(schema.isTrustedSender(null, RUNTIME_ID)).toBe(false);
    expect(schema.isTrustedSender({ id: RUNTIME_ID }, undefined)).toBe(false);
  });

  it('drops notifications that are oversized, empty or multi-line', () => {
    expect(schema.validateNotification({ type: 'ZENITH_NOTIFICATION', text: 'ok' })).toEqual({
      text: 'ok',
    });
    expect(schema.validateNotification({ type: 'ZENITH_NOTIFICATION', text: '' })).toBeNull();
    expect(schema.validateNotification({ type: 'ZENITH_NOTIFICATION', text: 'a\nb' })).toBeNull();
    expect(
      schema.validateNotification({ type: 'ZENITH_NOTIFICATION', text: 'x\u0000y' }),
    ).toBeNull();
    expect(
      schema.validateNotification({
        type: 'ZENITH_NOTIFICATION',
        text: 'z'.repeat(schema.LIMITS.notificationText + 1),
      }),
    ).toBeNull();
    expect(schema.validateNotification({ type: 'ZENITH_REFRESH', text: 'ok' })).toBeNull();
    expect(schema.validateNotification({ type: 'ZENITH_NOTIFICATION', text: 42 })).toBeNull();
  });
});

describe('#67 devtools-extension — پاک‌سازی متن و شمارنده‌ها', () => {
  it('clamps strings, coerces scalars and blanks out objects', () => {
    const limit = schema.LIMITS.graphStringLength;
    expect(schema.cleanText('abc')).toBe('abc');
    expect(schema.cleanText('x'.repeat(limit + 5), limit)).toHaveLength(limit + 1); // + ellipsis
    expect(schema.cleanText(7)).toBe('7');
    expect(schema.cleanText(false)).toBe('false');
    expect(schema.cleanText({ nope: 1 })).toBe('');
    expect(schema.cleanText(undefined)).toBe('');
  });

  it('escapes HTML exactly once', () => {
    const escaped = schema.escapeHtml(`<img src=x onerror="alert('1')"> & <b>`);
    expect(escaped).not.toContain('<');
    expect(escaped).toContain('&lt;img');
    expect(escaped).toContain('&amp;');
    expect(schema.escapeHtml('&amp;')).toBe('&amp;amp;'); // double-escape، چون ورودی خام است
  });

  it('clamps counts to a safe integer range', () => {
    expect(schema.clampCount(3.9, 10)).toBe(3);
    expect(schema.clampCount(-1, 10)).toBe(0);
    expect(schema.clampCount(99, 10)).toBe(10);
    expect(schema.clampCount('7', 10)).toBe(0);
    expect(schema.clampCount(NaN, 10)).toBe(0);
    expect(schema.clampCount(Infinity, 10)).toBe(0);
  });
});

describe('#67 devtools-extension — اعتبارسنجی payload گراف', () => {
  const good = {
    nodes: [
      { id: 'a', label: 'Count', type: 'signal', value: 1, deps: ['b'] },
      { id: 'b', type: 'effect', deps: [] },
    ],
    edges: [
      { from: 'a', to: 'b' },
      { from: 'a', to: 'missing' }, // یال معلق حذف می‌شود
    ],
    counts: { signals: 1.8, effects: 1, directives: 0, dom: 0, edges: 2 },
    generatedAt: 1234,
  };

  it('accepts a well-formed payload and drops dangling edges', () => {
    const res = schema.sanitizeGraphPayload(good);
    expect(res.ok).toBe(true);
    expect(res.value.nodes).toHaveLength(2);
    expect(res.value.edges).toEqual([{ from: 'a', to: 'b' }]);
    expect(res.value.counts.signals).toBe(1); // floor
    expect(res.value.generatedAt).toBe(1234);
    expect(res.value.nodes[0].value).toBe(1);
    expect(res.value.nodes[1].type).toBe('effect');
  });

  it('rejects anything that does not match the schema', () => {
    const bad = [
      null,
      'data',
      { nodes: 'nope' },
      { nodes: [{ id: '' }] },
      { nodes: [{ id: 'a', value: { nested: true } }] },
      { nodes: [{ id: 'a', deps: 'b' }] },
      { nodes: [{ id: 'a', deps: [1] }] },
      { nodes: [{ id: 'a' }], edges: [{ from: 'a' }] },
      { nodes: [{ id: 'a' }], edges: [{ from: 'a', to: '' }] },
      { nodes: [], edges: 'x' },
      { nodes: [{ id: 'a'.repeat(schema.LIMITS.graphStringLength + 1) }] },
      JSON.parse('{"nodes":[{"id":"a","__proto__":{"x":1}}]}'),
    ];
    for (const payload of bad) {
      const res = schema.sanitizeGraphPayload(payload);
      expect(res.ok, JSON.stringify(payload)).toBe(false);
      expect(typeof res.reason).toBe('string');
    }
  });

  it('refuses oversized graphs instead of truncating them silently', () => {
    const many = Array.from({ length: schema.LIMITS.graphNodes + 1 }, (_, i) => ({ id: `n${i}` }));
    expect(schema.sanitizeGraphPayload({ nodes: many })).toEqual({
      ok: false,
      reason: 'too-many-nodes',
    });
    const manyEdges = Array.from({ length: schema.LIMITS.graphEdges + 1 }, () => ({
      from: 'a',
      to: 'a',
    }));
    expect(schema.sanitizeGraphPayload({ nodes: [{ id: 'a' }], edges: manyEdges })).toEqual({
      ok: false,
      reason: 'too-many-edges',
    });
  });

  it('sanitizes single nodes/edges defensively', () => {
    expect(schema.sanitizeGraphNode({ id: 'a', type: 5 })).toBeNull();
    expect(schema.sanitizeGraphNode({ id: 'a', label: 5 })?.label).toBeUndefined();
    expect(schema.sanitizeGraphNode({ id: 'a', deps: ['b'] })?.deps).toEqual(['b']);
    expect(schema.sanitizeGraphEdge({ from: 'a', to: 'b', type: 'dep' })?.type).toBe('dep');
    expect(schema.sanitizeGraphEdge({ from: 'a', to: 'b', type: 7 })).toEqual({
      from: 'a',
      to: 'b',
    });
  });
});

describe('#67 devtools-extension — پاک‌سازی پاسخ بازرسی', () => {
  it('marks non-installed responses and blanks anything unexpected', () => {
    expect(schema.sanitizeInspectionResponse(null)).toBeNull();
    expect(schema.sanitizeInspectionResponse({ installed: false })).toEqual({ installed: false });
    expect(schema.sanitizeInspectionResponse('x')).toBeNull();
    const empty = schema.sanitizeInspectionResponse({ installed: true });
    expect(empty.installed).toBe(true);
    expect(empty.version).toBe('unknown');
    expect(empty.signals).toEqual([]);
    expect(empty.signalCount).toBe(0);
    expect(empty.cacheStats).toBeNull();
  });

  it('keeps known fields, drops unknown ones and never throws on hostile input', () => {
    const out = schema.sanitizeInspectionResponse({
      installed: true,
      version: '1.4.0',
      signals: [
        { id: 's1', name: 'count', value: 2, subscriberCount: 3.7, secret: 'nope' },
        'garbage',
        null,
      ],
      timeline: [{ signalId: 's1', signalName: 'count', oldValue: 1, newValue: 2, timestamp: 5 }],
      components: [{ name: 'Card', used: 2, hasTemplate: true }],
      effects: [
        { id: 'e1', disposed: false, source: 'zen-effect', dependencies: ['s1'], deps: ['s1'] },
      ],
      staticFors: [{ expr: 'items', itemCount: 4 }],
      destroyedResources: [{ name: 'img', url: 'a.png', destroyedAt: 42 }],
      activeSSRStores: ['store-1', 5],
      cacheStats: { hits: 3, misses: 1, total: 4, hitRatio: 1.5, uniqueExpressions: 2, size: 1 },
      signalCount: 9,
      extraField: { ignored: true },
    });
    expect(out.signals).toEqual([{ id: 's1', name: 'count', value: '2', subscriberCount: 3 }]);
    expect(out.timeline[0].timestamp).toBe(5);
    expect(out.components[0]).toEqual({ name: 'Card', used: 2, hasTemplate: true });
    expect(out.effects[0]).toEqual({
      id: 'e1',
      disposed: false,
      source: 'zen-effect',
      dependencies: ['s1'],
      deps: ['s1'],
    });
    expect(out.staticFors).toEqual([{ expr: 'items', itemCount: 4 }]);
    expect(out.destroyedResources).toEqual([{ name: 'img', url: 'a.png', destroyedAt: 42 }]);
    // شمارنده‌ها رشتهٔ سقف‌دار می‌شوند، شکل‌های غیرقابل‌متن رشتهٔ خالی.
    expect(out.activeSSRStores).toEqual([{ id: 'store-1' }, { id: '5' }]);
    expect(out.cacheStats).toEqual({
      hits: 3,
      misses: 1,
      total: 4,
      hitRatio: 1, // 1.5 ⇒ clamp به ۱
      uniqueExpressions: 2,
      size: 1,
    });
    expect(out.signalCount).toBe(9);
    expect(out.extraField).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain('secret');
  });

  it('derives cacheStats/effects defaults when the host omits them', () => {
    const out = schema.sanitizeInspectionResponse({
      installed: true,
      effects: [{ id: 'e1' }],
      cacheStats: { hits: 4, misses: 2 },
    });
    expect(out.effects[0]).toEqual({
      id: 'e1',
      disposed: false,
      source: '',
      dependencies: [],
      deps: [],
    });
    expect(out.cacheStats.total).toBe(6);
    expect(out.cacheStats.hitRatio).toBeCloseTo(4 / 6, 6);
  });

  it('caps list lengths so a hostile page cannot blow up the popup', () => {
    const out = schema.sanitizeInspectionResponse({
      installed: true,
      timeline: Array.from({ length: schema.LIMITS.graphArrayLength + 25 }, () => ({
        signalName: 'x',
      })),
    });
    expect(out.timeline).toHaveLength(schema.LIMITS.graphArrayLength);
  });
});
