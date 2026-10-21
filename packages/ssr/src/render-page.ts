// packages/ssr/src/render-page.ts
//
// اسکریپت hydration و صفحه کامل — استخراج مکانیکی از render.ts،
// بدون تغییر رفتار (#40).

import { logger } from '@zenith/logger';
import { safeScriptValue, isRouteSafe, type SSRResult } from './render-serialize';


export function generateHydrationScript(result: SSRResult, nonce?: string): string {
  const nonceAttr = nonce ? ` nonce="${nonce.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"` : '';
  // SEC FIX (v1.2.6): SEC-A1 — apply safeScriptValue to BOTH state AND route,
  // and reject unsafe routes (containing `</`) before emitting them.
  const safeState = safeScriptValue(result.state || '{}');
  let routePart = '';
  if (result.route) {
    if (!isRouteSafe(result.route)) {
      // Drop the route entirely instead of emitting something that could break out.
      logger.error(
        '[Zenith SSR] Refusing to embed unsafe route (contains `</`) in hydration script.',
      );
    } else {
      routePart = `window.__ZENITH_ROUTE__=${safeScriptValue(JSON.stringify(result.route))};`;
    }
  }
  const i18nPart = result.i18n ? `window.__ZENITH_I18N__=${result.i18n};` : '';
  return `<script${nonceAttr}>window.__ZENITH_STATE__=${safeState};${routePart}${i18nPart}</script>`;
}

export function generateFullPage(result: SSRResult, head = '', nonce?: string): string {
  const htmlAttrs = result.htmlAttrs ?? '';
  const bodyAttrs = result.bodyAttrs ?? '';
  const combinedHead = `${result.headTags ?? ''}${head}`;
  return `<!DOCTYPE html><html${htmlAttrs}><head><meta charset="UTF-8">${combinedHead}${generateHydrationScript(result, nonce)}</head><body${bodyAttrs}>${result.html}</body></html>`;
}
