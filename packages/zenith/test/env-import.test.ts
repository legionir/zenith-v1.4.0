// #149 — import در Node خالص (SSR): هیچ دسترسی window/document در import-time
import { describe, expect, it } from 'vitest';

describe('zenith imports cleanly in Node (no DOM)', () => {
  it('loads main and subpath entries without window/document', async () => {
    expect(typeof globalThis.window).toBe('undefined');
    expect(typeof globalThis.document).toBe('undefined');

    const main = await import('../src/index');
    const core = await import('../src/core');
    const minimal = await import('../src/presets/minimal');
    const spa = await import('../src/presets/spa');
    const full = await import('../src/presets/full');
    const browser = await import('../src/browser');

    expect(typeof main.createZenith).toBe('function');
    expect(typeof core.createApp).toBe('function');
    expect(typeof minimal.createMinimalApp).toBe('function');
    expect(typeof spa.createSpaApp).toBe('function');
    expect(typeof full.createFullApp).toBe('function');
    expect(typeof browser.ZenithBrowser).toBe('object');
  });
});
