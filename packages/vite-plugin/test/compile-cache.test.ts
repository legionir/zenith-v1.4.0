// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { transformHtml, clearCompileCache, getCompileCacheStats } from '../src/index';

describe('@zenith/vite-plugin full compile LRU cache (#15)', () => {
  beforeEach(() => {
    clearCompileCache();
  });

  it('caches transformHtml results across repeated calls and isolates returned warnings array', async () => {
    const html = `<div><h1 zen-text="$title"></h1><p zen-show="$visible">Hello</p></div>`;

    const r1 = await transformHtml(html, 'src/pages/index.html');
    const statsAfterFirst = getCompileCacheStats();
    expect(statsAfterFirst.misses).toBe(1);
    expect(statsAfterFirst.hits).toBe(0);
    expect(statsAfterFirst.transformEntries).toBe(1);

    // Mutate r1.warnings to prove cached copy is isolated
    r1.warnings.push('mutated');

    const r2 = await transformHtml(html, 'src/pages/index.html');
    const statsAfterSecond = getCompileCacheStats();
    expect(statsAfterSecond.misses).toBe(1);
    expect(statsAfterSecond.hits).toBe(1);
    expect(r2.html).toBe(r1.html);
    expect(r2.js).toBe(r1.js);
    expect(r2.warnings).not.toContain('mutated');
  });
});
