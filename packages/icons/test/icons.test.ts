// packages/icons/test/icons.test.ts
// @vitest-environment jsdom
/* global document */
import { describe, it, expect } from 'vitest';
import {
  registerIcons,
  getIcon,
  hasIcon,
  listIcons,
  unregisterIcon,
  defineIconSet,
  renderIcon,
  sanitizeIconBody,
  processIcon,
  BASIC_ICONS,
} from '../src/index';

describe('@zenith/icons (#170)', () => {
  it('قرارداد رجیستری ۵ متدی: register/get/has/list/unregister + Cleanup', () => {
    const undo1 = registerIcons({ heart: { body: '<path d="M1 1"/>' } });
    const undo2 = registerIcons({ 'custom-star': { body: '<path d="M2 2"/>' } });
    expect(hasIcon('heart')).toBe(true);
    expect(getIcon('custom-star')?.body).toContain('M2 2');
    expect(listIcons()).toContain('heart');
    undo1();
    expect(hasIcon('heart')).toBe(false);
    unregisterIcon('custom-star');
    expect(hasIcon('custom-star')).toBe(false);
    undo2();
  });

  it('آیکن بدون label از a11y tree حذف و با label نقش img دارد', () => {
    defineIconSet('default', { star: { body: '<path d="M0 0h1v1H0z"/>' } });
    const hidden = renderIcon('star');
    expect(hidden).toContain('aria-hidden="true"');
    expect(hidden).not.toContain('role="img"');

    const labeled = renderIcon('star', { label: 'ستاره مورد علاقه', size: 24 });
    expect(labeled).toContain('role="img"');
    expect(labeled).toContain('aria-label="ستاره مورد علاقه"');
    expect(labeled).toContain('width="24px"');
  });

  it('SVG مخرب (script/onload/foreignObject) خنثی می‌شود (تست امنیتی #74)', () => {
    registerIcons({
      evil: {
        body: '<script>alert(1)</script><path d="M0 0" onload="hack()"/><foreignObject><div>x</div></foreignObject><circle onmouseover="y()"/>',
      },
    });
    const clean = renderIcon('evil');
    expect(clean).not.toContain('script');
    expect(clean).not.toContain('onload');
    expect(clean).not.toContain('foreignObject');
    expect(clean).not.toContain('onmouseover');
    unregisterIcon('evil');
  });

  it('sanitizeIconBody ورودی تمیز را بدون حذف محتوا حفظ می‌کند', () => {
    const safe = '<path d="M1 2l3 3" stroke="red"/>';
    const out = sanitizeIconBody(safe);
    expect(out).toContain('d="M1 2l3 3"');
    expect(out).toContain('stroke="red"');
    expect(out).not.toContain('script');
    expect(out).not.toContain('foreignObject');
  });

  it('defineIconSet با prefix زیرمجموعه‌ها را جدا می‌کند', () => {
    const undo = defineIconSet('brands', { logo: { body: '<rect/>' } }, { prefix: 'brands' });
    expect(hasIcon('brands:logo')).toBe(true);
    undo();
  });

  it('processIcon مقدار آیکن را درون عنصر رندر و spin اعمال می‌کند', () => {
    defineIconSet('default', { sun: { body: '<circle/>' } });
    const el = document.createElement('span');
    el.setAttribute('zen-icon', 'sun');
    el.setAttribute('zen-icon-spin', 'true');
    document.body.appendChild(el);
    const dispose = processIcon(el, 'sun');
    expect(el.innerHTML).toContain('svg');
    expect(el.innerHTML).toContain('zen-icon-spin');
    dispose();
    expect(el.innerHTML).toBe('');
  });

  it('BASIC_ICONS دارای حداقل ۵ آیکن سالم است', () => {
    expect(Object.keys(BASIC_ICONS).length).toBeGreaterThanOrEqual(5);
    for (const body of Object.values(BASIC_ICONS)) {
      const rendered = renderIconBodyCheck(body);
      expect(rendered).not.toContain('script');
    }
  });
});

function renderIconBodyCheck(def: unknown): string {
  const body = typeof def === 'string' ? def : (def as { body: string }).body;
  return sanitizeIconBody(body);
}
