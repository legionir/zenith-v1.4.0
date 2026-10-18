import { AsyncLocalStorage } from 'node:async_hooks';
import type { IncomingMessage } from 'node:http';
import { isIP } from 'node:net';
import { createDisposer, createReferenceRegistry, registerRegistryOwnerProvider, type RegistryOwner } from '@zenith/shared';

const owners = new AsyncLocalStorage<RegistryOwner>();
// App (100) and the renderer's DOM scope (0, installed later) take precedence.
registerRegistryOwnerProvider(() => owners.getStore() ?? null, { priority: -100 });
export function requestOwner() {
  const cleanup = createDisposer(); let closed = false;
  const registries: RegistryOwner['registries'] = Object.fromEntries(['actions', 'components', 'auth', 'permissions', 'resources', 'stores', 'serverComponents', 'directives', 'plugins', 'devtools'].map(name => [name, createReferenceRegistry()]));
  for (const registry of Object.values(registries)) cleanup.add(registry);
  const owner: RegistryOwner = { registries, addCleanup(fn) { if (closed) fn(); else cleanup.add(fn); } };
  return { cleanup, owner, run<T>(fn: () => T): T { return owners.run(owner, fn); }, dispose() { if (closed) return; closed = true; cleanup.dispose(); } };
}
export function abortError(): Error { const error = new Error('Request aborted.'); error.name = 'AbortError'; return error; }
export async function untilAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) { void promise.catch(() => {}); throw abortError(); }
  let abort!: () => void;
  const cancelled = new Promise<never>((_, reject) => { abort = () => reject(abortError()); signal.addEventListener('abort', abort, { once: true }); });
  try { return await Promise.race([promise, cancelled]); }
  finally { signal.removeEventListener('abort', abort); }
}
export class InvalidRequestURL extends Error {}
/** Forwarded headers have no effect unless the operator trusts the upstream. */
export function requestURL(req: IncomingMessage, trustProxy: boolean): { url: URL; ip?: string } {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.split(',')[0]?.trim();
  const encrypted = 'encrypted' in req.socket && req.socket.encrypted;
  const protocol = (trustProxy ? first(req.headers['x-forwarded-proto']) : undefined) ?? (encrypted ? 'https' : 'http');
  const host = (trustProxy ? first(req.headers['x-forwarded-host']) : undefined) ?? req.headers.host ?? 'localhost';
  if (!['http', 'https'].includes(protocol) || !/^(?:\[[0-9a-f:.]+\]|[a-z0-9.-]+)(?::\d{1,5})?$/i.test(host)) throw new InvalidRequestURL();
  try {
    const base = new URL(`${protocol}://${host}`), raw = req.url ?? '/';
    if (!raw.startsWith('/') || raw.startsWith('//')) throw new InvalidRequestURL();
    const url = new URL(raw, base); if (url.origin !== base.origin) throw new InvalidRequestURL();
    const forwarded = trustProxy ? first(req.headers['x-forwarded-for']) : undefined;
    if (forwarded && !isIP(forwarded)) throw new InvalidRequestURL();
    return { url, ip: forwarded ?? req.socket.remoteAddress };
  } catch { throw new InvalidRequestURL(); }
}
