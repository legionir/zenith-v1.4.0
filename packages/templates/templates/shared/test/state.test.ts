import { expect, it } from 'vitest';
import { signal } from '@zenith/state';
it('updates and disposes application state', () => { const count = signal(0); try { count.set(1); expect(count.get()).toBe(1); } finally { count.dispose(); } });
