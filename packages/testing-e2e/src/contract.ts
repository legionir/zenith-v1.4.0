/** Test-only browser handshake; deliberately separate from the runtime implementation. @public */
export const TEST_BRIDGE_KEY = '__ZENITH_TEST_BRIDGE__';
/** @public */
export const TEST_MOUNT_KEY = '__ZENITH_TEST_MOUNT__';
/** @public */
export interface TestBridge {
  ready(): boolean;
  getSignal(name: string): unknown;
  setSignal(name: string, value: unknown): void;
  snapshot(): unknown;
}
/** Serializable plugin module descriptors; functions cannot cross the Playwright boundary. @public */
export interface TestPluginModule {
  module: string;
  /** @default default */ exportName?: string;
  options?: unknown;
}
/** @public */
export interface BrowserMountOptions {
  html: string;
  /** Bound plugin module loading; unrelated to fixed boot sleeps. @default 5000 @unit ms */
  mountTimeout?: number;
  state?: Record<string, unknown>;
  plugins?: TestPluginModule[];
  /** Deterministic per-mount ID prefix. @default zen-test */ idPrefix?: string;
}
/** @public */
export interface TestMountController {
  mount(options: BrowserMountOptions): Promise<void>;
  unmount(): void;
}
