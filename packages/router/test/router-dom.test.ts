// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  matchRoute,
  findMatchingRoute,
  navigate,
  beforeEach as addBeforeEach,
  cleanupRouter,
  routeSignal,
  runWithRoute,
  runWithRouteSync,
  processRouter,
  clearRouteCache,
  useRoute,
} from '../src/index';

describe('@zenith/router DOM & SSR isolation unit tests (#28)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    cleanupRouter();
    clearRouteCache();
    window.history.replaceState(null, '', '/');
    routeSignal.set({ path: '/', params: {} });
  });

  it('matches routes with params, enforces beforeEach navigation guards, and updates routeSignal', async () => {
    const params = matchRoute('/users/:id/posts/:postId', '/users/42/posts/7');
    expect(params).toEqual({ id: '42', postId: '7' });
    expect(matchRoute('/users/:id', '/settings')).toBeNull();

    const routes = [
      { path: '/', src: '/home.html' },
      { path: '/users/:id', src: '/user.html' },
    ];
    const matched = findMatchingRoute(routes, '/users/99');
    expect(matched?.route.src).toBe('/user.html');
    expect(matched?.params).toEqual({ id: '99' });

    const unregisterGuard = addBeforeEach((to) => {
      if (to === '/forbidden') return false;
      if (to === '/legacy') return '/users/1';
      return true;
    });

    await navigate('/forbidden');
    expect(routeSignal.get().path).toBe('/');

    await navigate('/legacy');
    expect(routeSignal.get().path).toBe('/users/1');

    unregisterGuard();
    await navigate('/forbidden');
    expect(routeSignal.get().path).toBe('/forbidden');
  });

  it('isolates routes via runWithRoute / runWithRouteSync and renders router outlet in DOM', async () => {
    const syncResult = runWithRouteSync('/ssr-sync', () => useRoute().path);
    expect(syncResult).toBe('/ssr-sync');

    const [r1, r2] = await Promise.all([
      runWithRoute('/req-a', async () => {
        await new Promise((r) => setTimeout(r, 5));
        return useRoute().path;
      }),
      runWithRoute('/req-b', async () => {
        await new Promise((r) => setTimeout(r, 2));
        return useRoute().path;
      }),
    ]);
    expect(r1).toBe('/req-a');
    expect(r2).toBe('/req-b');

    const root = document.createElement('div');
    root.innerHTML = `<zen-router></zen-router>`;
    document.body.appendChild(root);

    const disposes: Array<() => void> = [];
    const cleanup = processRouter(root, {}, () => {}, disposes);
    expect(typeof cleanup).toBe('function');
    cleanup();
  });
});
