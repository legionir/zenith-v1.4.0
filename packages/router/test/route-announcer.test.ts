// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { flushSync } from '@zenith/scheduler';
import { createHead } from '@zenith/head';
import { cleanupRouter, installRouteAnnouncer, announceRouteChange, navigate, registerRouterCleanup } from '../src';
const releases: Array<() => void> = [];
afterEach(() => { for (const release of releases.splice(0).reverse()) release(); cleanupRouter(); document.head.replaceChildren(); document.body.replaceChildren(); window.history.replaceState(null, '', '/'); vi.restoreAllMocks(); });
it('uses one owned shared region, restores tabindex and tears down on router cleanup', async () => {
  document.body.innerHTML = '<main data-zen-main tabindex="2">Main</main><a href="/next">Next</a>'; document.title = 'Page'; const main = document.querySelector('main')!; const release = installRouteAnnouncer(); releases.push(release); await navigate('/next'); expect(document.querySelectorAll('[aria-live]')).toHaveLength(1); expect(document.querySelector('[aria-live]')!.textContent).toContain('Page'); expect(document.activeElement).toBe(main); expect(main.getAttribute('tabindex')).toBe('2'); expect(document.querySelector('a')!.getAttribute('aria-current')).toBe('page'); cleanupRouter(); expect(document.querySelector('[aria-live]')).toBeNull(); await navigate('/later'); expect(document.querySelector('[aria-live]')).toBeNull();
});
it('shares route-title formatting with an explicit head owner and restores its earlier entry', async () => {
  const head = createHead({ document, titleTemplate: '%s | Site' }); releases.push(() => head.dispose()); head.push({ title: 'Before' }); flushSync(); const release = installRouteAnnouncer({ head, routes: [{ path: '/about', meta: { title: 'About' } }], focusMain: false }); releases.push(release); await navigate('/about'); flushSync(); expect(document.title).toBe('About | Site'); expect(document.querySelector('[aria-live]')!.textContent).toContain('About | Site'); release(); flushSync(); expect(document.title).toBe('Before | Site'); expect(document.querySelector('[aria-live]')).toBeNull();
});
it('cleans legacy announcements through the shared region primitive', () => {
  const region = announceRouteChange('<script>literal</script>')!; expect(region.getAttribute('role')).toBe('status'); expect(region.querySelector('script')).toBeNull(); expect(announceRouteChange('Next')).toBe(region); cleanupRouter(); expect(region.isConnected).toBe(false);
});
it('does not skip independent cleanups when a route owner unregisters itself during reset', () => {
  const a = vi.fn(), b = vi.fn(); installRouteAnnouncer(); registerRouterCleanup(a); installRouteAnnouncer(); registerRouterCleanup(b); cleanupRouter(); expect(a).toHaveBeenCalledTimes(1); expect(b).toHaveBeenCalledTimes(1); expect(document.querySelector('[aria-live]')).toBeNull();
});
it('closes reentrant cleanup registrations immediately and ignores recursive reset', () => {
  const late = vi.fn(), later = vi.fn(); registerRouterCleanup(() => { registerRouterCleanup(late); cleanupRouter(); }); registerRouterCleanup(later); cleanupRouter(); expect(late).toHaveBeenCalledTimes(1); expect(later).toHaveBeenCalledTimes(1); cleanupRouter(); expect(late).toHaveBeenCalledTimes(1);
});
