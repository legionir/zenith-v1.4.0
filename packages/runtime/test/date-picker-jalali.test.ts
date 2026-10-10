// @vitest-environment jsdom
//
// #146 — مصرف‌کنندهٔ داخلی runtime (دایرکتیو zen-date-picker) باید روی API مبنا
// (@zenith/jalali) کار کند، نه aliasهای deprecated در @zenith/i18n.
// الگو: #47 (zen-if → createTransition) — فراخوانی داخلی نباید هیچ هشدار
// ZEN-DEPR برای برنامهٔ کاربر تولید کند.
//
// قرمز قبل از رفع: date-picker از toJalali/fromJalali/jalaliMonthDays/
// jalaliMonthName/parseJalaliParts (i18n) استفاده می‌کرد و هر mount یک
// ZEN-DEPR-006/007/011/012/008 تولید می‌کرد.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resetDeprecationWarnings } from '@zenith/errors';
import { processDatePicker } from '../src/directives/date-picker';

describe('zen-date-picker uses @zenith/jalali without deprecation noise (#146)', () => {
  let warns: string[];
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warns = [];
    spy = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      warns.push(args.map(String).join(' '));
    });
    resetDeprecationWarnings();
    if (!customElements.get('zen-date-picker')) {
      // ثبت المان از راه خود directive (idempotent).
    }
  });

  afterEach(() => {
    spy.mockRestore();
    resetDeprecationWarnings();
    document.body.innerHTML = '';
  });

  it('mounting and rendering emits no ZEN-DEPR warnings', () => {
    document.body.innerHTML = '<zen-date-picker value="1403/01/01"></zen-date-picker>';
    const el = document.querySelector('zen-date-picker') as HTMLElement;
    const dispose = processDatePicker(el, {});
    // connectedCallback/render باید بدون هیچ هشدار deprecated اجرا شود.
    expect(el).toBeTruthy();
    const dep = warns.filter((w) => w.includes('ZEN-DEPR'));
    expect(dep).toHaveLength(0);
    dispose();
  });

  it('renders Farvardin (month 1) header with the Jalali month name in Persian', () => {
    document.body.innerHTML = '<zen-date-picker value="1403/01/01"></zen-date-picker>';
    const el = document.querySelector('zen-date-picker') as any;
    const dispose = processDatePicker(el, {});
    // custom element خودش connectedCallback را اجرا می‌کند؛ سایه‌ریشه باید
    // برچسب «فروردین» داشته باشد (نام ماه از @zenith/jalali).
    const label = el.shadowRoot?.querySelector('.zen-date-picker__label');
    expect(label?.textContent).toContain('فروردین');
    expect(warns.filter((w) => w.includes('ZEN-DEPR'))).toHaveLength(0);
    dispose();
  });

  it('selecting a day fires change with a Jalali YYYY/MM/DD value (no deprecation)', () => {
    document.body.innerHTML = '<zen-date-picker value="1403/02/01"></zen-date-picker>';
    const el = document.querySelector('zen-date-picker') as any;
    const dispose = processDatePicker(el, {});
    let detail: any = null;
    el.addEventListener('change', (e: Event) => {
      detail = (e as CustomEvent).detail;
    });
    const dayCells = el.shadowRoot.querySelectorAll('.zen-date-picker__day');
    // اردیبهشت ۳۱ روزه است؛ ۱۵ام را انتخاب می‌کنیم.
    (dayCells[14] as HTMLElement).click();
    expect(detail?.value).toBe('۱۴۰۳/۰۲/۱۵');
    expect(warns.filter((w) => w.includes('ZEN-DEPR'))).toHaveLength(0);
    dispose();
  });
});
