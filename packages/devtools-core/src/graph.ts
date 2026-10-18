// packages/devtools-core/src/graph.ts
//
// #147 — RuntimeGraph (SPEC §۲.۷): گراف زمان اجرای Signal → Effect → Directive → DOM.
// تغییر نام از DependencyGraph برای رفع تداخل نام با @zenith/dependency-graph؛
// DependencyGraph به‌عنوان alias سازگار حفظ شده است.

import { untrack } from '@zenith/state';
import { deprecate } from '@zenith/errors';
import { isGlobalDiagnosticsAllowed } from './observation-policy';

/** @public */
export type GraphNodeType = 'signal' | 'effect' | 'directive' | 'dom';
/** @public */
export type GraphEdgeType = 'read-by' | 'drives' | 'updates';

/** @public */
export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  value?: unknown;
  deps?: string[];
  directiveType?: string;
  elementSelector?: string;
  expression?: string;
  domTag?: string;
  createdAt: number;
}

/** @public */
export interface GraphEdge {
  from: string;
  to: string;
  type: GraphEdgeType;
}

/** @public */
export interface GraphSnapshot {
  nodes: GraphNode[];
  edges: GraphEdge[];
  generatedAt: number;
  counts: {
    signals: number;
    effects: number;
    directives: number;
    dom: number;
    edges: number;
  };
}

/** Metadata for a graph signal, not a writable Signal capability. @public */
export interface GraphSignalOptions { name?: string; value?: unknown; }
/** Directive graph metadata; strings remain data, not executable expressions. @public */
export interface GraphDirectiveOptions { directiveType: string; elementSelector: string; expression?: string; }

const MAX_NODES_PER_TYPE = 500;
const realmGraphs = new WeakSet<RuntimeGraph>();
const resetters = new WeakMap<RuntimeGraph, () => void>();
const generations = new WeakMap<RuntimeGraph, number>();
function realmObservationAllowed(): boolean {
  return untrack(() => isGlobalDiagnosticsAllowed() && Reflect.get(globalThis, '__ZENITH_DEVTOOLS__') !== false);
}
function canAccessGraph(instance: RuntimeGraph): boolean {
  return !realmGraphs.has(instance) || realmObservationAllowed();
}
function edgeKey(from: string, to: string, type: GraphEdgeType): string {
  return `${from.length}:${from}${to.length}:${to}:${type}`;
}

/** @public */
export class RuntimeGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private edgeKeys: Set<string> = new Set();
  private edges: GraphEdge[] = [];

  constructor() {
    generations.set(this, 0);
    resetters.set(this, () => {
      generations.set(this, (generations.get(this) ?? 0) + 1);
      this.nodes.clear(); this.edgeKeys.clear(); this.edges.length = 0;
    });
  }

  /** @public */
  addSignal(id: string, options: GraphSignalOptions): void;
  /** @public @deprecated Use addSignal(id, { name, value }) (ZEN-DEPR-101; removal in 2.0). */
  addSignal(id: string, name: string, value: unknown): void;
  addSignal(id: string, input: GraphSignalOptions | string, legacyValue?: unknown): void {
    if (!canAccessGraph(this)) return;
    const generation = generations.get(this);
    const { name, value } = untrack(() => {
      if (typeof input === 'string') {
        deprecate('ZEN-DEPR-101', 'addSignal(id, name, value)', 'addSignal(id, { name, value })');
        return { name: input, value: legacyValue };
      }
      return { name: input.name, value: input.value };
    });
    if (generation !== generations.get(this) || !canAccessGraph(this)) return;
    const existing = this.nodes.get(id);
    if (existing?.type === 'signal') { existing.label = name || existing.label; existing.value = value; return; }
    if (existing) this.removeNode(id);
    this.evictIfNeeded('signal');
    this.nodes.set(id, { id, type: 'signal', label: name || id, value, createdAt: Date.now() });
  }

  addEffect(id: string, deps: string[] = []): void {
    if (!canAccessGraph(this)) return;
    const generation = generations.get(this);
    const captured = untrack(() => deps.slice());
    if (generation !== generations.get(this) || !canAccessGraph(this)) return;
    const existing = this.nodes.get(id);
    if (existing?.type === 'effect') {
      existing.deps = captured;
      return;
    }
    if (existing) this.removeNode(id);
    this.evictIfNeeded('effect');
    this.nodes.set(id, {
      id,
      type: 'effect',
      label: id,
      deps: captured,
      createdAt: Date.now(),
    });
  }

  /** @public */
  addDirective(id: string, options: GraphDirectiveOptions): void;
  /** @public @deprecated Use addDirective(id, { directiveType, elementSelector, expression }) (ZEN-DEPR-102; removal in 2.0). */
  addDirective(id: string, directiveType: string, elementSelector: string, expression?: string): void;
  addDirective(id: string, input: GraphDirectiveOptions | string, legacySelector?: string, legacyExpression?: string): void {
    if (!canAccessGraph(this)) return;
    const generation = generations.get(this);
    const { directiveType, elementSelector, expression } = untrack(() => {
      if (typeof input === 'string') {
        deprecate('ZEN-DEPR-102', 'addDirective(id, type, selector, expression)', 'addDirective(id, { directiveType, elementSelector, expression })');
        return { directiveType: input, elementSelector: legacySelector ?? '', expression: legacyExpression };
      }
      return { directiveType: input.directiveType, elementSelector: input.elementSelector, expression: input.expression };
    });
    if (generation !== generations.get(this) || !canAccessGraph(this)) return;
    const existing = this.nodes.get(id);
    if (existing?.type === 'directive') {
      existing.directiveType = directiveType; existing.elementSelector = elementSelector;
      existing.expression = expression; existing.label = `${directiveType}${expression ? `="${expression}"` : ''}`; return;
    }
    if (existing) this.removeNode(id);
    this.evictIfNeeded('directive');
    this.nodes.set(id, { id, type: 'directive', label: `${directiveType}${expression ? `="${expression}"` : ''}`,
      directiveType, elementSelector, expression, createdAt: Date.now() });
  }

  addDom(id: string, domTag: string): void {
    if (!canAccessGraph(this)) return;
    const existing = this.nodes.get(id);
    if (existing?.type === 'dom') {
      existing.domTag = domTag;
      existing.label = `<${domTag.toLowerCase()}>`;
      return;
    }
    if (existing) this.removeNode(id);
    this.evictIfNeeded('dom');
    this.nodes.set(id, {
      id,
      type: 'dom',
      label: `<${domTag.toLowerCase()}>`,
      domTag,
      createdAt: Date.now(),
    });
  }

  recordRead(signalId: string, effectId: string): void {
    this.addEdge(signalId, effectId, 'read-by');
  }

  recordWrite(effectId: string, directiveId: string): void {
    this.addEdge(effectId, directiveId, 'drives');
  }

  recordDomUpdate(directiveId: string, nodeId: string): void {
    this.addEdge(directiveId, nodeId, 'updates');
  }

  private addEdge(from: string, to: string, type: GraphEdgeType): void {
    if (!canAccessGraph(this) || !this.nodes.has(from) || !this.nodes.has(to)) return;
    const key = edgeKey(from, to, type);
    if (this.edgeKeys.has(key)) return;
    this.edgeKeys.add(key);
    this.edges.push({ from, to, type });
  }

  private evictIfNeeded(type: GraphNodeType): void {
    let count = 0;
    let oldestId: string | null = null;
    for (const [id, node] of this.nodes) {
      if (node.type === type) {
        count++;
        if (oldestId === null) oldestId = id;
      }
    }
    if (count >= MAX_NODES_PER_TYPE && oldestId !== null) {
      this.removeNode(oldestId);
    }
  }

  removeNode(id: string): void {
    if (!canAccessGraph(this) || !this.nodes.delete(id)) return;
    this.edges = this.edges.filter((e) => {
      if (e.from === id || e.to === id) {
        this.edgeKeys.delete(edgeKey(e.from, e.to, e.type));
        return false;
      }
      return true;
    });
  }

  getGraph(): GraphSnapshot {
    const allowed = canAccessGraph(this);
    const nodes = allowed ? Array.from(this.nodes.values(), node => ({ ...node, ...(node.deps ? { deps: node.deps.slice() } : {}) })) : [];
    const edges = allowed ? this.edges.map(edge => ({ ...edge })) : [];
    let signals = 0;
    let effects = 0;
    let directives = 0;
    let dom = 0;
    for (const n of nodes) {
      if (n.type === 'signal') signals++;
      else if (n.type === 'effect') effects++;
      else if (n.type === 'directive') directives++;
      else if (n.type === 'dom') dom++;
    }
    return {
      nodes,
      edges,
      generatedAt: Date.now(),
      counts: {
        signals,
        effects,
        directives,
        dom,
        edges: edges.length,
      },
    };
  }

  clear(): void {
    if (canAccessGraph(this)) resetters.get(this)?.();
  }
}

/** Alias سازگار با نام قدیمی در @zenith/devtools. @public */
export const DependencyGraph = RuntimeGraph;
/** @public */
export type DependencyGraph = RuntimeGraph;

/** Realm-global graph; explicit new RuntimeGraph instances stay caller-owned. @public */
export const runtimeGraph = new RuntimeGraph();
realmGraphs.add(runtimeGraph);
/** @public */
export const graph = runtimeGraph;

/** Explicit process reset bypasses the request-facing singleton policy. @internal */
export function resetRuntimeGraphInternal(): void { resetters.get(runtimeGraph)?.(); }

/** @public */
export function getRuntimeGraph(): GraphSnapshot {
  return runtimeGraph.getGraph();
}

/** @public */
export function clearRuntimeGraph(): void {
  runtimeGraph.clear();
}

/** @public */
export const getDependencyGraph = getRuntimeGraph;
/** @public */
export const clearDependencyGraph = clearRuntimeGraph;

type EdgeEvent = 'recordRead' | 'recordWrite' | 'recordDomUpdate';
const forwarding = new Set<EdgeEvent>();

// Unknown globals are capabilities only after concrete object/function checks.
// Never invent a typed hook, change its receiver, or trust its return value.
function forwardEdge(event: EdgeEvent, operands: [string, string]): boolean {
  if (forwarding.has(event)) return false;
  if (!realmObservationAllowed()) return true;
  const generation = generations.get(runtimeGraph);
  forwarding.add(event);
  try {
    return untrack(() => {
      try {
        const browser: unknown = Reflect.get(globalThis, 'window');
        const targets: object[] = [globalThis];
        if (browser !== null && (typeof browser === 'object' || typeof browser === 'function') && browser !== globalThis) targets.push(browser);
        for (const target of targets) {
          const hook: unknown = Reflect.get(target, '__ZENITH__');
          if (hook === null || (typeof hook !== 'object' && typeof hook !== 'function')) continue;
          const method: unknown = Reflect.get(hook, event);
          if (generation !== generations.get(runtimeGraph) || !realmObservationAllowed()) return true;
          if (typeof method !== 'function') continue;
          Reflect.apply(method, hook, operands); return true;
        }
      } catch { /* a broken diagnostic bridge must not break the caller */ }
      return generation !== generations.get(runtimeGraph);
    });
  } finally { forwarding.delete(event); }
}

/** @public */
export function recordRead(signalId: string, effectId: string): void {
  if (!forwardEdge('recordRead', [signalId, effectId])) runtimeGraph.recordRead(signalId, effectId);
}
/** @public */
export function recordWrite(effectId: string, directiveId: string): void {
  if (!forwardEdge('recordWrite', [effectId, directiveId])) runtimeGraph.recordWrite(effectId, directiveId);
}
/** @public */
export function recordDomUpdate(directiveId: string, nodeId: string): void {
  if (!forwardEdge('recordDomUpdate', [directiveId, nodeId])) runtimeGraph.recordDomUpdate(directiveId, nodeId);
}
