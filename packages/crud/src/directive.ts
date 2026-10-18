import { CrudEngine } from './engine';
import type { CrudEngineConfig } from './types';
import { logger } from '@zenith/logger';
import { parseJsonValue } from '@zenith/schema/attr';

/**
 * پردازش دایرکتیو `zen-crud`.
 *
 * این تابع توسط runtime walker (یا کاربر به‌صورت دستی) فراخوانی می‌شود
 * وقتی عنصری با attribute `zen-crud` پیدا می‌شود.
 *
 * @param el         عنصری که zen-crud روی آن تعریف شده.
 * @param configAttr مقدار attribute: یا یک JSON string یا یک `$variableName`
 *                   که به یک CrudEngineConfig در context اشاره می‌کند.
 * @param context    Context فعلی (شامل $<name> keys).
 * @returns تابع dispose برای پاکسازی.
 */
export function processCrud(
  el: HTMLElement,
  configAttr: string,
  context: Record<string, unknown>,
): () => void {
  // SSR safety
  if (typeof document === 'undefined') {
    return () => {};
  }

  // ── Parse configAttr ──
  let config: CrudEngineConfig;
  const trimmed = configAttr.trim();

  if (trimmed.startsWith('$')) {
    // حالت $variableName: از context بخوان.
    // Context کلیدها را به‌صورت $<name> دارد (ساختار createContext).
    const varName = trimmed.slice(1);
    // Legacy context bindings are caller-owned configurations, not JSON decoders.
    // The existing validation below and constructor still own runtime errors.
    config = (context[`$${varName}`] ?? context[varName]) as CrudEngineConfig;
    if (!config) {
      logger.error(
        `[CrudEngine] Config variable "${trimmed}" not found in context. ` +
          `Available keys: ${Object.keys(context).join(', ')}`,
      );
      return () => {};
    }
  } else {
    // حالت JSON string — #120: از helper مشترک `@zenith/schema` استفاده می‌شود
    // (کد خطای ZEN-1003 در پیام؛ بدون `JSON.parse` مستقیم روی attribute).
    const parsed = parseJsonValue<CrudEngineConfig>(trimmed, {
      onError: (err) => logger.error(`[CrudEngine] ${err.message}`),
    });
    if (parsed === null || typeof parsed !== 'object') {
      logger.error('[CrudEngine] Invalid JSON config: expected a JSON object.');
      return () => {};
    }
    config = parsed as CrudEngineConfig;
  }

  // ── Validation ──
  if (!config || typeof config !== 'object' || !config.resource) {
    logger.error(`[CrudEngine] Invalid config: missing "resource" property.`);
    return () => {};
  }

  // ── Create engine and render ──
  let engine: CrudEngine;
  try {
    engine = new CrudEngine(config, el);
  } catch (e) {
    logger.error(
      `[CrudEngine] Failed to create engine: ${e instanceof Error ? e.message : String(e)}`,
    );
    return () => {};
  }

  engine.render();

  // Return dispose function.
  return () => {
    try {
      engine.dispose();
    } catch (e) {
      logger.error(
        `[CrudEngine] Error during dispose: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };
}
