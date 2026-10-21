import type { Cleanup } from '@zenith/shared';

/** Structural App store; does not introduce an L2 -> runtime-core dependency. @public */
export interface AuthRegistryStore {
  register(name: string, value: unknown): Cleanup;
  get(name: string): unknown;
  has(name: string): boolean;
  list(): string[];
  unregister(name: string): boolean;
  /** Optional change observation; supplied by runtime-core App inventories. */
  subscribe?(listener: (name: string | null) => void): Cleanup;
}

