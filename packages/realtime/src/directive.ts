import { effect, signal, untrack } from '@zenith/state';
import { evaluateExpression, createBindingContext } from '@zenith/expressions';
import { parseConfigAttr, s } from '@zenith/schema';
import { createReservedError } from '@zenith/errors';
import { createDisposer, parseDuration, type Cleanup } from '@zenith/shared';
import { createRealtime } from './realtime';
import { validateRealtimeOptions, DEFAULTS } from './options';
import type { RealtimeOptions, RealtimeStatus } from './types';

/** @public */
export interface RealtimeViewState {
  status: RealtimeStatus;
  message: unknown;
  messages: readonly unknown[];
  error: unknown;
}
/** Structural BindContext keeps this L2 package independent of runtime-core. @public */
export interface RealtimeBindContext {
  expr: string;
  attrName: string;
  context: Record<string, unknown>;
  state?: Record<string, unknown>;
  processChildren(node: HTMLElement, extraContext?: Record<string, unknown>): void;
  options?: Omit<RealtimeOptions, 'url' | 'transport'>;
  /** Optional owner hook, including automatic DOM-removal cleanup. */
  onDispose?(): void;
}
/** @public */
export const realtimeAttributeOptionsSchema = s.custom<Partial<RealtimeOptions>>(value =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value) && validateRealtimeOptions({ ...value, url: 'wss://localhost', transport: 'ws' })), 'Realtime attribute options');
const bindings = new WeakMap<HTMLElement, Cleanup>();
function invalid() { return createReservedError('ZEN-1001', { details: { expected: 'valid realtime attributes' } }); }

/**
 * Bind zen-ws/zen-sse with a scoped state signal, filtered topics and DOM events.
 * No server connection; cleanup owns effects, observers, subscriptions and client.
 * @public
 */
export function bindRealtime(el: HTMLElement, context: RealtimeBindContext): Cleanup {
  if (typeof window === 'undefined') return () => {};
  bindings.get(el)?.();
  const cleanup = createDisposer();
  let disposed = false;
  const release = () => {
    if (disposed) return;
    disposed = true;
    if (bindings.get(el) === release) bindings.delete(el);
    try { cleanup.dispose(); } finally { context.onDispose?.(); }
  };
  try {
    const transport = context.attrName === 'zen-sse' ? 'sse' : 'ws';
    const stateName = el.getAttribute('zen-state') ?? 'data';
    if (!/^[a-zA-Z_$][\w$]*$/.test(stateName) || ['__proto__', 'prototype', 'constructor'].includes(stateName)) throw invalid();
    let json: Partial<RealtimeOptions>;
    try { json = parseConfigAttr(el, 'zen-realtime-options', realtimeAttributeOptionsSchema); }
    catch { throw invalid(); } // No raw JSON/URL/token in diagnostics.
    const options = { ...context.options, ...json };
    const reconnect = el.getAttribute('zen-realtime-reconnect');
    if (reconnect !== null) {
      if (reconnect === 'false') options.reconnect = false;
      else if (reconnect === '' || reconnect === 'true') options.reconnect = true;
      else {
        const duration = parseDuration(reconnect);
        if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) throw invalid();
        options.reconnect = { ...(typeof options.reconnect === 'object' ? options.reconnect : {}), delay: duration };
      }
    }
    const protocols = el.getAttribute('zen-realtime-protocols');
    if (protocols !== null) options.protocols = protocols.split(',').map(value => value.trim()).filter(Boolean);
    const parse = el.getAttribute('zen-realtime-parse');
    if (parse !== null) { if (parse !== 'json' && parse !== 'text') throw invalid(); options.parse = parse; }
    const history = el.getAttribute('zen-realtime-history');
    if (history !== null) { if (history.trim() === '') throw invalid(); options.history = Number(history); }
    const evaluationContext = createBindingContext(context.state ?? {}, context.context);
    const raw = context.expr.trim();
    const value = /^(?:wss?|https?):\/\//i.test(raw) ? raw : evaluateExpression(raw, evaluationContext);
    if (typeof value !== 'string' || !value) throw invalid();
    const client = createRealtime({ ...options, url: value, transport, autoConnect: false });
    cleanup.add(client);
    const topic = el.getAttribute('zen-realtime-topic');
    const filteredMessage = signal<unknown>(null);
    const filteredMessages = signal<readonly unknown[]>([]);
    const output = signal<RealtimeViewState>({ status: 'idle', message: null, messages: [], error: null });
    cleanup.add(() => { output.dispose(); filteredMessage.dispose(); filteredMessages.dispose(); });
    const emit = (event: string, detail: unknown) => {
      if (!disposed && el.ownerDocument.defaultView) el.dispatchEvent(new el.ownerDocument.defaultView.CustomEvent(`zen-realtime-${event}`, { detail, bubbles: true }));
    };
    for (const event of ['open', 'close', 'error'] as const) cleanup.add(client.on(event, value => emit(event, value)));
    cleanup.add(client.subscribe(topic ?? '*', data => {
      if (disposed) return;
      if (topic !== null) {
        filteredMessage.set(data);
        const limit = options.history ?? DEFAULTS.history;
        filteredMessages.set(limit === 0 ? [] : [...filteredMessages.get(), data].slice(-limit));
      }
      emit('message', data);
    }));
    cleanup.add(effect(() => output.set({
      status: client.status.get(), error: client.error.get(),
      message: topic === null ? client.lastMessage.get() : filteredMessage.get(),
      messages: topic === null ? client.messages.get() : filteredMessages.get(),
    })));
    const send = el.getAttribute('zen-realtime-send');
    if (send) cleanup.add(effect(() => {
      const data = evaluateExpression(send, evaluationContext);
      if (data !== undefined) untrack(() => client.send(data));
    }));
    // Consume only the binding attributes; scoped state is not JSON zen-state.
    el.removeAttribute(context.attrName); el.removeAttribute('zen-state');
    context.processChildren(el, { [stateName]: output });
    if (disposed) return release;
    const Observer = el.ownerDocument.defaultView?.MutationObserver;
    if (Observer && el.ownerDocument.documentElement) {
      let connected = el.isConnected;
      const observer = new Observer(() => {
        if (el.isConnected) connected = true;
        else if (connected) release();
      });
      observer.observe(el.ownerDocument.documentElement, { childList: true, subtree: true });
      cleanup.add(() => observer.disconnect());
    }
    bindings.set(el, release);
    if (options.autoConnect ?? true) client.open();
    return release;
  } catch (error) { try { release(); } catch { /* retain original bind error */ } throw error; }
}
