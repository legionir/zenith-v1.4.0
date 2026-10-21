// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { createParser } from '../src/parser';
vi.mock('jsdom', () => { throw new Error('optional parser unavailable'); });
afterEach(() => vi.unstubAllGlobals());
it('keeps the actionable optional-parser failure and the rejected per-parser import promise', async () => {
  vi.stubGlobal('DOMParser', undefined); const parser = createParser();
  const message = '[Zenith Compiler] DOMParser or jsdom is required. Install jsdom: npm install jsdom';
  await expect(parser('<p>one</p>')).rejects.toThrow(message);
  await expect(parser('<p>two</p>')).rejects.toThrow(message);
});
