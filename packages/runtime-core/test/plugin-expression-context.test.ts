// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { signal } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { headPlugin } from '@zenith/head';
import { uiPlugin } from '@zenith/ui';
import { createApp } from '../src';
it('evaluates head/UI directives against real state and lexical locals, not a nested state wrapper', () => {
  const title = signal('first'), open = signal(false); const root = document.createElement('main'); root.innerHTML = '<span zen-head-title="title"></span><section zen-dialog="open"><h2 zen-dialog-title>Title</h2><button>close</button></section>'; document.body.appendChild(root);
  const app = createApp({ state: { title, open }, plugins: [headPlugin({ document }), uiPlugin()] });
  try { app.mount(root); flushSync(); expect(document.title).toBe('first'); expect(root.querySelector<HTMLElement>('[zen-dialog]')!.hidden).toBe(true); title.set('second'); open.set(true); flushSync(); expect(document.title).toBe('second'); expect(root.querySelector<HTMLElement>('[zen-dialog]')!.hidden).toBe(false); }
  finally { app.dispose(); title.dispose(); open.dispose(); root.remove(); }
});
