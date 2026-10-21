// benchmarks/src/list-rendering.js
//
// FEATURE (v0.4.0): Benchmark — List Rendering (zen-for vs manual DOM)
//
// سناریو: رندر لیستی از N آیتم با zen-for و مقایسه با appendChild دستی.
// معیارها: initial render time, node count.

import { signal } from '../../packages/state/dist/index.js';
import { Zen } from '../../packages/runtime/dist/index.js';

/**
 * ساخت یک DOM mock با jsdom (اگر در دسترس باشد) یا یک mini-mock.
 * چون jsdom ممکن است نصب نباشد، یک mini DOM stub می‌سازیم.
 */
function createMiniDom() {
  const elements = [];
  function makeEl(tag) {
    const el = {
      tagName: tag.toUpperCase(),
      tagName_: tag,
      attributes: {},
      children: [],
      parentNode: null,
      _text: '',
      style: {},
      classList: { _set: new Set(), add(c){this._set.add(c);}, remove(c){this._set.delete(c);}, contains(c){return this._set.has(c);} },
      setAttribute(n, v) { this.attributes[n] = String(v); },
      removeAttribute(n) { delete this.attributes[n]; },
      getAttribute(n) { return this.attributes[n] ?? null; },
      hasAttribute(n) { return n in this.attributes; },
      appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
      removeChild(c) { const i = this.children.indexOf(c); if (i>=0) this.children.splice(i,1); c.parentNode=null; return c; },
      insertBefore(n, r) { const i = r ? this.children.indexOf(r) : this.children.length; this.children.splice(i<0?this.children.length:i, 0, n); n.parentNode=this; return n; },
      replaceChild(n, o) { const i = this.children.indexOf(o); this.children[i]=n; n.parentNode=this; o.parentNode=null; return o; },
      cloneNode(deep) { const c = makeEl(this.tagName_); c.attributes = {...this.attributes}; c._text = this._text; if (deep) c.children = this.children.map(ch => ch.cloneNode ? ch.cloneNode(true) : ch); return c; },
      get textContent() { return this._text; },
      set textContent(v) { this._text = String(v ?? ''); },
      get innerHTML() { return this.children.map(c => c.textContent).join(''); },
      set innerHTML(v) { this._text = String(v ?? ''); this.children = []; },
      get nextSibling() { if (!this.parentNode) return null; const i = this.parentNode.children.indexOf(this); return this.parentNode.children[i+1] ?? null; },
      get parentElement() { return this.parentNode; },
      addEventListener() {},
      removeEventListener() {},
    };
    elements.push(el);
    return el;
  }
  // stub globals که runtime نیاز دارد
  const globalScope = typeof globalThis !== 'undefined' ? globalThis : {};
  const doc = {
    createElement: makeEl,
    createComment: (t) => { const c = makeEl('#comment'); c._text = t; return c; },
    createTextNode: (t) => { const n = makeEl('#text'); n._text = t; return n; },
    body: makeEl('body'),
    documentElement: makeEl('html'),
  };
  // global/document را stub کن فقط اگر واقعی نیستند
  if (typeof globalScope.document === 'undefined') globalScope.document = doc;
  if (typeof globalScope.window === 'undefined') globalScope.window = globalScope;
  return { doc, elements, makeEl };
}

/**
 * Benchmark: zen-for با N آیتم.
 */
export function benchZenFor(n) {
  const { doc } = createMiniDom();
  const items = Array.from({ length: n }, (_, i) => ({ id: i, name: `Item ${i}` }));
  const state = { items: signal(items) };

  const root = doc.createElement('div');
  const template = doc.createElement('li');
  template.setAttribute('zen-for', 'item in $items');
  template.setAttribute('zen-key', 'item.id');
  const span = doc.createElement('span');
  span.setAttribute('zen-text', 'item.name');
  template.appendChild(span);
  root.appendChild(template);

  const start = performance.now();
  try {
    Zen.start(root, state);
  } catch (e) {
    // اگر runtime با mini-dom کار نکرد، fallback به شمارش دستی
    return { time: 0, nodes: n, error: e.message };
  }
  const time = performance.now() - start;
  return { time, nodes: n, renderedItems: root.children.length };
}

/**
 * Benchmark: appendChild دستی (baseline).
 */
export function benchManual(n) {
  const { doc } = createMiniDom();
  const items = Array.from({ length: n }, (_, i) => ({ id: i, name: `Item ${i}` }));
  const root = doc.createElement('div');
  const start = performance.now();
  for (const item of items) {
    const li = doc.createElement('li');
    const span = doc.createElement('span');
    span.textContent = item.name;
    li.appendChild(span);
    root.appendChild(li);
  }
  const time = performance.now() - start;
  return { time, nodes: n, renderedItems: root.children.length };
}

/**
 * اجرای کامل benchmark لیست.
 */
export function runListBenchmarks() {
  const sizes = [1000, 10000, 100000];
  const results = [];
  for (const n of sizes) {
    const manual = benchManual(n);
    const zen = benchZenFor(n);
    results.push({
      benchmark: 'List Rendering',
      size: n,
      manualMs: manual.time.toFixed(2),
      zenForMs: zen.time.toFixed(2),
      notes: zen.error ? `fallback (error: ${zen.error.substring(0,40)})` : `${zen.renderedItems} items rendered`,
    });
  }
  return results;
}
