// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import * as zenith from 'zenith';
import {
  createZenith,
  assertCompatible,
  signal,
  computed,
  watch,
  inject,
  flushSync,
  ZENITH_OPTIONS_DEFAULTS,
  ZenithError,
} from 'zenith';
import * as zenithCore from 'zenith/core';
import * as zenithSsr from 'zenith/ssr';
import * as zenithTesting from 'zenith/testing';
import { createMinimalApp, minimalPreset, PRESET_MINIMAL_MODULES } from 'zenith/presets/minimal';
import { createSpaApp, spaPreset, PRESET_SPA_MODULES } from 'zenith/presets/spa';
import { createFullApp, fullPreset, PRESET_FULL_MODULES } from 'zenith/presets/full';
import { ZenithBrowser, installBrowserGlobal } from 'zenith/browser';

describe('zenith umbrella package (#149, SPEC §2.9)', () => {
  it('exports core primitives and single-source namespaces without top-level collisions', () => {
    expect(typeof zenith.createApp).toBe('function');
    expect(typeof zenith.createZenith).toBe('function');
    expect(typeof zenith.assertCompatible).toBe('function');
    expect(typeof zenith.defineDirective).toBe('function');
    expect(typeof zenith.definePlugin).toBe('function');
    expect(typeof zenith.signal).toBe('function');
    expect(typeof zenith.computed).toBe('function');
    expect(typeof zenith.effect).toBe('function');
    expect(typeof zenith.batch).toBe('function');
    expect(typeof zenith.watch).toBe('function');

    // Single-source namespaces
    expect(typeof zenith.http).toBe('object');
    expect(typeof zenith.router).toBe('object');
    expect(typeof zenith.store).toBe('object');
    expect(typeof zenith.form).toBe('object');
    expect(typeof zenith.i18n).toBe('object');
    expect(typeof zenith.resource).toBe('object');
    expect(typeof zenith.auth).toBe('object');
    expect(typeof zenith.cache).toBe('object');
    expect(typeof zenith.storage).toBe('object');
    expect(typeof zenith.schema).toBe('object');
    expect(typeof zenith.logger).toBe('object');
    expect(typeof zenith.jalali).toBe('object');
    expect(typeof zenith.notifications).toBe('object');
    expect(typeof zenith.errorBoundary).toBe('object');
    expect(typeof zenith.events).toBe('object');
    expect(typeof zenith.security).toBe('object');
    expect(typeof zenith.actions).toBe('object');
    expect(typeof zenith.components).toBe('object');
    expect(typeof zenith.suspense).toBe('object');
    expect(typeof zenith.transition).toBe('object');

    // Colliding names must NOT be exported at top-level
    expect('clearCache' in zenith).toBe(false);
    expect('alert' in zenith).toBe(false);
    expect(Object.isFrozen(ZENITH_OPTIONS_DEFAULTS)).toBe(true);
  });

  it('exposes zenith/core, zenith/ssr, zenith/testing, and presets (minimal/spa/full)', () => {
    expect(typeof zenithCore.createApp).toBe('function');
    expect(typeof zenithCore.signal).toBe('function');
    expect(typeof zenithCore.watch).toBe('function');
    expect(typeof zenithSsr.renderToString).toBe('function');
    expect(typeof zenithTesting).toBe('object');

    expect(PRESET_MINIMAL_MODULES).toContain('events');
    expect(PRESET_SPA_MODULES).toContain('router');
    expect(PRESET_FULL_MODULES).toContain('auth');

    // Verify createZenith with minimal (default), spa, and full presets
    for (const preset of ['minimal', 'spa', 'full'] as const) {
      let injectedPreset: string | undefined;
      const probe = zenith.defineDirective({
        name: 'probe',
        bind() {
          injectedPreset = inject<string>('zenith:preset');
        },
      });
      const app = createZenith({
        preset,
      });
      app.directive(probe);
      const root = document.createElement('div');
      root.innerHTML = `<span zen-probe=""></span>`;
      app.mount(root);
      expect(injectedPreset).toBe(preset);
      app.dispose();
    }

    // Direct preset factory helpers
    const mApp = createMinimalApp();
    const sApp = createSpaApp();
    const fApp = createFullApp();
    expect(minimalPreset.name).toBe('zenith:preset:minimal');
    expect(spaPreset.name).toBe('zenith:preset:spa');
    expect(fullPreset.name).toBe('zenith:preset:full');
    mApp.dispose();
    sApp.dispose();
    fApp.dispose();

    // Invalid preset throws ZEN-1001
    expect(() => createZenith({ preset: 'unknown' as any })).toThrowError(
      expect.objectContaining({ code: 'ZEN-1001' }),
    );
  });

  it('supports watch() with reactive signals, immediate option, and cleanup', () => {
    const count = signal(0);
    const doubled = computed(() => count.get() * 2);
    const seen: Array<[number, number | undefined]> = [];
    let cleanups = 0;

    const stop = watch(
      doubled,
      (val, prev) => {
        seen.push([val, prev]);
        return () => {
          cleanups++;
        };
      },
      { immediate: true },
    );

    expect(seen).toEqual([[0, undefined]]);
    count.set(3);
    flushSync();
    expect(seen).toEqual([
      [0, undefined],
      [6, 0],
    ]);
    expect(cleanups).toBe(1);

    stop();
    expect(cleanups).toBe(2);
    count.set(10);
    flushSync();
    expect(seen.length).toBe(2);
  });

  it('enforces lockstep versions via assertCompatible() with ZEN-2320', () => {
    expect(() => assertCompatible()).not.toThrow();
    try {
      assertCompatible({ '@zenith/router': '1.4.0' });
      expect.unreachable('should have thrown ZEN-2320');
    } catch (err) {
      expect(err).toBeInstanceOf(ZenithError);
      expect((err as ZenithError).code).toBe('ZEN-2320');
    }
  });

  it('installs window.Zenith in browser entry', () => {
    const target: Record<string, unknown> = {};
    installBrowserGlobal(target);
    expect(target.Zenith).toBe(ZenithBrowser);
    expect(typeof ZenithBrowser.createApp).toBe('function');
    expect(typeof ZenithBrowser.signal).toBe('function');
  });
});
