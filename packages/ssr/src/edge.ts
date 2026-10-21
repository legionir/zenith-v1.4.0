/**
 * Explicit-document SSR. This entry intentionally never imports the Node SSR
 * barrel, a DOM implementation, async-local storage or ambient DOM globals.
 * Async data loading belongs outside this synchronous, request-owned mount.
 * @packageDocumentation
 */
import { createApp, type App } from '@zenith/runtime-core';
import { createHead, renderHead, type HeadInput, type HeadManager } from '@zenith/head';
import { flushSync } from '@zenith/scheduler';
import { isReadable } from '@zenith/shared';
import { createReservedError } from '@zenith/errors';

/** @public */
export interface EdgeI18nInput { locale: string; dir?: 'rtl' | 'ltr'; messages?: Record<string, unknown>; }
/** @public */
export interface EdgeRenderContext {
  document: Document;
  state: Record<string, unknown>;
  head: HeadManager;
  route: string;
  signal?: AbortSignal;
  i18n?: EdgeI18nInput;
}
/** @public */
export interface EdgeRenderOptions {
  document: Document;
  app?: (context: EdgeRenderContext) => App;
  root?: string;
  route?: string;
  nonce?: string;
  head?: HeadInput;
  signal?: AbortSignal;
  serializeState?: boolean;
  i18n?: EdgeI18nInput;
}
/** @public */
export interface EdgeRenderResult { html: string; state: string; head: string; route: string; }
function scriptValue(value: string): string {
  return value.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
function applyAttributes(document: Document, element: Element, attributes: string): void {
  const holder = document.createElement('div'); holder.innerHTML = `<i${attributes}></i>`;
  for (const attr of Array.from(holder.firstElementChild?.attributes ?? [])) element.setAttribute(attr.name, attr.value);
}
/**
 * Render a pre-parsed, exclusively owned Document. All App work, head capture,
 * serialization and cleanup finish before the next request may enter the mount.
 * The caller owns document disposal; this function always owns the App factory.
 * @public
 */
export function renderToString(state: Record<string, unknown>, options: EdgeRenderOptions): EdgeRenderResult {
  const document = options.document; const route = options.route ?? '/';
  if (!document?.body || !document.head || !document.documentElement) throw createReservedError('ZEN-1812');
  if (options.signal?.aborted) throw options.signal.reason ?? createReservedError('ZEN-1811');
  const root = (options.root ? document.querySelector(options.root) : document.body.firstElementChild) as HTMLElement | null;
  if (!root) throw createReservedError('ZEN-1812');
  const descriptor = Object.getOwnPropertyDescriptor(document, '__zenithSSR__');
  Object.defineProperty(document, '__zenithSSR__', { value: true, configurable: true });
  const head = createHead({ nonce: options.nonce }); let app: App | undefined; let owner: App | undefined;
  try {
    if (options.head) head.push(options.head);
    if (options.i18n) head.push({ htmlAttrs: { lang: options.i18n.locale, dir: options.i18n.dir ?? (/^(fa|ar|he|ur|ps|ckb|sd|ug|yi)\b/i.test(options.i18n.locale) ? 'rtl' : 'ltr') } });
    const context: EdgeRenderContext = { document, state, head, route, signal: options.signal, i18n: options.i18n };
    owner = createApp({ state });
    const requestOwner = owner;
    app = requestOwner.run(() => options.app ? options.app(context) : requestOwner);
    if (!app || typeof app.run !== 'function' || typeof app.dispose !== 'function') throw createReservedError('ZEN-1811');
    const ownedApp = app;
    return ownedApp.run(() => {
      if (!ownedApp.inject<HeadManager>('zenith:head')) ownedApp.provide('zenith:head', head);
      ownedApp.mount(root, state); flushSync();
      if (options.signal?.aborted) throw options.signal.reason ?? createReservedError('ZEN-1811');
      const appHead = ownedApp.inject<HeadManager>('zenith:head');
      if (appHead && appHead !== head) head.push(() => appHead.resolve());
      const output = renderHead(head);
      document.head.insertAdjacentHTML('beforeend', output.headTags);
      applyAttributes(document, document.documentElement, output.htmlAttrs); applyAttributes(document, document.body, output.bodyAttrs);
      const snapshot: Record<string, unknown> = Object.create(null);
      if (options.serializeState !== false) for (const [key, value] of Object.entries(state)) snapshot[key] = isReadable(value) ? value.get() : value;
      const json = scriptValue(JSON.stringify(snapshot, (_key, value: unknown) => typeof value === 'function' ? undefined : isReadable(value) ? value.get() : value));
      const script = document.createElement('script'); if (options.nonce) script.setAttribute('nonce', options.nonce);
      const i18n = options.i18n ? `window.__ZENITH_I18N__=${scriptValue(JSON.stringify(options.i18n))};` : '';
      script.textContent = `window.__ZENITH_STATE__=${json};window.__ZENITH_ROUTE__=${scriptValue(JSON.stringify(route))};${i18n}`;
      document.head.appendChild(script);
      return { html: `<!DOCTYPE html>${document.documentElement.outerHTML}`, state: json, head: output.headTags, route };
    });
  } finally {
    try { if (typeof app?.dispose === 'function') app.dispose(); } finally {
      try { if (owner !== app) owner?.dispose(); } finally {
        try { head.dispose(); } finally {
          if (descriptor) Object.defineProperty(document, '__zenithSSR__', descriptor); else Reflect.deleteProperty(document, '__zenithSSR__');
        }
      }
    }
  }
}

export { cloneRequestState, type RequestStateOptions } from './request-state';
