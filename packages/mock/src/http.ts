import { createReservedError } from '@zenith/errors';
/** @public */
export interface MockClock { setTimeout(callback: () => void, ms: number): ReturnType<typeof setTimeout>; clearTimeout(id: ReturnType<typeof setTimeout>): void; }
/** Abortable delay, without a module-level timer or random source. @public */
export function delay(ms: number, options: { signal?: AbortSignal; clock?: MockClock } = {}): Promise<void> {
  if (!Number.isFinite(ms) || ms < 0) return Promise.reject(new TypeError('Invalid delay.'));
  const clock = options.clock ?? { setTimeout: (fn: () => void, duration: number) => setTimeout(fn, duration), clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id) };
  return new Promise((resolve, reject) => {
    const abort = () => { clock.clearTimeout(timer); options.signal?.removeEventListener('abort', abort); const error = new Error('Aborted'); error.name = 'AbortError'; reject(error); };
    const timer = clock.setTimeout(() => { options.signal?.removeEventListener('abort', abort); resolve(); }, ms);
    options.signal?.addEventListener('abort', abort, { once: true }); if (options.signal?.aborted) abort();
  });
}
/** @public */
export interface MockResponseOptions { status?: number; headers?: HeadersInit; json?: unknown; text?: string; }
/** @public */
export function respond(options: MockResponseOptions = {}): Response {
  if (options.json !== undefined && options.text !== undefined) throw new TypeError('Choose json or text, not both.');
  const headers = new Headers(options.headers); let body: string | undefined = options.text;
  if (options.json !== undefined) { body = JSON.stringify(options.json); if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json; charset=utf-8'); }
  return new Response(body, { status: options.status ?? 200, headers });
}
/** @public */
export const PASSTHROUGH = Symbol.for('zenith.mock.passthrough');
/** @public */
export function passthrough(): typeof PASSTHROUGH { return PASSTHROUGH; }
/** @public */
export interface MockRequestContext { request: Request; params: Readonly<Record<string, string>>; url: URL; signal: AbortSignal; respond(options?: MockResponseOptions): Response; }
/** @public */
export type MockResolver = (context: MockRequestContext) => Response | typeof PASSTHROUGH | void | Promise<Response | typeof PASSTHROUGH | void>;
/** @public */
export interface RestHandler { readonly kind: 'rest'; readonly method: string; readonly url: string | RegExp; readonly resolver: MockResolver; }
const method = (name: string) => (url: string | RegExp, resolver: MockResolver): RestHandler => ({ kind: 'rest', method: name, url, resolver });
/** @public */
export const rest = { get: method('GET'), post: method('POST'), put: method('PUT'), patch: method('PATCH'), delete: method('DELETE'), head: method('HEAD'), options: method('OPTIONS'), all: method('*') };
/** @internal */
export function matchURL(pattern: string | RegExp, url: URL): Record<string, string> | undefined {
  if (pattern instanceof RegExp) { const previous = pattern.lastIndex; try { pattern.lastIndex = 0; return pattern.test(url.href) ? {} : undefined; } finally { pattern.lastIndex = previous; } }
  let path = pattern;
  if (/^(?:https?|wss?):\/\//i.test(pattern)) { const absolute = new URL(pattern); if (absolute.origin !== url.origin) return undefined; path = absolute.pathname; }
  const keys: string[] = []; const escaped = path.split('/').map(segment => {
    if (segment.startsWith(':')) { keys.push(segment.slice(1)); return '([^/]+)'; }
    if (segment === '*') { keys.push('*'); return '(.*)'; }
    return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('/');
  const match = new RegExp(`^${escaped}/?$`).exec(url.pathname); if (!match) return undefined;
  const params: Record<string, string> = Object.create(null);
  try { keys.forEach((key, i) => { params[key] = decodeURIComponent(match[i + 1]!); }); } catch { return undefined; }
  return params;
}
/** Abort an asynchronous handler without leaving its eventual rejection unobserved. @internal */
export function raceAbort<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); const error = new Error('Aborted'); error.name = 'AbortError'; reject(error); };
    signal.addEventListener('abort', abort, { once: true });
    work.then(value => { signal.removeEventListener('abort', abort); if (!signal.aborted) resolve(value); }, error => { signal.removeEventListener('abort', abort); reject(error); });
    if (signal.aborted) abort();
  });
}
/** One response channel per resolver, including double callback/return protection. @internal */
export async function resolveRequest(handler: RestHandler, request: Request, params: Record<string, string>, signal: AbortSignal = request.signal): Promise<Response | typeof PASSTHROUGH> {
  if (signal.aborted) throw new DOMException('Mock request was cancelled.', 'AbortError');
  let sent: Response | undefined;
  const value = await raceAbort(Promise.resolve(handler.resolver({ request, url: new URL(request.url), params, signal, respond(options) { if (sent) throw createReservedError('ZEN-2531'); sent = respond(options); return sent; } })), signal);
  if (sent && value !== undefined && value !== sent) throw createReservedError('ZEN-2531');
  const response = value ?? sent; if (!response) throw new TypeError('Mock resolver must return a response or passthrough().'); return response;
}
