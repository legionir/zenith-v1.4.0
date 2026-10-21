import type { Cleanup, Disposable, Readable } from '@zenith/shared';

/** @public */
export type RealtimeStatus = 'idle' | 'connecting' | 'open' | 'closing' | 'closed' | 'error';
/** @public */
export type RealtimeEvent = 'open' | 'message' | 'close' | 'error';
/** Injectable browser-compatible WebSocket. @public */
export type SocketTransport = Pick<WebSocket, 'readyState' | 'bufferedAmount' | 'onopen' | 'onerror' | 'onmessage' | 'onclose' | 'send' | 'close'>;
/** Injectable browser-compatible EventSource. @public */
export type SseTransport = Pick<EventSource, 'readyState' | 'onopen' | 'onerror' | 'onmessage' | 'close' | 'addEventListener' | 'removeEventListener'>;
/** A deterministic non-security scheduling source. Handles are opaque. @public */
export interface RealtimeClock {
  setTimeout(callback: () => void, delay: number): unknown;
  clearTimeout(handle: unknown): void;
  random(): number;
}
/** @public */
export interface ReconnectOptions {
  /** @default Infinity */ retries?: number;
  /** @default 1000 @unit ms */ delay?: number;
  /** @default 2 */ factor?: number;
  /** @default 0.3 */ jitter?: number;
  /** @default 30000 @unit ms */ maxDelay?: number;
}
/** @public */
export interface RealtimeOptions<T = unknown> {
  url: string | (() => string);
  /** @default ws */ transport?: 'ws' | 'sse';
  protocols?: string[];
  /** SSR never auto-connects. Explicit open() is permitted on the server. @default true */ autoConnect?: boolean;
  /** @default false */ allowInsecure?: boolean;
  reconnect?: boolean | ReconnectOptions;
  heartbeat?: false | { interval: number; timeout: number; message: unknown };
  /** @default json */ parse?: 'json' | 'text' | ((raw: string) => T);
  serialize?: (data: unknown) => string | ArrayBuffer;
  auth?: () => string | Promise<string>;
  /** Query auth is only used with this explicit opt-in. @default first-message */ authMode?: 'first-message' | 'subprotocol' | 'query';
  queue?: { maxSize?: number; whileDisconnected?: 'buffer' | 'drop' };
  /** @default 50 */ history?: number;
  /** @default 1048576 @unit bytes */ maxMessageSize?: number;
  /** Native WebSocket bufferedAmount ceiling. @default 1048576 @unit bytes */ maxBufferedAmount?: number;
  signal?: AbortSignal;
  withCredentials?: boolean;
  webSocketFactory?: (url: string, protocols: string[]) => SocketTransport;
  eventSourceFactory?: (url: string, options: EventSourceInit) => SseTransport;
  clock?: RealtimeClock;
}
/** @public */
export interface Realtime<T = unknown> extends Disposable {
  readonly status: Readable<RealtimeStatus>;
  readonly lastMessage: Readable<T | null>;
  readonly messages: Readable<readonly T[]>;
  readonly error: Readable<unknown>;
  open(): void;
  close(code?: number, reason?: string): void;
  send(data: unknown): void;
  subscribe(topic: string, callback: (data: T) => void): Cleanup;
  on(event: RealtimeEvent, callback: (value: unknown) => void): Cleanup;
}
