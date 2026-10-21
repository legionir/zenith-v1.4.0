// #95 — static consistency tests for the degradation matrix. Real capability
// blocking stays in e2e/degradation.spec.ts (needs a browser); these pin the
// fixture/spec contract so the matrix cannot silently rot: the noscript
// content, the importmap entry, the contamination-free SW, and one spec case
// per matrix mode.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

describe('#95 — degradation matrix contract', () => {
  it('the fixture carries usable noscript content and the storage/SW probes', () => {
    const fixture = read('e2e/degradation-fixture.html');
    expect(fixture).toContain('<noscript>');
    expect(fixture).toContain('id="noscript"');
    expect(fixture).toContain('/dashboard/index.html');
    expect(fixture).toContain('/ecommerce-demo/index.html');
    expect(fixture).toContain('"@zenith/storage": "/packages/storage/dist/index.js"');
    expect(fixture).toContain('__ZENITH_DEGRADE_READY__');
    expect(fixture).toContain('/e2e/degradation-sw.js');
    expect(fixture).toContain('/e2e/__degradation_scope__/');
  });

  it('the scope-holder SW can never serve stale bytes to other specs', () => {
    const sw = read('e2e/degradation-sw.js');
    expect(sw).not.toMatch(/addEventListener\(['"]fetch['"]/);
    expect(sw).not.toContain('respondWith');
    expect(sw).toContain('skipWaiting');
  });

  it('the spec covers every matrix mode with fail-loud assertions', () => {
    const spec = read('e2e/degradation.spec.ts');
    for (const marker of [
      'javaScriptEnabled: false', // js-off
      '**/degradation-sw.js', // sw-blocked
      'indexedDB', // no-idb capability block
      'localStorage', // no-webstorage + quota stubs
      'QuotaExceededError', // write-time quota path
      '__ZENITH_DEGRADE_READY__',
      'pageErrors', // zero-unhandled-exceptions criterion in every mode
    ]) {
      expect(spec, marker).toContain(marker);
    }
    // No mode may assert on console noise — ZEN-1101/ZEN-1102 warnings are
    // the safe error reporting the criterion requires, not failures.
    expect(spec).not.toContain('consoleErrors');
  });
});
