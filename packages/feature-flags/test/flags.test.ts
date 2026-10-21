// packages/feature-flags/test/flags.test.ts
// @vitest-environment jsdom
/* global document */
import { describe, it, expect } from 'vitest';
import {
  createFlags,
  stableHashRollout,
  flagsPlugin,
  setActiveFlags,
  processFlag,
  processFlagVariant,
  getActiveFlags,
} from '../src/index';
import { flushSync } from '@zenith/scheduler';

describe('@zenith/feature-flags (#168)', () => {
  it('flag(name) واکنشی است و تعریف‌نشده در dev خطا می‌دهد (ZEN-2201)', () => {
    const flags = createFlags({ source: { darkMode: true } });
    const sig = flags.flag('darkMode');
    expect(sig.get()).toBe(true);
    const g = globalThis as Record<string, unknown>;
    const prev = g.__ZENITH_DEV__;
    g.__ZENITH_DEV__ = true;
    expect(() => flags.flag('missingFlag')).not.toThrow();
    expect(() => flags.flag('missingFlag').get()).toThrow();
    g.__ZENITH_DEV__ = prev;
    flags.dispose();
  });

  it('rollout=hash برای userId ثابت همیشه نتیجهٔ یکسان است و توزیع آماری معقول است', () => {
    const v1 = stableHashRollout('expA', 'user-42');
    const v2 = stableHashRollout('expA', 'user-42');
    expect(v1).toBe(v2);
    let count = 0;
    for (let i = 0; i < 2000; i++) {
      if (stableHashRollout('expB', `u-${i}`) < 50) count++;
    }
    const pct = (count / 2000) * 100;
    expect(pct).toBeGreaterThan(40);
    expect(pct).toBeLessThan(60);
  });

  it('override(name,value) Cleanup نقش معکوس دارد', () => {
    const flags = createFlags({ source: { beta: false } });
    expect(flags.flag('beta', false).get()).toBe(false);
    const undo = flags.override('beta', true);
    flushSync();
    expect(flags.flag('beta').get()).toBe(true);
    undo();
    flushSync();
    expect(flags.flag('beta').get()).toBe(false);
    undo(); // second call is a no-op (Cleanup)
    flags.dispose();
  });

  it('variant(name) سیگنال variant را برمی‌گرداند و setContext روی rollout اثر می‌گذارد', () => {
    const flags = createFlags({
      source: { onboarding: { enabled: true, variant: 'B' }, exp: { enabled: true, rollout: 0 } },
      context: { userId: 'u-1' },
      rollout: 'hash',
    });
    expect(flags.variant('onboarding').get()).toBe('B');
    expect(flags.flag('exp', true).get()).toBe(false); // rollout 0 ⇒ همیشه خاموش
    flags.setContext({ userId: 'u-2' });
    flushSync();
    flags.dispose();
  });

  it('refresh() source async را بار می‌کند و خطا را ZEN-2202 می‌کند', async () => {
    let calls = 0;
    const flags = createFlags({
      source: async () => {
        calls++;
        return { remote: true };
      },
      refreshInterval: 0,
    });
    await flags.refresh();
    expect(calls).toBe(1);
    expect(flags.flag('remote').get()).toBe(true);

    const badFlags = createFlags({
      source: async () => {
        throw new Error('network');
      },
      refreshInterval: 0,
    });
    await expect(badFlags.refresh()).rejects.toThrow();
    flags.dispose();
    badFlags.dispose();
  });

  it('دایرکتیو zen-flag نمایش/پنهان را واکنشی می‌کند', () => {
    const flags = createFlags({ source: { v2: false } });
    setActiveFlags(flags);
    const root = document.createElement('div');
    root.innerHTML = `<div zen-flag="v2">New UI<template zen-flag-else><span>Old UI</span></template></div>`;
    document.body.appendChild(root);
    const target = root.querySelector('[zen-flag]') as HTMLElement;
    const dispose = processFlag(target, 'v2');
    flushSync();
    expect(target.style.display).toBe('none');
    expect(target.querySelector('span')?.textContent).toBe('Old UI');
    dispose();
    setActiveFlags(null);
    flags.dispose();
  });

  it('دایرکتیو zen-flag-variant برابری variant را اعمال می‌کند', () => {
    const flags = createFlags({ source: { exp: { enabled: true, variant: 'A' } } });
    setActiveFlags(flags);
    expect(getActiveFlags()).toBe(flags);
    const el = document.createElement('div');
    el.setAttribute('zen-flag-variant', 'exp:A');
    document.body.appendChild(el);
    const dispose = processFlagVariant(el, 'exp:A');
    flushSync();
    expect(el.style.display).toBe('');
    dispose();
    setActiveFlags(null);
    flags.dispose();
  });

  it('flagsPlugin قرارداد registry را برقرار می‌کند', () => {
    const plugin = flagsPlugin({ source: {} });
    expect(plugin.name).toBe('zenith:flags');
    const provided = new Map<unknown, unknown>();
    plugin.install({ provide: (k, v) => provided.set(k, v) } as never);
    expect(provided.has('zenith:flags')).toBe(true);
    (provided.get('zenith:flags') as { dispose: () => void }).dispose();
  });
});
