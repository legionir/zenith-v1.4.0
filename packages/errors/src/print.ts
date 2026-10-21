/** Dependency-inverted diagnostic transport. Errors never writes to a host console. */
/** @internal Host-only transport; canonical entry is `@zenith/errors/internal`. */
export type HostSeverity = 'devgroup' | 'info' | 'warning' | 'error';
/** @internal Host-only transport; canonical entry is `@zenith/errors/internal`. */
export type HostPrinter = (severity: HostSeverity, title: string, payload?: unknown) => void;
interface Lease { printer: HostPrinter; active: boolean; previous?: Lease }
const slot = Symbol.for('@zenith/errors/diagnostic-printer');
// Subpath/root bundles and ESM/CJS copies share the transport, not error history.
const host = globalThis as typeof globalThis & { [slot]?: Lease };
/** Internal integration point; stale/out-of-order cleanup never revives a dead sink. */
/** @internal Host-only transport; canonical entry is `@zenith/errors/internal`. */
export function setHostPrinter(printer: HostPrinter): () => void {
  const lease: Lease = { printer, active: true, previous: host[slot] }; host[slot] = lease;
  return () => {
    if (!lease.active) return;
    lease.active = false;
    if (host[slot] !== lease) return;
    let previous = lease.previous;
    while (previous && !previous.active) previous = previous.previous;
    if (previous) host[slot] = previous; else delete host[slot];
  };
}
/** Without a configured transport error history/throws still work, silently. */
/** @public */
export function printToHost(severity: HostSeverity, title: string, payload?: unknown): void {
  try { host[slot]?.printer(severity, title, payload); } catch { /* Do not interrupt error delivery. */ }
}
