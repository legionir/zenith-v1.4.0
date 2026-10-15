// packages/zenith/src/presets/minimal.ts
//
// `zenith/presets/minimal` (#149, SPEC §2.9):
// core + events + security

import {
  createApp,
  definePlugin,
  type App,
  type AppOptions,
  type Plugin,
} from '@zenith/runtime-core';
import * as events from '@zenith/events';
import * as security from '@zenith/security';

export const PRESET_MINIMAL_MODULES = /* @__PURE__ */ Object.freeze([
  'runtime-core',
  'events',
  'security',
] as const);

export const minimalPreset: Plugin = /* @__PURE__ */ definePlugin({
  name: 'zenith:preset:minimal',
  install(app: App) {
    app.provide('zenith:preset', 'minimal');
    app.provide('zenith:events', events);
    app.provide('zenith:security', security);
  },
});

export function createMinimalApp(options?: AppOptions): App {
  const app = createApp(options);
  app.use(minimalPreset);
  return app;
}

export { createApp, definePlugin, events, security, type App, type AppOptions };
