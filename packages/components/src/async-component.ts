// packages/components/src/async-component.ts
//
// پردازش عنصر کامپوننت ناهمگام (`processAsyncComponent`) — استخراج مکانیکی
// از async-loader.ts بدون تغییر رفتار (#40، code-first: نوشته‌شده، اجرا نشده).

import { logger } from '@zenith/logger';
import { registerComponent } from './registry';
import { escapeHTML, loadComponent } from './async-loader';


/**
 * Signature of the walker-supplied `processChildren` callback. Mirrors the
 * shape used by `processComponent` in `./processor.ts`.
 * @public
 */
export type AsyncProcessChildren = (
  el: HTMLElement,
  context: Record<string, unknown>,
  disposes: (() => void)[],
) => void;

/**
 * Process an element that loads its content from a remote component URL.
 *
 * The element must carry a `src` attribute pointing to an HTML file with a
 * `<template>`. While loading, a `data-zenith-async-state="loading"`
 * attribute is set on the element. On success, the template content is
 * cloned into the element and `processChildren` is called to bind it. On
 * failure, an error message is rendered inside the element.
 *
 * @param el              The host element.
 * @param context         The current reactive context.
 * @param processChildren Walker-supplied callback for binding the loaded subtree.
 * BUG-COM-02 (v1.3.0): The returned dispose function now aborts the
 * in-flight fetch via AbortController, preventing stale registrations
 * and memory leaks when the host element is removed from the DOM before
 * the load finishes.
 *
 * @returns Dispose function — aborts in-flight fetch and cleans up.
 * @public
 */
export function processAsyncComponent(
  el: HTMLElement,
  context: Record<string, unknown>,
  processChildren: AsyncProcessChildren,
): () => void {
  const src = el.getAttribute('src');
  if (!src) {
    // #39: لاگر مرکزی؛ گارد موجودیت console دیگر لازم نیست (مسیر مستقیم console فقط در consoleSink است).
    logger.warn('[Zenith async-loader] <zen-async-component> without src attribute.');
    return () => {};
  }

  el.setAttribute('data-zenith-async-state', 'loading');

  const localDisposes: (() => void)[] = [];

  // BUG-COM-02 (v1.3.0): AbortController to cancel the fetch on dispose.
  const abortController = typeof AbortController !== 'undefined' ? new AbortController() : null;

  // Kick off the load asynchronously.
  loadComponent(src, abortController?.signal)
    .then((template) => {
      el.removeAttribute('data-zenith-async-state');
      // Clone the template content into the host element.
      const clone = template.content.cloneNode(true);
      if (typeof el.appendChild === 'function') {
        el.appendChild(clone);
      }
      // Optionally register the component by its tag name so future
      // <tag-name> uses don't need to re-fetch.
      const tagName = el.getAttribute('data-name');
      if (tagName && typeof registerComponent === 'function') {
        try {
          registerComponent(tagName, template);
        } catch {
          // Already registered — ignore.
        }
      }
      try {
        processChildren(el, context, localDisposes);
      } catch (err) {
        logger.error(
          `[Zenith async-loader] processChildren failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    })
    .catch((err: Error) => {
      el.setAttribute('data-zenith-async-state', 'error');
      if (typeof el.innerHTML !== 'undefined') {
        el.innerHTML = `<div class="zenith-async-error">${escapeHTML(err.message || String(err))}</div>`;
      }
    });

  // BUG-COM-02 (v1.3.0): The returned dispose function aborts any
  // in-flight fetch and then cleans up local disposes. Previously
  // the fetch would complete and register the component even after
  // the host element was removed — now it's cancelled at the HTTP
  // level.
  return () => {
    if (abortController) {
      try {
        abortController.abort();
      } catch {
        /* noop */
      }
    }
    for (const d of localDisposes) {
      try {
        d();
      } catch {
        /* noop */
      }
    }
    localDisposes.length = 0;
  };
}