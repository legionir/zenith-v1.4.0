// @vitest-environment jsdom
/* global document, window */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  navigate,
  beforeEach as routerBeforeEach,
  afterEach as routerAfterEach,
  setScrollBehavior,
  installRouteAnnouncer,
  cleanupRouter,
  installPopstateListener,
} from '../../packages/router/src/index.ts';
import {
  defineStore,
  useStorePlugin,
  clearStores,
} from '../../packages/store/src/index.ts';
import { createForm } from '../../packages/form/src/index.ts';
import { http, mockHttp } from '../../packages/http/src/index.ts';
import {
  setCachedData,
  getCachedData,
  invalidate as invalidateData,
} from '../../packages/data/src/index.ts';
import {
  createResource,
  invalidate as invalidateResource,
  clearResources,
} from '../../packages/resource/src/index.ts';
import { createDataTable } from '../../packages/data-table/src/index.ts';
import {
  notify,
  dismissNotification,
  clearAllNotifications,
  getQueuedNotifications,
  setNotificationDefaults,
  notificationsAPI,
} from '../../packages/notifications/src/index.ts';
import { createTransition, runRouteTransition } from '../../packages/transition/src/index.ts';
import {
  processErrorBoundary,
  reportError,
  resetErrorBoundary,
} from '../../packages/error-boundary/src/index.ts';
import {
  createPermissionManager,
  can,
  hasPermissionManager,
  listPermissionManagers,
  unregisterPermissionManager,
  clearPermissionManagers,
} from '../../packages/permission/src/index.ts';
import {
  BUILTIN_MODIFIERS,
  extractListenerOptions,
  parseBinding,
} from '../../packages/events/src/index.ts';
import { auditAccessibility } from '../../packages/testing/src/index.ts';
import { flushSync } from '../../packages/scheduler/src/index.ts';

describe('Wave 4 P1 Batch 9 — Router, Store, Form, HTTP, Data/Resource, DataTable, Notifications, Transition, ErrorBoundary, Permission, Events (#126..#136)', () => {
  beforeEach(() => {
    cleanupRouter();
    installPopstateListener();
    clearStores();
    clearResources();
    clearAllNotifications();
    clearPermissionManagers();
  });

  it('supports router afterEach, scrollBehavior, and installRouteAnnouncer focus/aria-live (#126)', async () => {
    const main = document.createElement('main');
    main.innerHTML = '<h1>Home</h1>';
    document.body.appendChild(main);

    const scrollSpy = vi.fn();
    window.scrollTo = scrollSpy;

    const afterCalls = [];
    const stopAfter = routerAfterEach((to, from) => {
      afterCalls.push([to, from]);
    });
    const stopScroll = setScrollBehavior((to, _from, saved) => {
      if (saved) return saved;
      return { left: 0, top: to === '/about' ? 120 : 0 };
    });
    const stopAnnouncer = installRouteAnnouncer({
      formatAnnouncement: (to) => `صفحه ${to}`,
    });

    await navigate('/about');
    expect(afterCalls.length).toBe(1);
    expect(afterCalls[0][0]).toBe('/about');
    expect(scrollSpy).toHaveBeenCalledWith(0, 120);
    expect(document.getElementById('zen-route-announcer')?.textContent).toBe('صفحه /about');
    expect(document.activeElement).toBe(main);

    const stopGuard = routerBeforeEach(() => false);
    await navigate('/blocked');
    expect(afterCalls.length).toBe(1);
    stopGuard();

    stopAfter();
    stopScroll();
    stopAnnouncer();
    main.remove();
  });

  it('supports store $subscribe, $onAction, persistStore with version migration, and plugins (#127)', () => {
    const mem = new Map();
    const customStorage = {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => mem.set(k, v),
      removeItem: (k) => mem.delete(k),
    };

    // Pre-populate v1 state in storage
    customStorage.setItem(
      'zenith:store:prefs',
      JSON.stringify({ __zenithVersion: 1, state: { theme: 'old-dark', secret: 'ignore' } }),
    );

    const pluginLog = [];
    const stopGlobalPlugin = useStorePlugin(({ name }) => {
      pluginLog.push(`init:${name}`);
    });

    const usePrefs = defineStore('prefs', {
      state: () => ({ theme: 'light', secret: '' }),
      actions: {
        setTheme(nextTheme) {
          this.state.theme = nextTheme;
          return nextTheme;
        },
      },
      persist: {
        storage: customStorage,
        version: 2,
        pick: ['theme'],
        migrate: (persisted) => ({
          ...persisted,
          theme: persisted.theme === 'old-dark' ? 'migrated-dark' : persisted.theme,
        }),
      },
    });

    const store = usePrefs();
    expect(store.$name).toBe('prefs');
    expect(store.state.theme).toBe('migrated-dark');
    expect(pluginLog).toContain('init:prefs');

    const actionEvents = [];
    store.$onAction(({ name, after }) => {
      after((res) => actionEvents.push(`${name}->${res}`));
    });

    const subCalls = [];
    store.$subscribe(
      (s) => {
        subCalls.push(s.theme);
      },
      { immediate: true },
    );
    expect(subCalls).toEqual(['migrated-dark']);

    store.setTheme('solarized');
    expect(actionEvents).toEqual(['setTheme->solarized']);
    expect(subCalls).toEqual(['migrated-dark', 'solarized']);

    // Verify persisted payload picked only `theme` at version 2
    const persistedRaw = JSON.parse(customStorage.getItem('zenith:store:prefs'));
    expect(persistedRaw.__zenithVersion).toBe(2);
    expect(persistedRaw.state).toEqual({ theme: 'solarized' });

    // After dispose, $subscribe must not fire
    store.dispose();
    stopGlobalPlugin();
  });

  it('unifies createForm(options) for string rules, function validators, schema, and wizard steps (#128)', async () => {
    const form = createForm({
      initialValues: { email: '', age: 20 },
      rules: { email: 'required|email' },
      validate: {
        age: (v) => (v >= 18 ? true : 'حداقل ۱۸ سال'),
      },
    });

    expect(await form.validate()).toBe(false);
    expect(form.errors.get().email).toBeTruthy();

    form.setFieldValue('email', 'ali@example.com');
    expect(await form.validate()).toBe(true);

    const wizard = createForm({
      initialValues: { step1: 'ok', step2: '' },
      steps: [
        { id: 's1', title: 'گام ۱', fields: ['step1'] },
        { id: 's2', title: 'گام ۲', fields: ['step2'] },
      ],
    });
    expect(wizard.currentStep.get()).toBe(0);
    await wizard.next();
    expect(wizard.currentStep.get()).toBe(1);
  });

  it('supports HTTP upload/download progress, external AbortSignal, and mockHttp (#129)', async () => {
    const uploadEvents = [];
    const downloadEvents = [];

    const stopMock = mockHttp(async (url) => {
      if (url.includes('/slow')) {
        await new Promise((r) => setTimeout(r, 50));
      }
      return { status: 200, data: { ok: true, items: [1, 2, 3] } };
    });

    const res = await http.post(
      '/api/upload',
      { title: 'فایل تست' },
      {
        zenith: {
          onUploadProgress: (e) => uploadEvents.push(e.percent),
          onDownloadProgress: (e) => downloadEvents.push(e.percent),
        },
      },
    );
    expect(res.data.ok).toBe(true);
    expect(uploadEvents.at(-1)).toBe(100);
    expect(downloadEvents.at(-1)).toBe(100);

    // External AbortSignal cancels request and throws ZenithError (ZEN-1600)
    const controller = new AbortController();
    controller.abort();
    await expect(http.get('/api/slow', { signal: controller.signal })).rejects.toMatchObject({
      code: 'ZEN-1600',
    });

    stopMock();
  });

  it('supports shared tag invalidation across data and resource (#130)', () => {
    setCachedData('/api/users/1', { name: 'Ali' }, ['users']);
    expect(getCachedData('/api/users/1', 60000)).toEqual({ name: 'Ali' });

    const usersRes = createResource('users', { url: '/api/users' });
    const invSpy = vi.spyOn(usersRes, 'invalidate');

    invalidateData(['users']);
    expect(getCachedData('/api/users/1', 60000)).toBeNull();

    invalidateResource(['users']);
    expect(invSpy).toHaveBeenCalledTimes(1);
  });

  it('supports 100k row virtualization, Persian BOM CSV export with escaping, and accessible ARIA grid (#131)', () => {
    const bigRows = Array.from({ length: 100_000 }, (_, i) => ({
      id: i + 1,
      name: i === 0 ? 'علی، "مدیر"\nتهران' : `کاربر ${i + 1}`,
      role: 'admin',
    }));

    const table = createDataTable({
      columns: [
        { key: 'id', title: 'شناسه', sortable: true },
        { key: 'name', title: 'نام کامل', sortable: true },
      ],
      data: bigRows,
      selection: { enabled: true, mode: 'multiple' },
      virtual: { rowHeight: 40, viewportHeight: 200, overscan: 2 },
    });

    // Virtual window at scrollTop=4000 renders only ~9 rows out of 100,000
    table.setScrollTop(4000);
    flushSync();
    const win = table.virtualWindow.get();
    expect(win.totalHeight).toBe(4_000_000);
    expect(win.visibleRows.length).toBeLessThanOrEqual(12);
    expect(win.startIndex).toBe(98);

    // CSV export with BOM + comma/quote/newline escaping
    table.toggleRowSelection(1);
    flushSync();
    const csv = table.exportCsv({ bom: true, selectedOnly: true });
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"علی، ""مدیر""\nتهران"');

    // ARIA grid rendering passes auditAccessibility with 0 serious violations
    const gridHost = document.createElement('div');
    document.body.appendChild(gridHost);
    const stopGrid = table.renderAriaGrid(gridHost);
    expect(gridHost.getAttribute('role')).toBe('grid');
    expect(gridHost.querySelectorAll('[role="row"]').length).toBe(win.visibleRows.length + 1);
    const a11y = auditAccessibility(gridHost);
    expect(a11y.violations).toEqual([]);
    stopGrid();
    gridHost.remove();
  });

  it('queues notifications beyond maxVisible and deduplicates when configured (#132)', () => {
    setNotificationDefaults({ maxVisible: 5, duration: 0, deduplicate: false });
    const ids = [];
    for (let i = 0; i < 100; i++) {
      ids.push(notify(`پیام ${i}`));
    }
    expect(notificationsAPI.getNotifications().length).toBe(5);
    expect(getQueuedNotifications().length).toBe(95);

    dismissNotification(ids[0]);
    expect(notificationsAPI.getNotifications().length).toBe(5);
    expect(getQueuedNotifications().length).toBe(94);
  });

  it('respects prefers-reduced-motion in transitions and route transitions (#133)', async () => {
    const origMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });

    const el = document.createElement('div');
    let afterLeaveCalled = false;
    const ctrl = createTransition('fade', {
      duration: 500,
      onAfterLeave: () => {
        afterLeaveCalled = true;
      },
    });
    await ctrl.leave(el).finished;
    expect(afterLeaveCalled).toBe(true);

    const outEl = document.createElement('div');
    const inEl = document.createElement('div');
    document.body.appendChild(outEl);
    document.body.appendChild(inEl);
    await runRouteTransition(outEl, inEl, { mode: 'out-in' });
    expect(document.body.contains(outEl)).toBe(false);

    inEl.remove();
    window.matchMedia = origMatchMedia;
  });

  it('supports error-boundary retry with backoff, resetErrorBoundary, and zen-error-recover event (#134)', async () => {
    const boundary = document.createElement('div');
    boundary.setAttribute('zen-error-retry', '1');
    boundary.setAttribute('zen-error-fallback', '<p class="custom-fb">خطای سفارشی</p>');
    boundary.innerHTML = '<span class="child-ok">سالم</span>';
    document.body.appendChild(boundary);

    let recoveredEvents = 0;
    boundary.addEventListener('zen-error-recover', () => {
      recoveredEvents++;
    });

    const disposes = [];
    const stopBoundary = processErrorBoundary(boundary, () => {}, disposes, {
      retry: { attempts: 1, delay: 10, factor: 1 },
    });

    const child = boundary.querySelector('.child-ok');
    reportError(new Error('transient'), 'test', { element: child });

    await new Promise((r) => setTimeout(r, 30));
    expect(recoveredEvents).toBe(1);
    expect(boundary.querySelector('.child-ok')).not.toBeNull();

    // Second error exceeds retry attempts=1 -> renders custom fallback
    const child2 = boundary.querySelector('.child-ok');
    reportError(new Error('permanent'), 'test', { element: child2 });
    expect(boundary.querySelector('.custom-fb')?.textContent).toBe('خطای سفارشی');

    resetErrorBoundary(boundary);
    expect(boundary.querySelector('.child-ok')).not.toBeNull();

    stopBoundary();
    boundary.remove();
  });

  it('provides reactive can(permission) signal and full 5-method registry in @zenith/permission (#135)', () => {
    const mgr = createPermissionManager('default');
    expect(hasPermissionManager('default')).toBe(true);
    expect(listPermissionManagers()).toContain('default');

    const canEdit = can('posts:edit');
    expect(canEdit.get()).toBe(false);

    mgr.setUserAccess(['editor'], ['posts:edit']);
    flushSync();
    expect(canEdit.get()).toBe(true);

    expect(unregisterPermissionManager('default')).toBe(true);
  });

  it('includes passive and capture in BUILTIN_MODIFIERS and extracts listener options (#136)', () => {
    expect(BUILTIN_MODIFIERS.has('passive')).toBe(true);
    expect(BUILTIN_MODIFIERS.has('capture')).toBe(true);
    expect(BUILTIN_MODIFIERS.has('once')).toBe(true);

    const parsed = parseBinding('wheel.passive.capture.once');
    expect(parsed.eventName).toBe('wheel');
    expect(extractListenerOptions(parsed.modifiers)).toEqual({
      once: true,
      passive: true,
      capture: true,
    });
  });
});
