// packages/devtools/src/graph.ts
//
// FEATURE (v0.4.0): Dependency Graph Viewer
// ردیابی و نمایش زنجیره‌ی Reactivity: Signal → Effect → Directive → DOM
//
// این ماژول یک گرافِ وابستگی‌های واکنش‌گرا را نگهداری می‌کند تا ابزار
// توسعه‌دهندگان بتوانند مسیر جریان داده را از یک Signal تا DOM نهایی
// به‌صورت بصری در یک Viewer مبتنی بر SVG مشاهده کنند.
//
// ── نکات طراحی ──
//
// 1) Zero-Cost when Disabled:
// تمام متدهای ثبت (recordRead/recordWrite/recordDomUpdate) در صورتی که
// DevTools فعال نباشد (window.__ZENITH__ وجود نداشته باشد)، no-op می‌شوند.
// در Production هیچ overheadی روی runtime نداریم.
//
// 2) Idempotent:
// addSignal/addEffect/addDirective اگر با همان ID دوباره فراخوانی شوند،
// فقط فیلدها را به‌روز می‌کنند و duplicate ایجاد نمی‌کنند. یال‌های
// تکراری هم با یک Set از کلیدهای canonical حذف می‌شوند.
//
// 3) SSR-Safe:
// خود کلاس DependencyGraph هیچ ارجاعی به window/document ندارد و در SSR
// هم کار می‌کند. فقط توابع helper پایین فایل، window.__ZENITH__ را
// بررسی می‌کنند.
//
// 4) BUG-DEV-05:
// متد addEdge اکنون وجود نودهای from و to را قبل از افزودن یال بررسی
// می‌کند تا از dangling edges جلوگیری شود.

// ── Types ──

/**
 * انواع نود در گراف وابستگی‌ها.
 *
 * signal:  یک Signal (وضعیت) — مثلی `var count = signal(0)`.
 * effect:  یک Effect (عوارض جانبی) — مثلی `effect(() => ...)`.
 * directive:  یک دایرکتیو الزام‌آور — `zen-text`, `zen-bind`, `zen-show`,
 *   `zen-if`, `zen-for`.
 * dom:     یک عنصر DOM واقعی (که توسط دایرکتیو کنترل می‌شود).
 */
export type GraphNodeType = 'signal' | 'effect' | 'directive' | 'dom';

/**
 * انواع یال (رابطه) در گراف.
 *
 * read-by:  یک Signal توسط یک Effect خوانده شده است (Signal → Effect).
 * drives:   یک Effect یک Directive را هدایت می‌کند (Effect → Directive).
 * updates:  Directive یک عنصر DOM را به‌روز می‌کند (Directive → DOM).
 */
export type GraphEdgeType = 'read-by' | 'drives' | 'updates';

/**
 * یک نود در گراف وابستگی‌ها.
 */
export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  /** مقدار فعلی (فقط برای Signal). */
  value?: any;
  /** لیست ID سیگنال‌های خوانده‌شده (فقط برای Effect). */
  deps?: string[];
  /** نوع دایرکتیو مثل text/bind/show/if/for (فقط برای Directive). */
  directiveType?: string;
  /** selector یا توصیف عنصر هدف (فقط برای Directive). */
  elementSelector?: string;
  /** عبارت دایرکتیو (فقط برای Directive). */
  expression?: string;
  /** تگ عنصر DOM (فقط برای DOM). */
  domTag?: string;
  createdAt: number;
}

/**
 * یک یال جهت‌دار در گراف.
 */
export interface GraphEdge {
  from: string;
  to: string;
  type: GraphEdgeType;
}

/**
 * اسنپ‌شات کامل گراف برای نمایش در Viewer یا export به JSON.
 */
export interface GraphSnapshot {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** زمان تولید اسنپ‌شات (timestamp). */
  generatedAt: number;
  /** شمارش‌ها برای نمایش سریع در نوار ابزار. */
  counts: {
    signals: number;
    effects: number;
    directives: number;
    dom: number;
    edges: number;
  };
}

/**
 * حداکثر تعداد نود از هر نوع.
 * وقتی از این حد فراتر رود، قدیمی‌ترین نود آن نوع حذف می‌شود (LRU).
 * این کار از رشد بی‌رویه و مصرف حافظه جلوگیری می‌کند.
 */
const MAX_NODES_PER_TYPE = 500;

/**
 * کلاس اصلی گراف وابستگی‌ها.
 *
 * این کلاس به‌صورت ایزوله از DOM/Window طراحی شده تا در SSR و
 * Node.js هم قابل استفاده باشد.
 *
 * مثال استفاده:
 * ```ts
 * const graph = new DependencyGraph();
 * graph.addSignal('count', 'count', 0);
 * graph.addEffect('eff1', ['count']);
 * graph.recordRead('count', 'eff1');
 * graph.getGraph(); // → { nodes, edges, counts, ... }
 * ```
 */
export class DependencyGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private edgeKeys: Set<string> = new Set();
  private edges: GraphEdge[] = [];

  /**
   * افزودن یا به‌روزرسانی یک Signal.
   */
  addSignal(id: string, name: string, value: any): void {
    const existing = this.nodes.get(id);
    if (existing) {
      existing.label = name || existing.label;
      existing.value = value;
      return;
    }
    this.evictIfNeeded('signal');
    this.nodes.set(id, {
      id,
      type: 'signal',
      label: name || id,
      value,
      createdAt: Date.now(),
    });
  }

  /**
   * افزودن یا به‌روزرسانی یک Effect.
   *
   * @param id - ID یکتای Effect.
   * @param deps - لیست ID سیگنال‌هایی که این Effect می‌خواند.
   */
  addEffect(id: string, deps: string[] = []): void {
    const existing = this.nodes.get(id);
    if (existing) {
      existing.deps = deps;
      return;
    }
    this.evictIfNeeded('effect');
    this.nodes.set(id, {
      id,
      type: 'effect',
      label: id,
      deps,
      createdAt: Date.now(),
    });
  }

  /**
   * افزودن یا به‌روزرسانی یک Directive.
   *
   * @param id - ID یکتای Directive.
   * @param type - نوع دایرکتیو (text, bind, show, ...).
   * @param elementSelector - selector یا توصیف عنصر هدف (مثل `span#count`).
   * @param expression - عبارت دایرکتیو (مثل `$count`).
   */
  addDirective(id: string, type: string, elementSelector?: string, expression?: string): void {
    const existing = this.nodes.get(id);
    if (existing) {
      existing.elementSelector = elementSelector;
      existing.expression = expression;
      return;
    }
    this.evictIfNeeded('directive');
    this.nodes.set(id, {
      id,
      type: 'directive',
      label: 'zen-' + type,
      directiveType: type,
      elementSelector,
      expression,
      createdAt: Date.now(),
    });
  }

  /**
   * افزودن یا به‌روزرسانی یک نود DOM.
   *
   * @param id - ID یکتای نود DOM.
   * @param tag - تگ HTML (مثل `span`, `div`).
   */
  addDom(id: string, tag: string): void {
    const existing = this.nodes.get(id);
    if (existing) {
      existing.domTag = tag;
      return;
    }
    this.evictIfNeeded('dom');
    this.nodes.set(id, {
      id,
      type: 'dom',
      label: '<' + tag + '>',
      domTag: tag,
      createdAt: Date.now(),
    });
  }

  /**
   * ثبت اینکه یک Signal توسط یک Effect خوانده شده است.
   * یک یال `read-by` از Signal به Effect اضافه می‌کند.
   */
  recordRead(signalId: string, effectId: string): void {
    this.addEdge(signalId, effectId, 'read-by');
  }

  /**
   * ثبت اینکه یک Effect یک Directive را هدایت می‌کند.
   * یک یال `drives` از Effect به Directive اضافه می‌کند.
   */
  recordWrite(effectId: string, directiveId: string): void {
    this.addEdge(effectId, directiveId, 'drives');
  }

  /**
   * ثبت اینکه یک Directive یک عنصر DOM را به‌روز می‌کند.
   * یک یال `updates` از Directive به DOM اضافه می‌کند.
   */
  recordDomUpdate(directiveId: string, nodeId: string): void {
    this.addEdge(directiveId, nodeId, 'updates');
  }

  /**
   * دریافت اسنپ‌شات کامل گراف (نودها + یال‌ها + شمارش‌ها).
   */
  getGraph(): GraphSnapshot {
    const counts = { signals: 0, effects: 0, directives: 0, dom: 0, edges: this.edges.length };
    for (const n of this.nodes.values()) {
      if (n.type === 'signal') counts.signals++;
      else if (n.type === 'effect') counts.effects++;
      else if (n.type === 'directive') counts.directives++;
      else if (n.type === 'dom') counts.dom++;
    }
    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges.slice(),
      generatedAt: Date.now(),
      counts,
    };
  }

  /**
   * خروجی JSON گراف (برای export یا debugging).
   */
  toJSON(): string {
    return JSON.stringify(this.getGraph(), null, 2);
  }

  /**
   * پاکسازی کامل گراف (برای HMR).
   */
  clear(): void {
    this.nodes.clear();
    this.edgeKeys.clear();
    this.edges.length = 0;
  }

  /**
   * helper داخلی برای افزودن یال با جلوگیری از duplicate.
   * کلید canonical از جداکننده‌ی U+0001 ساخته می‌شود تا با ID ها تداخل نکند.
   *
   * BUG-DEV-05: بررسی وجود نودهای from و to قبل از افزودن یال.
   * اگر یکی از نودها وجود نداشته باشد، یال اضافه نمی‌شود و
   * warning ثبت می‌شود تا از dangling edges جلوگیری کند.
   */
  private addEdge(from: string, to: string, type: GraphEdgeType): void {
    if (!this.nodes.has(from)) {
      console.warn('[Zenith DevTools] addEdge: node "' + from + '" does not exist. Edge type=' + type + ' to="' + to + '" skipped.');
      return;
    }
    if (!this.nodes.has(to)) {
      console.warn('[Zenith DevTools] addEdge: node "' + to + '" does not exist. Edge type=' + type + ' from="' + from + '" skipped.');
      return;
    }
    const key = from + '' + to + '' + type;
    if (this.edgeKeys.has(key)) return;
    this.edgeKeys.add(key);
    this.edges.push({ from, to, type });
  }

  /**
   * اگر تعداد نودهای یک نوع به MAX_NODES_PER_TYPE رسیده باشد، قدیمی‌ترین
   * نود آن نوع (LRU بر اساس کوچک‌ترین createdAt) را حذف می‌کند تا جا برای
   * نودِ جدید باز شود. یال‌های مرتبط به نودِ حذف‌شده نیز پاکسازی می‌شوند.
   *
   * این متد فقط قبل از افزودنِ نود جدید فراخوانی می‌شود (نه در به‌روزرسانی).
   */
  private evictIfNeeded(type: GraphNodeType): void {
    let count = 0;
    for (const n of this.nodes.values()) {
      if (n.type === type) count++;
    }
    if (count < MAX_NODES_PER_TYPE) return;

    let oldestId: string | null = null;
    let oldestTime = Infinity;
    for (const [nid, n] of this.nodes) {
      if (n.type === type && n.createdAt < oldestTime) {
        oldestTime = n.createdAt;
        oldestId = nid;
      }
    }
    if (oldestId !== null) this.removeNode(oldestId);
  }

  /**
   * حذف یک نود به‌همراه تمام یال‌هایی که به آن اشاره می‌کنند.
   */
  private removeNode(id: string): void {
    this.nodes.delete(id);
    if (this.edges.length === 0) return;
    const newEdges: GraphEdge[] = [];
    const newKeys: Set<string> = new Set();
    for (const e of this.edges) {
      if (e.from === id || e.to === id) continue;
      newEdges.push(e);
      newKeys.add(e.from + '' + e.to + '' + e.type);
    }
    this.edges = newEdges;
    this.edgeKeys = newKeys;
  }
}

// ── Singleton ──

/**
 * یک instance سراسری از گراف (که توسط DevTools Hook استفاده می‌شود).
 * Hook.ts در زمان نصب، متدهای این کلاس را از طریق window.__ZENITH__
 * در دسترس قرار می‌دهد.
 */
export const graph = new DependencyGraph();

/**
 * دریافت اسنپ‌شات فعلی گراف (برای DevTools).
 * توسط `window.__ZENITH__.getDependencyGraph()` در hook.ts صدا زده می‌شود.
 */
export function getDependencyGraph(): GraphSnapshot {
  return graph.getGraph();
}

/**
 * پاکسازی کامل گراف وابستگی‌ها (برای DevTools).
 * توسط `window.__ZENITH__.clearDependencyGraph()` صدا زده می‌شود و
 * همچنین توسط cleanupDevtools در زمان page unload و reset.
 */
export function clearDependencyGraph(): void {
  graph.clear();
}

// ─────────────────────────────────────────────────────────────
// Runtime Integration Helpers — zero-cost when devtools disabled
// ─────────────────────────────────────────────────────────────
//
// این توابع توسط @zenith/runtime walker/directives فراخوانی می‌شوند.
// اگر DevTools فعال نباشد (window.__ZENITH__ وجود نداشته باشد)،
// بلافاصله return می‌کنند — یعنی zero overhead در Production.
//
// نکته: runtime نیازی به import از @zenith/devtools ندارد؛ می‌تواند
// مستقیماً از طریق window.__ZENITH__.recordRead(...) هم صدا بزند.
// این توابع صرفاً راحتیِ تست‌های داخلی devtools هستند.

function devtoolsHook(): ZenithDevtoolsHookLike | null {
  if (typeof window === 'undefined') return null;
  return (window as any).__ZENITH__ || null;
}

/** شکل حداقلیِ hook برای type-safety در helper ها. */
interface ZenithDevtoolsHookLike {
  __ZENITH__?: boolean;
}

/**
 * ثبت خواندن Signal توسط Effect (از داخل runtime).
 * اگر DevTools فعال نباشد، no-op.
 */
export function recordRead(signalId: string, effectId: string): void {
  if (!devtoolsHook()) return;
  graph.recordRead(signalId, effectId);
}

/**
 * ثبت هدایت Directive توسط Effect (از داخل runtime).
 * اگر DevTools فعال نباشد، no-op.
 */
export function recordWrite(effectId: string, directiveId: string): void {
  if (!devtoolsHook()) return;
  graph.recordWrite(effectId, directiveId);
}

/**
 * ثبت به‌روزرسانی DOM توسط Directive (از داخل runtime).
 * اگر DevTools فعال نباشد، no-op.
 */
export function recordDomUpdate(directiveId: string, nodeId: string): void {
  if (!devtoolsHook()) return;
  graph.recordDomUpdate(directiveId, nodeId);
}
