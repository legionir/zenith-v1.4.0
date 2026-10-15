// packages/zenith/src/presets/spa.ts
//
// `zenith/presets/spa` (#149, SPEC §2.9):
// minimal + router, http, resource, store, form, error-boundary, notifications, i18n

import {
  createApp,
  definePlugin,
  type App,
  type AppOptions,
  type Plugin,
} from '@zenith/runtime-core';
import { minimalPreset } from './minimal';
import * as router from '@zenith/router';
import * as http from '@zenith/http';
import * as resource from '@zenith/resource';
import * as store from '@zenith/store';
import * as form from '@zenith/form';
import * as errorBoundary from '@zenith/error-boundary';
import * as notifications from '@zenith/notifications';
import * as i18n from '@zenith/i18n';

export const PRESET_SPA_MODULES = /* @__PURE__ */ Object.freeze([
  'runtime-core',
  'events',
  'security',
  'router',
  'http',
  'resource',
  'store',
  'form',
  'error-boundary',
  'notifications',
  'i18n',
] as const);

export const spaPreset: Plugin = /* @__PURE__ */ definePlugin({
  name: 'zenith:preset:spa',
  install(app: App) {
    app.use(minimalPreset);
    app.provide('zenith:preset', 'spa');
    app.provide('zenith:router', router);
    app.provide('zenith:http', http);
    app.provide('zenith:resource', resource);
    app.provide('zenith:store', store);
    app.provide('zenith:form', form);
    app.provide('zenith:errorBoundary', errorBoundary);
    app.provide('zenith:notifications', notifications);
    app.provide('zenith:i18n', i18n);
  },
});

export function createSpaApp(options?: AppOptions): App {
  const app = createApp(options);
  app.use(spaPreset);
  return app;
}

export {
  createApp,
  definePlugin,
  minimalPreset,
  router,
  http,
  resource,
  store,
  form,
  errorBoundary,
  notifications,
  i18n,
  type App,
  type AppOptions,
};
