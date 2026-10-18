import { createRealtime as createClient } from './realtime';
import { injectRealtimeMessage } from './testing';
import type { Realtime, RealtimeOptions } from './types';
export type { RealtimeOptions, RealtimeStatus } from './types';
/** @deprecated Import Realtime from @zenith/realtime. @public */
export interface RealtimeClient<T = unknown> extends Realtime<T> {
  /** @deprecated Use @zenith/realtime/testing; this never opens a connection. */
  receiveMockMessage(data: T, topic?: string): void;
}
/** @deprecated Import from @zenith/realtime. Raw string send behavior is preserved. @public */
export function createRealtime<T = unknown>(options: RealtimeOptions<T>): RealtimeClient<T> {
  const client = createClient<T>({ ...options, parse: options.parse ?? 'text', serialize: options.serialize ?? (data => typeof data === 'string' ? data : JSON.stringify(data)) });
  return Object.assign(client, { receiveMockMessage: (data: T, topic = '*') => injectRealtimeMessage(client, data, topic) });
}
/** @deprecated Import from @zenith/realtime. @public */
export function createWebSocket<T = unknown>(url: string, options: Omit<RealtimeOptions<T>, 'url' | 'transport'> = {}): RealtimeClient<T> { return createRealtime({ ...options, url, transport: 'ws' }); }
/** @deprecated Import from @zenith/realtime. @public */
export function createSSE<T = unknown>(url: string, options: Omit<RealtimeOptions<T>, 'url' | 'transport'> = {}): RealtimeClient<T> { return createRealtime({ ...options, url, transport: 'sse' }); }
