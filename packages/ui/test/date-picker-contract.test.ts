// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { signal } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { createApp } from '@zenith/runtime-core';
import { createDatePicker, processDatePicker, datePickerOptions, uiPlugin, type DatePickerElement, type DatePickerChange } from '../src';
function picker(attributes: Record<string, string> = {}, parent: HTMLElement = document.body) {
  const el = document.createElement('zen-date-picker') as DatePickerElement;
  for (const [key, value] of Object.entries(attributes)) el.setAttribute(key, value);
  parent.append(el); return el;
}
function day(el: DatePickerElement, value: number) { return el.shadowRoot!.querySelector<HTMLButtonElement>(`[data-day="${value}"]`)!; }
function key(el: HTMLElement, value: string) { el.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true })); }
beforeEach(() => { processDatePicker(document.body, {}); });
afterEach(() => { document.body.replaceChildren(); });

describe('calendar parsing, display and constraints', () => {
  it('renders Gregorian leap dates with ISO output and LTR keyboard movement', () => {
    const el = picker({ calendar: 'gregorian', locale: 'en-US', format: 'YYYY-MM-DD', value: '2024-02-28' });
    expect(el.shadowRoot!.querySelectorAll('[data-day]')).toHaveLength(29); expect(el.shadowRoot!.querySelector('.zen-date-picker')!.getAttribute('dir')).toBe('ltr');
    day(el, 28).focus(); key(day(el, 28), 'ArrowRight'); expect((el.shadowRoot!.activeElement as HTMLElement).dataset.day).toBe('29'); key(el.shadowRoot!.activeElement as HTMLElement, 'Enter'); expect(el.value).toBe('2024-02-29');
  });
  it('accepts ISO Gregorian input with the default format and supports reordered tokens', () => {
    const el = picker({ calendar: 'gregorian', locale: 'en', value: '2024-02-29' }); expect(el.validity.valid).toBe(true); expect(day(el, 29).getAttribute('aria-selected')).toBe('true');
    el.format = 'DD.MM.YYYY'; el.value = '29.02.2024'; day(el, 15).click(); expect(el.value).toBe('15.02.2024');
  });
  it('uses configured first-day for weekday headers and Home/End navigation', () => {
    const el = picker({ calendar: 'gregorian', locale: 'en', value: '2024-05-15', 'first-day': '0' });
    expect(el.shadowRoot!.querySelector('[role="columnheader"]')!.textContent).toContain('Sun'); day(el, 15).focus(); key(day(el, 15), 'Home'); expect((el.shadowRoot!.activeElement as HTMLElement).dataset.day).toBe('12');
    key(el.shadowRoot!.activeElement as HTMLElement, 'End'); expect((el.shadowRoot!.activeElement as HTMLElement).dataset.day).toBe('18');
  });
  it('reports malformed/non-leap dates and bounds/exclusions without throwing or enabling invalid input', () => {
    const el = picker({ calendar: 'gregorian', locale: 'en', value: '2023-02-29', min: '2023-02-10', max: '2023-02-20' });
    expect(el.validity.badInput).toBe(true); expect(el.checkValidity()).toBe(false); expect(el.shadowRoot!.querySelectorAll('[data-day]:not(:disabled)')).toHaveLength(0);
    el.value = '2023-02-15'; expect(el.validity.valid).toBe(true); el.setAttribute('disabled-dates', '["2023-02-15"]'); expect(el.validity.customError).toBe(true);
    el.value = '2023-02-09'; expect(el.validity.rangeUnderflow).toBe(true); el.value = '2023-02-21'; expect(el.validity.rangeOverflow).toBe(true);
  });
  it('does not reset a browsed month when only locale/nonce attributes change', () => {
    const el = picker({ calendar: 'gregorian', locale: 'en', value: '2024-02-01' }); el.shadowRoot!.querySelector<HTMLButtonElement>('[data-nav="next"]')!.click();
    const label = el.shadowRoot!.querySelector('.zen-date-picker__label')!.textContent; el.setAttribute('nonce', 'render-nonce'); expect(el.shadowRoot!.querySelector('.zen-date-picker__label')!.textContent).toBe(label);
    expect(el.shadowRoot!.querySelector('style')!.getAttribute('nonce')).toBe('render-nonce');
  });
  it('validates raw configuration and JSON exclusions through the common schema boundary', () => {
    expect(() => datePickerOptions.resolve({ firstDay: 7 })).toThrow(); expect(() => datePickerOptions.resolve({ format: 'YYYY/YYYY/DD' })).toThrow(); expect(() => datePickerOptions.resolve({ locale: 'not_a_locale' })).toThrow();
    const el = picker({ 'disabled-dates': '{broken' }); expect(el.validity.badInput).toBe(true); el.setAttribute('disabled-dates', '[]'); expect(el.validity.valid).toBe(true);
  });
});

describe('range values and form ownership', () => {
  it('keeps partial ranges out of submission, orders reverse selections and marks the full interval', () => {
    const form = document.createElement('form'); document.body.append(form);
    const el = picker({ calendar: 'gregorian', locale: 'en', format: 'YYYY-MM-DD', value: '', range: '', name: 'stay' }, form);
    // Put the empty picker in a deterministic month without selecting a range.
    el.value = '2024-02-01..2024-02-02'; day(el, 20).click(); expect(el.value).toBe('2024-02-20..'); expect(new FormData(form).has('stay')).toBe(false); expect(el.validity.badInput).toBe(true);
    day(el, 10).click(); expect(el.value).toBe('2024-02-10..2024-02-20'); expect(new FormData(form).get('stay')).toBe(el.value); expect(el.shadowRoot!.querySelectorAll('[data-day][aria-selected="true"]')).toHaveLength(11);
  });
  it('rejects a range crossing an excluded date without silently accepting unavailable interior days', () => {
    const el = picker({ calendar: 'gregorian', locale: 'en', format: 'YYYY-MM-DD', range: '', value: '2024-02-10..', 'disabled-dates': '["2024-02-12"]' }); day(el, 15).click(); expect(el.value).toBe('2024-02-10..'); day(el, 11).click(); expect(el.value).toBe('2024-02-10..2024-02-11');
  });
  it('emits canonical partial/complete detail while preserving legacy single-date change', () => {
    const el = picker({ calendar: 'gregorian', locale: 'en', format: 'YYYY-MM-DD', range: '', value: '2024-02-01..2024-02-02' }); const events: DatePickerChange[] = [], changes: string[] = [];
    el.addEventListener('zen-date-picker-change', event => events.push((event as CustomEvent<DatePickerChange>).detail)); el.addEventListener('change', event => changes.push((event as CustomEvent<DatePickerChange>).detail.value));
    day(el, 10).click(); day(el, 12).click(); expect(events.map(value => value.complete)).toEqual([false, true]); expect(changes).toEqual(['2024-02-10..2024-02-12']);
    const jalali = picker({ value: '1403/02/01', locale: 'fa' }); jalali.addEventListener('change', event => changes.push((event as CustomEvent<DatePickerChange>).detail.value)); day(jalali, 15).click(); expect(changes[1]).toBe('۱۴۰۳/۰۲/۱۵');
  });
  it('submits once, honors readonly/disabled/required, resets and changes form ownership', async () => {
    const a = document.createElement('form'), b = document.createElement('form'); b.id = 'other-form'; document.body.append(a, b);
    const el = picker({ calendar: 'gregorian', locale: 'en', format: 'YYYY-MM-DD', value: '2024-02-10', name: 'date', required: '' }, a);
    expect(new FormData(a).getAll('date')).toEqual(['2024-02-10']); el.readOnly = true; day(el, 12).click(); expect(el.value).toBe('2024-02-10'); expect(new FormData(a).get('date')).toBe(el.value);
    el.readOnly = false; el.value = ''; expect(el.validity.valueMissing).toBe(true); expect(a.checkValidity()).toBe(false);
    a.reset(); await Promise.resolve(); expect(el.value).toBe('2024-02-10'); el.disabled = true; expect(new FormData(a).has('date')).toBe(false); expect(el.checkValidity()).toBe(true);
    el.disabled = false; el.setAttribute('form', b.id); expect(new FormData(a).has('date')).toBe(false); expect(new FormData(b).get('date')).toBe(el.value); expect(el.form).toBe(b);
  });
  it('follows disabled fieldsets, preserves native legend exceptions and reconnects without duplicate values', async () => {
    const form = document.createElement('form'); form.innerHTML = '<fieldset disabled><legend>Dates</legend></fieldset>'; document.body.append(form); const fieldset = form.querySelector('fieldset')!;
    const legend = picker({ calendar: 'gregorian', value: '2024-02-10', name: 'legend-date' }, fieldset.querySelector('legend')!);
    const el = picker({ calendar: 'gregorian', value: '2024-02-10', name: 'date' }, fieldset); await Promise.resolve(); expect(new FormData(form).get('legend-date')).toBe(legend.value); expect(legend.shadowRoot!.querySelector('[data-day]:not(:disabled)')).not.toBeNull(); expect(new FormData(form).has('date')).toBe(false); expect(el.shadowRoot!.querySelectorAll('[data-day]:not(:disabled)')).toHaveLength(0);
    fieldset.disabled = false; await Promise.resolve(); expect(new FormData(form).getAll('date')).toEqual(['2024-02-10']); el.remove(); fieldset.append(el); await Promise.resolve(); expect(new FormData(form).getAll('date')).toHaveLength(1);
  });
  it('clears live form state and old listeners on dispose without removing visible markup', () => {
    const form = document.createElement('form'); document.body.append(form); const el = picker({ calendar: 'gregorian', value: '2024-02-10', name: 'date' }, form), stale = day(el, 12); el.dispose(); stale.click(); expect(el.value).toBe('2024-02-10'); expect(new FormData(form).has('date')).toBe(false); expect(el.shadowRoot!.querySelector('[data-day]')).not.toBeNull();
  });
});

it('leases repeated directive passes and restores reactive programmatic attributes', () => {
  const el = picker({ value: '1403/01/01' }), first = processDatePicker(el, {}), second = processDatePicker(el, {}); first(); day(el, 2).click(); expect(el.value).toBe('۱۴۰۳/۰۱/۰۲'); second();
  const value = signal('2024-02-10'), readonly = signal(false), controller = createDatePicker(el, { calendar: 'gregorian', locale: 'en', format: 'YYYY-MM-DD', value, readOnly: readonly });
  value.set('2024-02-12'); readonly.set(true); flushSync(); expect(el.value).toBe('2024-02-12'); expect(el.readOnly).toBe(true); controller.dispose(); value.set('2024-03-01'); flushSync(); expect(el.value).toBe('۱۴۰۳/۰۱/۰۲'); expect(el.hasAttribute('calendar')).toBe(false); value.dispose(); readonly.dispose();
});

it('binds the custom tag through a real App exactly once with or without an explicit directive attribute', () => {
  const root = document.createElement('main'); root.innerHTML = '<zen-date-picker value="1403/01/01"></zen-date-picker><zen-date-picker zen-date-picker value="1403/01/01"></zen-date-picker>'; document.body.append(root);
  const app = createApp({ plugins: [uiPlugin()] }); app.mount(root); const elements = Array.from(root.querySelectorAll<DatePickerElement>('zen-date-picker'));
  expect(elements.every(el => !!el.shadowRoot?.querySelector('[data-day]'))).toBe(true); app.dispose(); const before = elements[0]!.value; day(elements[0]!, 2).click(); expect(elements[0]!.value).toBe(before);
});

it('retains an unchanged authored value through native/proxy form reset', async () => {
  const form = document.createElement('form'); document.body.append(form);
  const el = picker({ calendar: 'gregorian', value: '2024-02-10', name: 'date' }, form);
  form.reset(); await Promise.resolve(); expect(el.value).toBe('2024-02-10'); expect(new FormData(form).get('date')).toBe('2024-02-10');
});

it('preserves the connected month live region across keyboard and navigation renders', () => {
  const el = picker({ calendar: 'gregorian', value: '2024-02-10', locale: 'en' });
  const announcer = el.shadowRoot!.querySelector('[role="status"]')!, before = announcer.textContent;
  day(el, 10).focus(); key(day(el, 10), 'ArrowRight'); expect(el.shadowRoot!.querySelector('[role="status"]')).toBe(announcer); expect(announcer.isConnected).toBe(true); expect(announcer.textContent).toBe(before);
  el.shadowRoot!.querySelector<HTMLButtonElement>('[data-nav="next"]')!.click(); expect(el.shadowRoot!.querySelector('[role="status"]')).toBe(announcer); expect(announcer.textContent).not.toBe(before);
});
it('updates inherited language and direction without replacing the live region', async () => {
  const parent = document.createElement('section'); parent.lang = 'en'; parent.dir = 'ltr'; document.body.append(parent);
  const el = picker({ calendar: 'gregorian', value: '2024-02-10' }, parent), announcer = el.shadowRoot!.querySelector('[role="status"]');
  expect(el.shadowRoot!.querySelector('.zen-date-picker')!.getAttribute('dir')).toBe('ltr'); parent.lang = 'fa'; parent.dir = 'rtl'; await Promise.resolve();
  expect(el.locale).toBe('fa'); expect(el.shadowRoot!.querySelector('.zen-date-picker')!.getAttribute('dir')).toBe('rtl'); expect(el.shadowRoot!.querySelector('[role="status"]')).toBe(announcer);
});
it('follows HTML boolean presence even for the literal text false', () => {
  const el = picker({ calendar: 'gregorian', value: '2024-02-10', disabled: 'false' }); expect(el.disabled).toBe(true); expect(el.checkValidity()).toBe(true); expect(el.shadowRoot!.querySelector('[data-day]:not(:disabled)')).toBeNull();
  el.disabled = false; expect(el.hasAttribute('disabled')).toBe(false); expect(el.shadowRoot!.querySelector('[data-day]:not(:disabled)')).not.toBeNull();
});

it('round-trips localized non-Persian digits instead of invalidating its own output', () => {
  const el = picker({ calendar: 'gregorian', locale: 'bn', format: 'YYYY-MM-DD', value: '2024-02-10' });
  day(el, 15).click(); expect(el.value).toBe('২০২৪-০২-১৫'); expect(el.validity.valid).toBe(true); expect(day(el, 15).getAttribute('aria-selected')).toBe('true');
  el.value = '2024-02-15'; el.locale = 'en-u-nu-hanidec'; day(el, 16).click(); expect(el.value).toBe('二〇二四-〇二-一六'); expect(el.validity.valid).toBe(true);
});

it('does not emit stale canonical/legacy changes after input reconfigures the calendar', () => {
  const el = picker({ calendar: 'gregorian', value: '2024-02-10' }), events: string[] = [];
  el.addEventListener('input', () => { el.calendar = 'jalali'; }); el.addEventListener('zen-date-picker-change', () => events.push('canonical')); el.addEventListener('change', () => events.push('legacy'));
  day(el, 15).click(); expect(el.calendar).toBe('jalali'); expect(events).toEqual([]);
});
it('rejects unknown JavaScript options without owning an undefined attribute', () => {
  const el = picker({ value: '1403/02/10', undefined: 'authored' });
  expect(() => createDatePicker(el, Object.assign({ locale: 'fa' }, { typo: true }))).toThrow(); expect(el.getAttribute('undefined')).toBe('authored');
  const controller = createDatePicker(el); controller.dispose();
});
