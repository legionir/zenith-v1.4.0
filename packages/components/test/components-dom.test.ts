// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  registerComponent,
  unregisterComponent,
  loadComponents,
  processComponent,
  isComponent,
  clearComponents,
  loadComponent,
  clearComponentCache,
  escapeHTML,
} from '../src/index';

describe('@zenith/components DOM unit tests (#28)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    clearComponents();
    clearComponentCache();
  });

  it('registers components from DOM, renders default/named slots and props, and cleans up', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <zen-component name="app-card">
        <template>
          <section class="card">
            <header><slot name="header">Default Header</slot></header>
            <main><slot>Default Body</slot></main>
          </section>
        </template>
      </zen-component>
      <app-card prop:title="$pageTitle">
        <span slot="header">Custom Header</span>
        <p>Custom Body</p>
      </app-card>
    `;
    document.body.appendChild(root);

    const count = loadComponents(root);
    expect(count).toBe(1);
    expect(isComponent('app-card')).toBe(true);

    const host = root.querySelector('app-card') as HTMLElement;
    const walked: Array<{ el: HTMLElement; ctx: Record<string, unknown> }> = [];
    const disposes: Array<() => void> = [];

    const cleanup = processComponent(
      host,
      { $pageTitle: 'Dashboard' },
      (el, ctx) => {
        walked.push({ el, ctx });
      },
      disposes,
    );

    expect(host.querySelector('header')?.textContent).toContain('Custom Header');
    expect(host.querySelector('main')?.textContent).toContain('Custom Body');
    expect(walked.length).toBeGreaterThan(0);
    expect(walked[0].ctx.$title).toBe('Dashboard');

    cleanup();
  });

  it('fetches and caches async components via loadComponent and escapes HTML safely', async () => {
    expect(escapeHTML('<img src=x onerror="alert(1)">')).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;',
    );

    const tpl = document.createElement('template');
    tpl.innerHTML = '<span class="badge">Badge</span>';
    const unregister = registerComponent('x-badge', tpl);
    expect(isComponent('x-badge')).toBe(true);
    unregister();
    expect(isComponent('x-badge')).toBe(false);

    registerComponent('x-manual', tpl);
    expect(unregisterComponent('x-manual')).toBe(true);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<template><div class="remote-widget">Remote OK</div></template>', {
        status: 200,
      }),
    );

    const tpl1 = await loadComponent('/widgets/remote.html');
    const tpl2 = await loadComponent('/widgets/remote.html');
    expect(tpl1).toBe(tpl2);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    fetchSpy.mockRestore();
  });
});
