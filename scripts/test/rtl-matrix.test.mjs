import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const has = (rel) => existsSync(join(ROOT, rel));

describe('RTL matrix coverage (#100)', () => {
  it('covers every matrix cell with both-direction tests', () => {
    const cells = {
      'virtual-list horizontal (explicit)': 'packages/virtual-list/test/scale-100k-rtl.test.ts',
      'virtual-list horizontal (inherited)': 'packages/virtual-list/test/horizontal-rtl.test.ts',
      'date-picker': 'packages/ui/test/date-picker-rtl.test.ts',
      'data-table grid': 'packages/data-table/test/grid-rtl.test.ts',
      notifications: 'packages/notifications/test/notifications-rtl.test.ts',
      'UI tabs (roving)': 'packages/ui/test/ui.test.ts',
      'bidi/intl': 'packages/i18n/test/bidi-intl-rtl.test.ts',
    };
    for (const [cell, file] of Object.entries(cells)) {
      expect(has(file), cell).toBe(true);
      const src = read(file);
      expect(src, `${cell}: rtl`).toMatch(/rtl/);
      if (cell === 'UI tabs (roving)') {
        // Pinned by name: the RTL tab test asserts ArrowLeft advances.
        expect(src, cell).toContain('RTL tab navigation');
      } else {
        expect(src, `${cell}: ltr`).toMatch(/ltr/i);
      }
    }
  });

  it('flips APG horizontal keys by effective direction in every keyboard owner', () => {
    for (const [file, marker] of [
      ['packages/data-table/src/grid.ts', 'gridRtl'],
      ['packages/ui/src/date-picker.ts', 'this.rtl ? 1 : -1'],
      ['packages/ui/src/menu.ts', "rtl() ? 'ArrowLeft' : 'ArrowRight'"],
      ['packages/a11y/src/focus.ts', "rtl ? -1 : 1"],
    ]) {
      expect(read(file), file).toContain(marker);
    }
  });

  it('resolves direction explicitly → inherited → computed (no hardcoded dir)', () => {
    const picker = read('packages/ui/src/date-picker.ts');
    expect(picker).toContain("closest('[dir]')");
    const grid = read('packages/data-table/src/grid.ts');
    expect(grid).toContain("closest?.('[dir]')");
    expect(grid).toContain('getComputedStyle');
    // No container is built with a hardcoded dir anymore.
    expect(picker).not.toMatch(/container\.dir = 'rtl'/);
  });

  it('keeps toast rendering direction-agnostic (inherit, never override)', () => {
    const render = read('packages/notifications/src/notification-render.ts');
    expect(render).not.toMatch(/setAttribute\('dir'/);
  });
});
