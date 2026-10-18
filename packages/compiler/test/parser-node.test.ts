// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { createParser } from '../src/parser';
import { compileTemplate } from '../src';
afterEach(() => vi.unstubAllGlobals());
it('supports asynchronous Node parsing without a synchronous document assertion', async () => {
  vi.stubGlobal('DOMParser', undefined);
  const parser = createParser();
  const first = parser('<p>first</p>');
  const second = parser('<p>second</p>');
  expect(first).toBeInstanceOf(Promise);
  const [a, b] = await Promise.all([first, second]);
  expect(a.body.textContent).toBe('first'); expect(b.body.textContent).toBe('second');
  expect(a).not.toBe(b);
  expect((await compileTemplate('<p zen-text="$name"></p>')).effectCount).toBe(1);
});
