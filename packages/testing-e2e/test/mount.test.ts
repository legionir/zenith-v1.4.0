// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMountController } from '../src/mount';
import { installTestBridge, installTestMount, TEST_BRIDGE_KEY, TEST_MOUNT_KEY, type TestBridge, type TestMountController } from '../src/browser';

const cleanups: Array<() => void> = [];
afterEach(() => { for (const cleanup of cleanups.splice(0).reverse()) cleanup(); document.body.replaceChildren(); vi.useRealTimers(); });

function setup(importModule?: (url: string) => Promise<Record<string, unknown>>) {
  const target: Record<string, unknown> = {};
  const controller = createMountController(document, { installBridge: options => installTestBridge(options, target), importModule });
  cleanups.push(() => controller.dispose());
  return { controller, bridge: () => target[TEST_BRIDGE_KEY] as TestBridge, target };
}

describe('actual App mounting (#166, code-first tests not run)', () => {
  it('mounts real directives and signals, then discards all state on remount', async () => {
    const { controller, bridge } = setup();
    await controller.mount({ html: '<span zen-text="count"></span>', state: { count: 1 } });
    expect(bridge().ready()).toBe(true);
    expect(document.querySelector('span')?.textContent).toBe('1');
    bridge().setSignal('count', 4);
    expect(document.querySelector('span')?.textContent).toBe('4');
    expect(bridge().getSignal('count')).toBe(4);
    const stale = bridge();
    await controller.mount({ html: '<span zen-text="count"></span>', state: { count: 0 } });
    expect(stale.ready()).toBe(false);
    expect(() => stale.setSignal('count', 99)).toThrow(/ZEN-1090/);
    expect(document.querySelectorAll('[data-zen-test-app]')).toHaveLength(1);
    expect(bridge().getSignal('count')).toBe(0);
    controller.unmount(); controller.unmount();
    expect(document.querySelector('[data-zen-test-app]')).toBeNull();
  });

  it('loads a plugin by explicit export and disposes its actual listeners on unmount', async () => {
    const clicked = vi.fn(); const disposed = vi.fn();
    const { controller, bridge } = setup(async () => ({ component: {
      name: 'fixture-component', install(app: import('@zenith/runtime-core').App, options?: { text: string }) {
        app.directive({ name: 'fixture', bind(el) { el.textContent = options?.text ?? ''; el.addEventListener('click', clicked); return () => el.removeEventListener('click', clicked); } });
        return disposed;
      },
    } }));
    await controller.mount({ html: '<button zen-fixture></button>', plugins: [{ module: '/fixture.js', exportName: 'component', options: { text: 'Ready' } }] });
    const button = document.querySelector('button')!;
    expect(button.textContent).toBe('Ready'); button.click();
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(bridge().snapshot()).toMatchObject({ registries: { plugins: expect.arrayContaining(['fixture-component']) } });
    controller.unmount(); button.click();
    expect(clicked).toHaveBeenCalledTimes(1); expect(disposed).toHaveBeenCalledTimes(1);
  });

  it('bounds hanging module loading and never installs the late module', async () => {
    vi.useFakeTimers();
    let resolve!: (value: Record<string, unknown>) => void;
    const install = vi.fn();
    const { controller } = setup(() => new Promise(done => { resolve = done; }));
    const mounting = controller.mount({ html: '<div></div>', plugins: [{ module: '/slow.js' }], mountTimeout: 10 });
    const rejected = expect(mounting).rejects.toThrow(/ZEN-1090/);
    await vi.advanceTimersByTimeAsync(10); await rejected;
    resolve({ default: { name: 'late', install } }); await Promise.resolve();
    expect(install).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
    expect(document.querySelector('[data-zen-test-app]')).toBeNull();
  });

  it('cancels a pending mount on dispose and forbids a retained controller from reopening', async () => {
    vi.useFakeTimers();
    const { controller } = setup(() => new Promise(() => {}));
    const mounting = controller.mount({ html: '', plugins: [{ module: '/pending.js' }] });
    const rejected = expect(mounting).rejects.toThrow(/ZEN-1090/);
    controller.dispose(); await rejected;
    expect(vi.getTimerCount()).toBe(0);
    await expect(controller.mount({ html: '' })).rejects.toThrow(/ZEN-1090/);
  });

  it('disposes partially mounted plugins on directive failure', async () => {
    const release = vi.fn();
    const { controller, target } = setup(async () => ({ default: {
      name: 'broken', install(app: import('@zenith/runtime-core').App) {
        app.directive({ name: 'broken', bind() { throw new Error('bind fixture'); } });
        return release;
      },
    } }));
    await expect(controller.mount({ html: '<div zen-broken></div>', plugins: [{ module: '/broken.js' }] })).rejects.toThrow('bind fixture');
    expect(release).toHaveBeenCalledTimes(1);
    expect(target[TEST_BRIDGE_KEY]).toBeUndefined();
    expect(document.querySelector('[data-zen-test-app]')).toBeNull();
  });

  it('reports invalid module exports without creating an App or leaking a timer', async () => {
    vi.useFakeTimers(); const { controller } = setup(async () => ({ default: {} }));
    await expect(controller.mount({ html: '', plugins: [{ module: '/invalid.js' }] })).rejects.toThrow(/ZEN-1090/);
    expect(vi.getTimerCount()).toBe(0);
    expect(document.querySelector('[data-zen-test-app]')).toBeNull();
  });

  it('owns and restores the host property, without erasing a foreign replacement', async () => {
    const target: Record<string, unknown> = {};
    const original = { mount: 'not-a-controller' };
    Object.defineProperty(target, TEST_MOUNT_KEY, { configurable: true, enumerable: true, value: original });
    const host = installTestMount({ document, target }); cleanups.push(() => host.dispose());
    expect(() => installTestMount({ document, target })).toThrow(/ZEN-1090/);
    const retained = target[TEST_MOUNT_KEY] as TestMountController;
    await retained.mount({ html: '<p>One</p>' });
    host.dispose();
    expect(Object.getOwnPropertyDescriptor(target, TEST_MOUNT_KEY)).toEqual({ configurable: true, enumerable: true, writable: false, value: original });
    await expect(retained.mount({ html: '<p>Late</p>' })).rejects.toThrow(/ZEN-1090/);
    const next = installTestMount({ document, target });
    const foreign = {};
    Object.defineProperty(target, TEST_MOUNT_KEY, { configurable: true, value: foreign });
    next.dispose(); expect(target[TEST_MOUNT_KEY]).toBe(foreign);
  });
});
