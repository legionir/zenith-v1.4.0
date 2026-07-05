// packages/devtools/src/graph.ts
//
// FEATURE (v0.4.0): Dependency Graph Viewer
// ردیابی و نمایش زنجیره‌ی Reactivity: Signal → Effect → Directive → DOM
//
// ── نکات طراحی ──
//
// 1) Zero-Cost when Disabled:
//    متدهای ثبت وقتی DevTools فعال نباشد no-op می‌شوند.
// 2) Idempotent:
//    add* با همان ID فقط به‌روزرسانی می‌کند؛ یال‌های تکراری حذف می‌شوند.
// 3) SSR-Safe:
//    کلاس هیچ ارجاعی به window/document ندارد. فقط helper های پایین
//    window را با guard چک می‌کنند.
// 4) Integration Model:
//    runtime از طریق window.__ZENITH__ ثبت می‌کند — بدون import مستقیم.
/**
 * حداکثر تعداد نودها برای هر نوع (signal / effect / directive / dom).
 * وقتی شمارشِ یک نوع به این حد برسد، قبل از افزودنِ نود جدید، قدیمی‌ترین
 * نود آن نوع (کوچک‌ترین createdAt) به‌صورت LRU حذف می‌شود.
 */
export const MAX_NODES_PER_TYPE = 500;
export class DependencyGraph {
    constructor() {
        this.nodes = new Map();
        this.edgeKeys = new Set();
        this.edges = [];
    }
    addSignal(id, name, value) {
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
    addEffect(id, deps = []) {
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
    addDirective(id, type, elementSelector, expression) {
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
            label: `zen-${type}`,
            directiveType: type,
            elementSelector,
            expression,
            createdAt: Date.now(),
        });
    }
    addDom(id, tag) {
        const existing = this.nodes.get(id);
        if (existing) {
            existing.domTag = tag;
            return;
        }
        this.evictIfNeeded('dom');
        this.nodes.set(id, {
            id,
            type: 'dom',
            label: `<${tag}>`,
            domTag: tag,
            createdAt: Date.now(),
        });
    }
    recordRead(signalId, effectId) {
        this.addEdge(signalId, effectId, 'read-by');
    }
    recordWrite(effectId, directiveId) {
        this.addEdge(effectId, directiveId, 'drives');
    }
    recordDomUpdate(directiveId, nodeId) {
        this.addEdge(directiveId, nodeId, 'updates');
    }
    getGraph() {
        const counts = {
            signals: 0,
            effects: 0,
            directives: 0,
            dom: 0,
            edges: this.edges.length,
        };
        for (const n of this.nodes.values()) {
            if (n.type === 'signal')
                counts.signals++;
            else if (n.type === 'effect')
                counts.effects++;
            else if (n.type === 'directive')
                counts.directives++;
            else if (n.type === 'dom')
                counts.dom++;
        }
        return {
            nodes: Array.from(this.nodes.values()),
            edges: this.edges.slice(),
            generatedAt: Date.now(),
            counts,
        };
    }
    serialize() {
        return JSON.stringify(this.getGraph(), null, 2);
    }
    clear() {
        this.nodes.clear();
        this.edgeKeys.clear();
        this.edges.length = 0;
    }
    addEdge(from, to, type) {
        const key = `${from}\u0001${to}\u0001${type}`;
        if (this.edgeKeys.has(key))
            return;
        this.edgeKeys.add(key);
        this.edges.push({ from, to, type });
    }
    evictIfNeeded(type) {
        let count = 0;
        for (const n of this.nodes.values()) {
            if (n.type === type)
                count++;
        }
        if (count < MAX_NODES_PER_TYPE)
            return;
        let oldestId = null;
        let oldestTime = Infinity;
        for (const [nid, n] of this.nodes) {
            if (n.type === type && n.createdAt < oldestTime) {
                oldestTime = n.createdAt;
                oldestId = nid;
            }
        }
        if (oldestId !== null)
            this.removeNode(oldestId);
    }
    removeNode(id) {
        this.nodes.delete(id);
        if (this.edges.length === 0)
            return;
        const newEdges = [];
        const newKeys = new Set();
        for (const e of this.edges) {
            if (e.from === id || e.to === id)
                continue;
            newEdges.push(e);
            newKeys.add(`${e.from}\u0001${e.to}\u0001${e.type}`);
        }
        this.edges = newEdges;
        this.edgeKeys = newKeys;
    }
}
export const graph = new DependencyGraph();
export function getDependencyGraph() {
    return graph.getGraph();
}
export function clearDependencyGraph() {
    graph.clear();
}
function devtoolsHook() {
    if (typeof window === 'undefined')
        return null;
    return window.__ZENITH__ || null;
}
export function recordRead(signalId, effectId) {
    if (!devtoolsHook())
        return;
    graph.recordRead(signalId, effectId);
}
export function recordWrite(effectId, directiveId) {
    if (!devtoolsHook())
        return;
    graph.recordWrite(effectId, directiveId);
}
export function recordDomUpdate(directiveId, nodeId) {
    if (!devtoolsHook())
        return;
    graph.recordDomUpdate(directiveId, nodeId);
}
