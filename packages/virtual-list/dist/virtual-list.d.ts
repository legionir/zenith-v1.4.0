export interface VirtualListConfig {
    itemHeight: number;
    buffer: number;
    dynamicHeights: boolean;
}
export interface VirtualRange {
    start: number;
    end: number;
    total: number;
    offsetY: number;
    totalHeight: number;
}
export declare function processVirtualList(el: HTMLElement, listExpr: string, context: Record<string, any>, processChildren: (node: HTMLElement, ctx: Record<string, any>, disposes: (() => void)[]) => void, disposes: (() => void)[]): void;
