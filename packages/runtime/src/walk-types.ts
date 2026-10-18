/** Recursive traversal callback; all four operands are live runtime data. @internal */
export type Walk = (node: Node, context: Record<string, unknown>, state: Record<string, unknown>, disposes: (() => void)[]) => void;
