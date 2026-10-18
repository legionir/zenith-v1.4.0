import { logger } from '@zenith/logger';
import { createReservedError } from '@zenith/errors';
import type { Cleanup } from '@zenith/shared';
import { matchURL } from './http';
import { patch } from './patch';
/** @public */
export interface MockSocketClient { send(data: string): void; close(code?: number, reason?: string): void; addEventListener(type: 'message', listener: (event: MessageEvent) => void): void; removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void; }
/** @public */
export interface SocketHandler { readonly kind: 'ws'; readonly url: string | RegExp; on(type: 'connection', listener: (context: { client: MockSocketClient; url: URL }) => void): Cleanup; readonly listeners: ReadonlySet<(context: { client: MockSocketClient; url: URL }) => void>; }
/** @public */
export const ws = { link(url: string | RegExp): SocketHandler { const listeners = new Set<(context: { client: MockSocketClient; url: URL }) => void>(); return { kind: 'ws', url, listeners, on(type, listener) { if (type !== 'connection') throw new TypeError('Invalid mock socket event.'); const owned: typeof listener = context => listener(context); listeners.add(owned); return () => { listeners.delete(owned); }; } }; } };
/** @internal */
export function socketPatch(handlers: () => readonly SocketHandler[], sockets: Set<() => void>, onUnhandled: () => 'error' | 'warn' | 'bypass', target: typeof globalThis = globalThis, onWarning: () => void = () => logger.warn('Unhandled mock WebSocket.')): Cleanup {
  return patch(target, 'WebSocket', original => {
    const Native = original as typeof WebSocket | undefined;
    return class MockWebSocket extends EventTarget {
      static readonly CONNECTING = 0; static readonly OPEN = 1; static readonly CLOSING = 2; static readonly CLOSED = 3;
      readonly CONNECTING = 0; readonly OPEN = 1; readonly CLOSING = 2; readonly CLOSED = 3;
      readonly url: string; readonly protocol = ''; readonly extensions = ''; bufferedAmount = 0; readyState = 0; binaryType: BinaryType = 'blob';
      onopen: ((event: Event) => void) | null = null; onclose: ((event: CloseEvent) => void) | null = null; onerror: ((event: Event) => void) | null = null; onmessage: ((event: MessageEvent) => void) | null = null;
      private peer = new EventTarget(); private release: () => void = () => {};
      constructor(value: string | URL, protocols?: string | string[]) {
        super(); const url = new URL(String(value), target.location?.href ?? 'http://localhost'); if (url.protocol === 'http:') url.protocol = 'ws:'; if (url.protocol === 'https:') url.protocol = 'wss:'; if (!['ws:', 'wss:'].includes(url.protocol) || url.hash || url.username || url.password) throw new DOMException('Invalid WebSocket URL.', 'SyntaxError'); this.url = url.href;
        const offered = typeof protocols === 'string' ? [protocols] : protocols ?? []; if (offered.some(protocol => !/^[!#$%&'*+.^_`|~0-9a-z-]+$/i.test(protocol)) || new Set(offered).size !== offered.length) throw new DOMException('Invalid WebSocket protocols.', 'SyntaxError');
        const handler = handlers().find(candidate => matchURL(candidate.url, url) !== undefined);
        if (!handler) { const mode = onUnhandled(); if (mode === 'warn') { try { onWarning(); } catch {} } if (mode !== 'error' && Native) return new Native(value, protocols) as unknown as MockWebSocket; throw createReservedError('ZEN-2530'); }
        this.release = () => this.close(1000, 'Mock server closed'); sockets.add(this.release);
        queueMicrotask(() => {
          if (this.readyState !== 0) return; this.readyState = 1;
          const client: MockSocketClient = { send: data => { queueMicrotask(() => { if (this.readyState !== 1) return; const message = new MessageEvent('message', { data }); this.dispatchEvent(message); this.onmessage?.(message); }); }, close: (code, reason) => this.finishClose(code, reason), addEventListener: (name, callback) => this.peer.addEventListener(name, callback as EventListener), removeEventListener: (name, callback) => this.peer.removeEventListener(name, callback as EventListener) };
          try { for (const listener of [...handler.listeners]) { if (this.readyState !== 1) break; listener({ client, url }); } } catch { const error = new Event('error'); this.dispatchEvent(error); this.onerror?.(error); this.finishClose(1011, 'Mock handler failed'); }
          if (this.readyState === 1) { const opened = new Event('open'); this.dispatchEvent(opened); this.onopen?.(opened); }
        });
      }
      send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void { if (this.readyState !== 1) throw new DOMException('WebSocket is not open.', 'InvalidStateError'); this.peer.dispatchEvent(new MessageEvent('message', { data })); }
      close(code = 1000, reason = ''): void { if (!(code === 1000 || Number.isInteger(code) && code >= 3000 && code <= 4999)) throw new DOMException('Invalid WebSocket close code.', 'InvalidAccessError'); if (new TextEncoder().encode(reason).length > 123) throw new DOMException('WebSocket close reason is too long.', 'SyntaxError'); this.finishClose(code, reason); }
      private finishClose(code = 1000, reason = ''): void { if (this.readyState >= 2) return; this.readyState = 2; this.peer = new EventTarget(); sockets.delete(this.release); queueMicrotask(() => { this.readyState = 3; const event = new Event('close') as CloseEvent; Object.defineProperties(event, { code: { value: code }, reason: { value: reason }, wasClean: { value: true } }); this.dispatchEvent(event); this.onclose?.(event); }); }
    };
  });
}
