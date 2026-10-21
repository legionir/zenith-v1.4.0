import { signal } from '@zenith/state';
import { createApp } from '@zenith/runtime';
const transferred = (window as Window & { __ZENITH_STATE__?: { count?: number } }).__ZENITH_STATE__;
const count = signal(import.meta.hot?.data.count ?? transferred?.count ?? 0);
const app = createApp();
app.action('increment', () => { count.set(count.get() + 1); });
app.action('decrement', () => { count.set(Math.max(0, count.get() - 1)); });
const stop = app.mount(document.getElementById('app')!, { count });
if (import.meta.hot) import.meta.hot.dispose(data => { data.count = count.get(); stop(); app.dispose(); count.dispose(); });
