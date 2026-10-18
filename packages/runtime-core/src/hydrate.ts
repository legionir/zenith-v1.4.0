import { isReadable } from '@zenith/shared';
import { isWritable, signal } from '@zenith/state';
import { createReservedError } from '@zenith/errors';
import type { AppOptions, HydrationResult, HydrationMismatch } from './types';
import { createApp } from './app';
import { ownAppCleanup } from './scope';
import { handleAppError } from './errors';
import { createEvalContext, evalExpr } from './directives/shared';

/** @public */
export async function hydrate(
  root: HTMLElement,
  init: Record<string, unknown> | AppOptions = {},
): Promise<HydrationResult> {
  const isAppOpts =
    'state' in init ||
    'plugins' in init ||
    'ssr' in init ||
    'idPrefix' in init ||
    'errorHandler' in init ||
    'warnHandler' in init;

  const appOpts: AppOptions = isAppOpts
    ? (init as AppOptions)
    : { state: init as Record<string, unknown>, ssr: { preloadState: true, validateHydration: true } };

  const app = createApp(appOpts);
  try {
  const state: Record<string, unknown> = { ...(app.config.state ?? {}) };
  const mismatches: HydrationMismatch[] = [];

  // بررسی state سریال‌شده از سرور (#zenith-state) و نشانگرهای data-zen-h
  const doc = root.ownerDocument;
  if (app.config.ssr.preloadState && doc) {
    const stateEl = doc.getElementById('zenith-state');
    if (stateEl && stateEl.textContent) {
      try {
        const decoded: unknown = JSON.parse(stateEl.textContent);
        if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) throw createReservedError('ZEN-1001', { details: { expected: 'hydration state object' } });
        const serverState = Object.fromEntries(Object.entries(decoded).filter(([key]) => !['__proto__', 'constructor', 'prototype'].includes(key)));
        if (app.config.ssr.validateHydration) {
          for (const [k, serverVal] of Object.entries(serverState)) {
            if (k in state) {
              const value = state[k];
              const clientRaw = isReadable(value) ? value.get() : value;
              if (JSON.stringify(clientRaw) !== JSON.stringify(serverVal)) {
                mismatches.push({ path: `state.${k}`, expected: serverVal, actual: clientRaw });
              }
            }
          }
        }
        for (const [k, serverVal] of Object.entries(serverState)) {
          const value = state[k];
          if (k in state && isWritable(value)) {
            Reflect.apply(value.set, value, [serverVal]);
          } else if (!(k in state)) {
            const value = signal(serverVal); state[k] = value; ownAppCleanup(app, () => value.dispose());
          }
        }
      } catch (err) {
        handleAppError(app, err);
      }
    }
  }

  // بررسی نشانگرهای data-zen-h روی المان‌های دارای zen-text
  const markedElements = Array.from(root.querySelectorAll('[data-zen-h]')) as HTMLElement[];
  for (const el of markedElements) {
    const markerId = el.getAttribute('data-zen-h') ?? '';
    const textExpr = el.getAttribute('zen-text');
    if (textExpr) {
      const evalCtx = createEvalContext(state, {});
      const expectedVal = evalExpr(textExpr, evalCtx, app);
      const expectedText =
        expectedVal === undefined || expectedVal === null ? '' : String(expectedVal);
      const actualText = el.textContent ?? '';
      if (expectedText !== actualText) {
        mismatches.push({
          path: markerId || textExpr,
          expected: expectedText,
          actual: actualText,
        });
      }
    }
  }

  if (mismatches.length > 0) {
    const mismatchErr = createReservedError('ZEN-2310', {
      details: { mismatches },
    });
    if ((globalThis as { __ZENITH_DEV__?: boolean }).__ZENITH_DEV__ !== false) {
      if (app.config.warnHandler) {
        app.config.warnHandler(mismatchErr.message, { mismatches });
      } else {
        app.config.logger.warn(mismatchErr.message, { mismatches });
      }
    }
    if (app.config.errorHandler) {
      app.config.errorHandler(mismatchErr);
    }
  }

  app.mount(root, state);
  const cleanup = () => app.dispose();
  return {
    app,
    cleanup,
    hydrated: true,
    mismatches,
  };
  } catch (error) { try { app.dispose(); } catch { /* preserve hydration failure */ } throw error; }
}

/** @public */
export const startFromSSR = hydrate;

