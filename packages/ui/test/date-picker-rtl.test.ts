// @vitest-environment jsdom
//
// #100 — date-picker resolves the effective direction (explicit dir beats
// locale; inherited dir beats the locale default; runtime switches re-render)
// and flips APG calendar keys. Code-first tests, not executed.
import { afterEach, expect, it } from 'vitest';
import { processDatePicker, type ZenDatePicker } from '../src/date-picker';

afterEach(() => {
  document.body.replaceChildren();
  document.documentElement.removeAttribute('dir');
});

function mounted(attrs: string, wrapperDir?: 'rtl' | 'ltr'): ZenDatePicker {
  processDatePicker(document.body, {});
  const wrapper = document.createElement('div');
  if (wrapperDir) wrapper.setAttribute('dir', wrapperDir);
  const el = document.createElement('zen-date-picker') as ZenDatePicker;
  el.setAttribute('value', '1403/01/10');
  for (const attr of attrs.split(' ').filter(Boolean)) {
    const [name, value] = attr.split('=');
    el.setAttribute(name!, value!);
  }
  wrapper.appendChild(el);
  document.body.appendChild(wrapper);
  return el;
}

function shellDir(el: ZenDatePicker): string | null {
  return el.shadowRoot!.querySelector('.zen-date-picker')!.getAttribute('dir');
}

function key(element: HTMLElement, value: string) {
  element.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

it('lets an explicit dir override the locale default in both directions', () => {
  // fa defaults to RTL, but explicit ltr wins.
  const ltr = mounted('locale=fa', 'ltr');
  expect(shellDir(ltr)).toBe('ltr');
  // en defaults to LTR, but explicit rtl wins.
  const rtl = mounted('locale=en', 'rtl');
  expect(shellDir(rtl)).toBe('rtl');
});

it('falls back to the locale when no dir is inherited', () => {
  expect(shellDir(mounted('locale=fa'))).toBe('rtl');
  expect(shellDir(mounted('locale=en'))).toBe('ltr');
});

it('re-renders the direction on a runtime dir switch', async () => {
  processDatePicker(document.body, {});
  const wrapper = document.createElement('div');
  wrapper.setAttribute('dir', 'ltr');
  const el = document.createElement('zen-date-picker') as ZenDatePicker;
  el.setAttribute('value', '1403/01/10');
  el.setAttribute('locale', 'fa');
  wrapper.appendChild(el);
  document.body.appendChild(wrapper);
  expect(shellDir(el)).toBe('ltr');
  wrapper.setAttribute('dir', 'rtl');
  await tick();
  expect(shellDir(el)).toBe('rtl');
});

it('moves ArrowLeft forward in RTL (fa default)', () => {
  const el = mounted('locale=fa');
  const tenth = el.shadowRoot!.querySelector<HTMLElement>('[data-day="10"]')!;
  tenth.focus();
  key(tenth, 'ArrowLeft');
  expect((el.shadowRoot!.activeElement as HTMLElement).getAttribute('aria-label')).toMatch(/^1403\/1\/11$/);
});

it('moves ArrowRight forward in LTR (explicit dir over fa locale)', () => {
  const el = mounted('locale=fa calendar=jalali', 'ltr');
  const tenth = el.shadowRoot!.querySelector<HTMLElement>('[data-day="10"]')!;
  tenth.focus();
  key(tenth, 'ArrowRight');
  expect((el.shadowRoot!.activeElement as HTMLElement).getAttribute('aria-label')).toMatch(/^1403\/1\/11$/);
});
