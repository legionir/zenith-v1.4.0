// packages/devtools-core/src/graph.ts
//
// #147 — RuntimeGraph (SPEC §۲.۷): گراف زمان اجرای Signal → Effect → Directive → DOM.
// تغییر نام از DependencyGraph برای رفع تداخل نام با @zenith/dependency-graph؛
// DependencyGraph به‌عنوان alias سازگار حفظ شده است.

export type GraphNodeType = 'signal' | 'effect' | 'directive' | 'dom';
export type GraphEdgeType = 'read-by' | 'drives' | 'updates';

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

export interface GraphEdge {
  from: string;
  to: string;
  type: GraphEdgeType;
}

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

const MAX_NODES_PER_TYPE = 500;

export class RuntimeGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private edgeKeys: Set<string> = new Set();
  private edges: GraphEdge[] = [];

  addSignal(id: string, name: string, value: unknown): void {
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

  addDirective(
    id: string,
    directiveType: string,
    elementSelector: string,
    expression?: string,
  ): void {
    const existing = this.nodes.get(id);
    if (existing) {
      existing.directiveType = directiveType;
      existing.elementSelector = elementSelector;
      existing.expression = expression;
      existing.label = `${directiveType}${expression ? `="${expression}"` : ''}`;
      return;
    }
    this.evictIfNeeded('directive');
    this.nodes.set(id, {
      id,
      type: 'directive',
      label: `${directiveType}${expression ? `="${expression}"` : ''}`,
      directiveType,
      elementSelector,
      expression,
      createdAt: Date.now(),
    });
  }

  addDom(id: string, domTag: string): void {
    const existing = this.nodes.get(id);
    if (existing) {
      existing.domTag = domTag;
      existing.label = `<${domTag.toLowerCase()}>`;
      return;
    }
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
    if (!this.nodes.has(from) || !this.nodes.has(to)) return;
    const key = `${from}|${to}|${type}`;
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
    if (!this.nodes.delete(id)) return;
    this.edges = this.edges.filter((e) => {
      if (e.from === id || e.to === id) {
        this.edgeKeys.delete(`${e.from}|${e.to}|${e.type}`);
        return false;
      }
      return true;
    });
  }

  getGraph(): GraphSnapshot {
    const nodes = Array.from(this.nodes.values());
    const edges = this.edges.slice();
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
    this.nodes.clear();
    this.edgeKeys.clear();
    this.edges.length = 0;
  }
}

/** Alias سازگار با نام قدیمی در @zenith/devtools */
export const DependencyGraph = RuntimeGraph;
export type DependencyGraph = RuntimeGraph;

export const runtimeGraph = new RuntimeGraph();
export const graph = runtimeGraph;

export function getRuntimeGraph(): GraphSnapshot {
  return runtimeGraph.getGraph();
}

export function clearRuntimeGraph(): void {
  runtimeGraph.clear();
}

export const getDependencyGraph = getRuntimeGraph;
export const clearDependencyGraph = clearRuntimeGraph;

function getGlobalHook(): {
  recordRead?: (s: string, e: string) => void;
  recordWrite?: (e: string, d: string) => void;
  recordDomUpdate?: (d: string, n: string) => void;
} | null {
  if (typeof globalThis === 'undefined') return null;
  return (globalThis as { __ZENITH__?: unknown }).__ZENITH__ as {
    recordRead?: (s: string, e: string) => void;
    recordWrite?: (e: string, d: string) => void;
    recordDomUpdate?: (d: string, n: string) => void;
  } | null;
}

export function recordRead(signalId: string, effectId: string): void {
  const h = getGlobalHook();
  if (h && typeof h.recordRead === 'function') {
    h.recordRead(signalId, effectId);
    return;
  }
  runtimeGraph.recordRead(signalId, effectId);
}

export function recordWrite(effectId: string, directiveId: string): void {
  const h = getGlobalHook();
  if (h && typeof h.recordWrite === 'function') {
    h.recordWrite(effectId, directiveId);
    return;
  }
  runtimeGraph.recordWrite(effectId, directiveId);
}

export function recordDomUpdate(directiveId: string, nodeId: string): void {
  const h = getGlobalHook();
  if (h && typeof h.recordDomUpdate === 'function') {
    h.recordDomUpdate(directiveId, nodeId);
    return;
  }
  runtimeGraph.recordDomUpdate(directiveId, nodeId);
}
