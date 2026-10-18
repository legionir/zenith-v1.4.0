import { createReservedError } from '@zenith/errors';

import { createMountController } from './mount';
import { TEST_BRIDGE_KEY, TEST_MOUNT_KEY, type TestBridge, type TestMountController, type BrowserMountOptions } from './contract';
export { TEST_BRIDGE_KEY, TEST_MOUNT_KEY, type TestBridge, type TestMountController, type BrowserMountOptions, type TestPluginModule } from './contract';

/** @public */
export interface TestBridgeOptions {
  signals: Record<string, { get(): unknown; set?(value: never): void }>;
  /** Must reflect completion of real boot/hydration. */
  ready(): boolean;
  snapshot?(): unknown;
}
interface Lease { active: boolean; bridge: TestBridge }
const leases = new WeakMap<object, { original: PropertyDescriptor | undefined; entries: Lease[] }>();

/** Install only in test builds; disposal restores the previous property descriptor. @public */
export function installTestBridge(options: TestBridgeOptions, target: object = globalThis): { dispose(): void } {
  const descriptor = Object.getOwnPropertyDescriptor(target, TEST_BRIDGE_KEY);
  if (descriptor && !descriptor.configurable) throw createReservedError('ZEN-1090', { details: { expected: 'a configurable test bridge property' } });
  let state = leases.get(target);
  if (!state) { state = { original: Object.getOwnPropertyDescriptor(target, TEST_BRIDGE_KEY), entries: [] }; leases.set(target, state); }
  const owner = state;
  const requireSignal = (name: string) => {
    if (!lease.active || !Object.hasOwn(options.signals, name)) throw createReservedError('ZEN-1090', { details: { expected: 'registered test signal' } });
    return options.signals[name]!;
  };
  const lease: Lease = { active: true, bridge: {
    ready: () => lease.active && options.ready(),
    getSignal: name => requireSignal(name).get(),
    setSignal(name, value) { const signal = requireSignal(name); if (!signal.set) throw createReservedError('ZEN-1090', { details: { expected: 'writable test signal' } }); signal.set(value as never); },
    snapshot: () => lease.active ? options.snapshot?.() ?? null : null,
  } };
  owner.entries.push(lease);
  try { Object.defineProperty(target, TEST_BRIDGE_KEY, { configurable: true, value: lease.bridge }); }
  catch { owner.entries.pop(); lease.active = false; if (!owner.entries.length) leases.delete(target); throw createReservedError('ZEN-1090', { details: { expected: 'an installable test bridge property' } }); }
  return { dispose() {
    if (!lease.active) return;
    lease.active = false;
    while (owner.entries.length && !owner.entries.at(-1)!.active) owner.entries.pop();
    if (!owner.entries.length) leases.delete(target);
    // A foreign replacement owns the property now; never overwrite it.
    if (Object.getOwnPropertyDescriptor(target, TEST_BRIDGE_KEY)?.value !== lease.bridge) return;
    const previous = owner.entries.at(-1);
    if (previous) Object.defineProperty(target, TEST_BRIDGE_KEY, { configurable: true, value: previous.bridge });
    else { if (owner.original) Object.defineProperty(target, TEST_BRIDGE_KEY, owner.original); else Reflect.deleteProperty(target, TEST_BRIDGE_KEY); leases.delete(target); }
  } };
}

const mountHosts = new WeakSet<object>();
/**
 * Install once in a test-only host page. HTML/state/plugin descriptors create a
 * real runtime-core App; every remount disposes the previous owner. Do not ship
 * this trusted-template helper or its signal mutation bridge in production.
 * @public
 */
export function installTestMount(options: { document?: Document; target?: object } = {}): { dispose(): void } {
  const doc = options.document ?? globalThis.document;
  const target = options.target ?? globalThis;
  const original = Object.getOwnPropertyDescriptor(target, TEST_MOUNT_KEY);
  if (!doc?.body || mountHosts.has(target) || (original && !original.configurable)) throw createReservedError('ZEN-1090', { details: { expected: 'one test mount host and a document body' } });
  const controller = createMountController(doc, { installBridge: bridge => installTestBridge(bridge, target) });
  Object.defineProperty(target, TEST_MOUNT_KEY, { configurable: true, value: controller });
  mountHosts.add(target);
  let disposed = false;
  return { dispose() {
    if (disposed) return;
    disposed = true;
    mountHosts.delete(target);
    try { controller.dispose(); }
    finally {
      if (Object.getOwnPropertyDescriptor(target, TEST_MOUNT_KEY)?.value === controller) {
        if (original) Object.defineProperty(target, TEST_MOUNT_KEY, original);
        else Reflect.deleteProperty(target, TEST_MOUNT_KEY);
      }
    }
  } };
}
