import type { SocketTransport, SseTransport } from '../src/types';

export class FakeSocket implements SocketTransport {
  readyState = 0;
  bufferedAmount = 0;
  onopen: WebSocket['onopen'] = null;
  onclose: WebSocket['onclose'] = null;
  onerror: WebSocket['onerror'] = null;
  onmessage: WebSocket['onmessage'] = null;
  sent: unknown[] = [];
  closes = 0;
  send(data: Parameters<WebSocket['send']>[0]): void { this.sent.push(data); }
  close(): void { this.closes++; this.readyState = 3; }
  open(): void { this.readyState = 1; (this.onopen as ((e: Event) => void) | null)?.(new Event('open')); }
  message(data: unknown): void { (this.onmessage as ((e: { data: unknown }) => void) | null)?.({ data }); }
  lost(): void { this.readyState = 3; (this.onclose as ((e: { code: number; reason: string }) => void) | null)?.({ code: 1006, reason: '' }); }
  fail(): void { (this.onerror as ((e: Event) => void) | null)?.(new Event('error')); }
}

export class FakeEventSource extends EventTarget implements SseTransport {
  readyState = 0;
  onopen: EventSource['onopen'] = null;
  onmessage: EventSource['onmessage'] = null;
  onerror: EventSource['onerror'] = null;
  closes = 0;
  close(): void { this.readyState = 2; this.closes++; }
  open(): void { this.readyState = 1; (this.onopen as ((e: Event) => void) | null)?.(new Event('open')); }
  message(data: unknown): void { (this.onmessage as ((e: { data: unknown }) => void) | null)?.({ data }); }
  fail(): void { (this.onerror as ((e: Event) => void) | null)?.(new Event('error')); }
}
