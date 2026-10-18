import type { ZenApi, ZenithPlugin } from './api-types';
import { logger } from '@zenith/logger';
import { isDevMode } from './dev-mode';
const pluginRegistry = /* @__PURE__ */ new Map<string, ZenithPlugin>();
const pluginInstallLocks = /* @__PURE__ */ new Map<string, Promise<void>>();


/** Private plugin installation; synchronous legacy timing is retained. @internal */
export function usePlugin(api: ZenApi, input: { plugin: ZenithPlugin; options?: unknown }): ZenApi {
  const { plugin, options } = input;
    if (!plugin || typeof plugin.install !== 'function') {
      logger.warn('[Zenith] Zen.use: plugin must have an install() method.');
      return api;
    }
    const pluginName = plugin.name;

    // Fast path: already installed
    if (pluginRegistry.has(pluginName)) {
      if (isDevMode()) {
        logger.warn(`[Zenith] Plugin "${pluginName}" is already installed. Skipping.`);
      }
      return api;
    }

    try {
      plugin.install(api, options);
      pluginRegistry.set(pluginName, plugin);
      if (isDevMode()) {
        logger.info(`🔌 Zenith plugin installed: ${pluginName}`);
      }
    } catch (err) {
      logger.error(
        `[Zenith] Plugin "${pluginName}" failed to install: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return api; // برای chaining: Zen.use(a).use(b)
  }

/** @internal */
export function installedPluginNames(): string[] { return Array.from(pluginRegistry.keys()); }
/** @internal */
export function clearPluginInstallLocks(): void { pluginInstallLocks.clear(); }
