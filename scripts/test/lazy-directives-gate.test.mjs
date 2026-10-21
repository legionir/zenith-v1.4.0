import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

describe('lazy heavy directives static gate (#88)', () => {
  it('keeps date-picker and virtual-repeat out of the eager walker entry', () => {
    const walker = read('packages/runtime/src/walk-tree.ts');
    // Type-only imports are erased (bundler-safe); value imports would
    // drag the chunks back into the entry.
    expect(walker).not.toMatch(/import \{[^}]*processDatePicker[^}]*\} from '\.\/directives\/date-picker'/);
    expect(walker).not.toMatch(/import \{[^}]*processVirtualRepeat[^}]*\} from '\.\/directives\/virtual-repeat'/);
    expect(walker).toMatch(/import type \{ processVirtualRepeat \}/);
    expect(walker).toMatch(/import type \{ processDatePicker \}/);
    expect(walker).toContain('processLazyDirective');
    expect(walker).toContain('isLazyBound');
  });

  it('loads the heavy modules only through dynamic import in the lazy registry', () => {
    const lazy = read('packages/runtime/src/directives/lazy.ts');
    expect(lazy).toMatch(/load: \(\) => import\('\.\/virtual-repeat'\)/);
    expect(lazy).toMatch(/load: \(\) => import\('\.\/date-picker'\)/);
    expect(lazy).not.toMatch(/^import .* from '\.\/virtual-repeat';?$/m);
    expect(lazy).not.toMatch(/^import .* from '\.\/date-picker';?$/m);
    expect(lazy).toContain('zen-virtual');
    expect(lazy).toContain('zen-date-picker');
    expect(lazy).toContain('data-zen-lazy-bound');
    expect(lazy).toContain('onGlobalReset');
  });

  it('publishes the lazy API on the root facade and the internal reset hook', () => {
    const exports = read('packages/runtime/src/exports.ts');
    for (const name of [
      'registerLazyDirective',
      'ensureLazyProcessor',
      'preloadLazyDirectives',
      'lazyDirectiveManifest',
      'processLazyDirective',
      'isLazyBound',
    ]) {
      expect(exports, name).toContain(name);
    }
    // Generic consumer path (crud/data-table shaped) is wired, not decorative.
    expect(read('packages/runtime/src/walk-tree.ts')).toContain('matchLazyDirective');
    expect(read('packages/runtime/src/directives/lazy.ts')).toContain('processExport');
    // Eager direct-consumer exports stay (no breaking change).
    expect(exports).toContain('processDatePicker');
    expect(exports).toContain('processVirtualRepeat');
    expect(read('packages/runtime/src/walker.ts')).toContain('clearLazyDirectivesInternal');
  });
});
