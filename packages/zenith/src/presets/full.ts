// packages/zenith/src/presets/full.ts
//
// `zenith/presets/full` (#149, SPEC §2.9):
// spa + all L2 capabilities (auth, cache, storage, jalali, components, suspense, transition, actions)

import {
  createApp,
  definePlugin,
  type App,
  type AppOptions,
  type Plugin,
} from '@zenith/runtime-core';
import { spaPreset } from './spa';
import * as auth from '@zenith/auth';
import * as cache from '@zenith/cache';
import * as storage from '@zenith/storage';
import * as jalali from '@zenith/jalali';
import * as components from '@zenith/components';
import * as suspense from '@zenith/suspense';
import * as transition from '@zenith/transition';
import * as actions from '@zenith/actions';
import { a11yPlugin } from '@zenith/a11y';
import { headPlugin } from '@zenith/head';
import { uiPlugin } from '@zenith/ui';

export const PRESET_FULL_MODULES = /* @__PURE__ */ Object.freeze([
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
  'auth',
  'cache',
  'storage',
  'jalali',
  'components',
  'suspense',
  'transition',
  'actions',
  'a11y',
  'head',
  'ui',
] as const);

export const fullPreset: Plugin = /* @__PURE__ */ definePlugin({
  name: 'zenith:preset:full',
  install(app: App) {
    app.use(spaPreset);
    app.use(a11yPlugin());
    app.use(headPlugin());
    app.use(uiPlugin());
    app.provide('zenith:preset', 'full');
    app.provide('zenith:auth', auth);
    app.provide('zenith:cache', cache);
    app.provide('zenith:storage', storage);
    app.provide('zenith:jalali', jalali);
    app.provide('zenith:components', components);
    app.provide('zenith:suspense', suspense);
    app.provide('zenith:transition', transition);
    app.provide('zenith:actions', actions);
  },
});

export function createFullApp(options?: AppOptions): App {
  const app = createApp(options);
  app.use(fullPreset);
  return app;
}

export {
  createApp,
  definePlugin,
  spaPreset,
  auth,
  cache,
  storage,
  jalali,
  components,
  suspense,
  transition,
  actions,
  type App,
  type AppOptions,
};
