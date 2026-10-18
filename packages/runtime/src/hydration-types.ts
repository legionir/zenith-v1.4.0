/** Directive hydration cleanup. @public */
export type DisposeFn = () => void;
/** Compiled hydration expressions return unvalidated dynamic values. @public */
export type CompiledExpr = (context: Record<string, unknown>) => unknown;

/**
 * The shape of a hydrator bound to a specific root element and state object.
 * @public
 */
export interface Hydrator {
  /** The root element this hydrator is bound to. */
  root: HTMLElement;
  /** The state object (Signal-bearing) this hydrator reads from. */
  state: Record<string, unknown>;
  /** Build a context from state (mirrors createContext from context.ts). */
  context(): Record<string, unknown>;
  /** Hydrate every supported directive inside the root in one pass. */
  hydrateAll(): DisposeFn;
  /** Dispose every effect created by this hydrator. */
  dispose(): void;
}

