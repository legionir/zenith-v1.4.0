import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  signal,
  computed,
  effect,
  registerStateInstance,
  resetStateInstanceTrackingForTesting,
  getErrorHistory,
  clearErrorHistory,
} from '../../packages/state/src/index.ts';
import {
  flushSync,
  registerSchedulerInstance,
  resetSchedulerInstanceTrackingForTesting,
} from '../../packages/scheduler/src/index.ts';
import { createForm } from '../../packages/form/src/index.ts';
import { defineStore } from '../../packages/store/src/index.ts';
import { createSuspense } from '../../packages/suspense/src/index.ts';

describe('Cross-package version & singleton compatibility (#34)', () => {
  beforeEach(() => {
    clearErrorHistory();
    resetStateInstanceTrackingForTesting();
    resetSchedulerInstanceTrackingForTesting();
  });

  it('emits ZEN-0301 warning when a second instance of @zenith/state is loaded', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const count = registerStateInstance({ duplicateModule: true });
    expect(count).toBe(2);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0]?.[0] ?? '')).toContain('ZEN-0301');
    expect(getErrorHistory().some((e) => e.code === 'ZEN-0301')).toBe(true);

    // Subsequent duplicate loads only warn once
    registerStateInstance({ duplicateModule: 3 });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('emits ZEN-0201 warning when a second instance of @zenith/scheduler is loaded', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const count = registerSchedulerInstance({ duplicateScheduler: true });
    expect(count).toBe(2);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0]?.[0] ?? '')).toContain('ZEN-0201');
    expect(getErrorHistory().some((e) => e.code === 'ZEN-0201')).toBe(true);
    warnSpy.mockRestore();
  });

  it('shares a single reactive graph across @zenith/form, @zenith/store, @zenith/suspense, and @zenith/state', async () => {
    // 1. @zenith/form + @zenith/state
    const form = createForm({
      email: { initial: '' },
    });
    const externalSignal = signal('prefix:');
    const combinedEmail = computed(
      () => `${externalSignal.get()}${form.signal.get().fields.email?.value ?? ''}`,
    );
    const snapshots = [];
    const stopEffect = effect(() => {
      snapshots.push(combinedEmail.get());
    });

    form.setValue('email', 'alice@example.com');
    flushSync();
    flushSync();
    expect(snapshots.at(-1)).toBe('prefix:alice@example.com');

    // 2. @zenith/store + @zenith/state
    const useCart = defineStore('compat-cart-34', {
      state: () => ({ qty: 1 }),
      getters: { doubled: (s) => s.qty * 2 },
      actions: {},
    });
    const cart = useCart();
    const storeSnapshots = [];
    const stopStoreEffect = effect(() => {
      storeSnapshots.push(cart.doubled.get());
    });
    cart.$patch({ qty: 4 });
    flushSync();
    flushSync();
    expect(storeSnapshots.at(-1)).toBe(8);

    // 3. @zenith/suspense + @zenith/state
    const suspense = createSuspense();
    const loadingStates = [];
    const stopSuspenseEffect = effect(() => {
      loadingStates.push(suspense.loading.get());
    });
    let resolveTask;
    const p = new Promise((r) => {
      resolveTask = r;
    });
    suspense.track(p);
    flushSync();
    expect(loadingStates).toContain(true);
    resolveTask('done');
    await p;
    flushSync();
    expect(loadingStates.at(-1)).toBe(false);

    stopEffect();
    stopStoreEffect();
    stopSuspenseEffect();
    form.dispose();
    suspense.dispose();
  });

  it('keeps peer-single-instance tarball test wired in CI', () => {
    const scriptPath = join(process.cwd(), 'scripts/peer-single-instance.mjs');
    expect(existsSync(scriptPath)).toBe(true);
    const wf = readFileSync(join(process.cwd(), '.github/workflows/main.yml'), 'utf8');
    expect(wf).toContain('npm run peer:single-instance');
  });
});
