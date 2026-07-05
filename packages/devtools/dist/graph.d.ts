// packages/devtools/src/graph.ts
export type GraphNodeType = 'signal' | 'effect' | 'directive' | 'dom';
export type GraphEdgeType = 'read-by' | 'drives' | 'updates';
export interface GraphNode {
    id: string;
    type: GraphNodeType;
    label: string;
    value?: any;
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
export declare const MAX_NODES_PER_TYPE = 500;
export declare class DependencyGraph {
    private nodes;
    private edgeKeys;
    private edges;
    constructor();
    addSignal(id: string, name: string, value: any): void;
    addEffect(id: string, deps?: string[]): void;
    addDirective(id: string, type: string, elementSelector: string, expression?: string): void;
    addDom(id: string, tag: string): void;
    recordRead(signalId: string, effectId: string): void;
    recordWrite(effectId: string, directiveId: string): void;
    recordDomUpdate(directiveId: string, nodeId: string): void;
    getGraph(): GraphSnapshot;
    serialize(): string;
    clear(): void;
    private addEdge;
    private evictIfNeeded;
    private removeNode;
}
export declare const graph: DependencyGraph;
export declare function getDependencyGraph(): GraphSnapshot;
export declare function clearDependencyGraph(): void;
export declare function recordRead(signalId: string, effectId: string): void;
export declare function recordWrite(effectId: string, directiveId: string): void;
export declare function recordDomUpdate(directiveId: string, nodeId: string): void;
//# sourceMappingURL=graph.js.map
