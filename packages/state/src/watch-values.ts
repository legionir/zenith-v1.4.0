import { isReadable, type Readable } from './readable';

type Container = { kind: 'container'; id: number; category: 'object' | 'readable'; prototype: object | null; identity: object | null; entries: Array<readonly [PropertyKey, WatchValueSnapshot]> };
/** Private observation graph, never asserted to be the caller's T. @internal */
export type WatchValueSnapshot = { kind: 'value'; value: unknown } | { kind: 'reference'; id: number } | { kind: 'budget' } | Container;

/** Track nested reads separately from the actual callback payload. @internal */
export function captureWatchValue(value: unknown, options: { isLive?: () => boolean } = {}): WatchValueSnapshot {
  const seen = new WeakMap<object, number>();
  const pending: Array<{ value: object; node: Container; readable: Readable<unknown> | null }> = [];
  let remaining = 10000, nextId = 0;
  const capture = (input: unknown): WatchValueSnapshot => {
    if (--remaining < 0 || options.isLive?.() === false) return { kind: 'budget' };
    if (input === null || typeof input !== 'object') return { kind: 'value', value: input };
    const existing = seen.get(input); if (existing !== undefined) return { kind: 'reference', id: existing };
    const id = nextId++; seen.set(input, id);
    const readable = isReadable(input) ? input : null;
    const prototype: object | null = Object.getPrototypeOf(input);
    const plain = prototype === null || prototype === Object.prototype || prototype === Array.prototype;
    const node: Container = { kind: 'container', id, category: readable ? 'readable' : 'object', prototype, identity: readable || plain ? null : input, entries: [] };
    pending.push({ value: input, node, readable }); return node;
  };
  const root = capture(value);
  while (pending.length) {
    if (options.isLive?.() === false) break;
    const item = pending.pop(); if (!item) break;
    if (remaining <= 0) { item.node.entries.push(['budget', { kind: 'budget' }]); continue; }
    if (item.readable) {
      item.node.entries.push(['value', capture(item.readable.get())]); continue;
    }
    // Array holes/length and enumerable symbol fields are real observed data.
    if (Array.isArray(item.value)) item.node.entries.push(['length', capture(item.value.length)]);
    for (const key of Reflect.ownKeys(item.value)) {
      if (options.isLive?.() === false) break;
      if (!Object.getOwnPropertyDescriptor(item.value, key)?.enumerable) continue;
      if (remaining <= 0) { item.node.entries.push(['budget', { kind: 'budget' }]); break; }
      const child: unknown = Reflect.get(item.value, key);
      item.node.entries.push([key, capture(child)]);
    }
  }
  return root;
}

/** Snapshot comparison cannot invoke application toJSON or traverse T again. @internal */
export function equalWatchValue(left: WatchValueSnapshot, right: WatchValueSnapshot): boolean {
  const pending: Array<readonly [WatchValueSnapshot, WatchValueSnapshot]> = [[left, right]];
  while (pending.length) {
    const pair = pending.pop(); if (!pair) break;
    const [a, b] = pair;
    if (a.kind === 'budget' || b.kind === 'budget' || a.kind !== b.kind) return false;
    if (a.kind === 'value') { if (b.kind !== 'value' || !Object.is(a.value, b.value)) return false; continue; }
    if (a.kind === 'reference') { if (b.kind !== 'reference' || a.id !== b.id) return false; continue; }
    if (b.kind !== 'container' || a.id !== b.id || a.category !== b.category || a.prototype !== b.prototype || a.identity !== b.identity || a.entries.length !== b.entries.length) return false;
    for (let index = 0; index < a.entries.length; index++) {
      const first = a.entries[index], second = b.entries[index];
      if (!first || !second || first[0] !== second[0]) return false;
      pending.push([first[1], second[1]]);
    }
  }
  return true;
}
