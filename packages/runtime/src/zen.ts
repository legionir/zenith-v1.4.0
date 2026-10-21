import { registerAction, unregisterAction, hasAction, clearActions, listActions, getActionMeta } from '@zenith/actions';
import { onError, emitError, getErrorHistory } from '@zenith/state';
import { navigate, routeSignal } from '@zenith/router';
import { notificationsAPI } from '@zenith/notifications';
import { auth } from './auth-api';
import type { ZenApi, ZenStartOptions, ZenithPlugin } from './api-types';
import type { ZenithError } from '@zenith/errors';
import { startRuntime } from './start';
import { stopRuntime } from './stop';
import { usePlugin, installedPluginNames } from './plugins';
import { cloakCSS, injectCloakStyle, removeCloakStyle } from './cloak';
import { createPerformanceMonitor } from './performance';
import { createFlush } from './flush';

/** The canonical legacy runtime singleton. @public */
export const Zen: ZenApi = /* @__PURE__ */ (() => ({
  onError,
  getErrors: getErrorHistory,
  reportError: (
    message: string,
    options: Partial<ZenithError> & { severity?: 'error' | 'warning' | 'info' } = {},
  ) => {
    emitError({
      message,
      category: options.category || 'Runtime',
      severity: options.severity || 'error',
      ...options,
    });
  },

  notify: notificationsAPI.notify,
  toasts: notificationsAPI.toasts,
  alert: notificationsAPI.alert,
  confirm: notificationsAPI.confirm,
  auth,
  start(root: HTMLElement, state: Record<string, unknown> = {}, options?: ZenStartOptions): void {
    startRuntime(Zen, { root, state, options });
  },
  stop(root: HTMLElement): void { stopRuntime(Zen, root); },
  action: Object.assign(
    (
      name: string,
      fn: (ctx: import('@zenith/actions').ActionContext) => void,
      metadata?: import('@zenith/actions').ActionMetadata,
    ) => registerAction(name, fn, metadata),
    {
      register: registerAction,
      unregister: unregisterAction,
      has: hasAction,
      clear: clearActions,
      list: listActions,
      getMeta: getActionMeta,
    },
  ),

  flushSync: createFlush(),
  navigate,
  route: routeSignal,
  use(plugin: ZenithPlugin, options?: unknown): ZenApi { return usePlugin(Zen, { plugin, options }); },
  plugins: installedPluginNames,
  cloakCSS,
  __injectCloakStyle(): boolean { return injectCloakStyle(Zen); },
  __removeCloakStyle: removeCloakStyle,
  perf: createPerformanceMonitor(),
}))();
