// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { processDatePicker, type ZenDatePicker } from '../src/date-picker';
afterEach(() => document.body.replaceChildren());
function picker() { processDatePicker(document.body, {}); const el = document.createElement('zen-date-picker') as ZenDatePicker; el.setAttribute('value', '1403/01/01'); document.body.appendChild(el); return el; }
function key(element: HTMLElement, value: string, shiftKey = false) { element.dispatchEvent(new KeyboardEvent('keydown', { key: value, shiftKey, bubbles: true, cancelable: true })); }
it('offers one calendar tab stop and navigates across month/year boundaries with APG keys', () => {
  const el = picker(); const first = el.shadowRoot!.querySelector<HTMLElement>('[data-day="1"]')!; first.focus(); key(first, 'ArrowRight');
  const focused = el.shadowRoot!.activeElement as HTMLElement; expect(focused.getAttribute('aria-label')).toMatch(/^1402\/12\//); expect(el.shadowRoot!.querySelectorAll('[role="gridcell"][tabindex="0"]')).toHaveLength(1);
  key(focused, 'PageDown', true); expect((el.shadowRoot!.activeElement as HTMLElement).getAttribute('aria-label')).toMatch(/^1403\/12\//);
  key(el.shadowRoot!.activeElement as HTMLElement, 'Enter'); expect(el.value).toMatch(/^۱۴۰۳\/۱۲\//);
});
it('cleans listeners on every rerender and disconnect, then rebinds on reconnect', () => {
  const el = picker(); const stale = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-nav="next"]')!; stale.click();
  const before = el.shadowRoot!.querySelector('.zen-date-picker__label')!.textContent; stale.click(); expect(el.shadowRoot!.querySelector('.zen-date-picker__label')!.textContent).toBe(before);
  const detached = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-nav="next"]')!; el.remove(); detached.click(); expect(el.shadowRoot!.querySelector('.zen-date-picker__label')!.textContent).toBe(before);
  document.body.appendChild(el); el.shadowRoot!.querySelector<HTMLButtonElement>('[data-nav="next"]')!.click(); expect(el.shadowRoot!.querySelector('.zen-date-picker__label')!.textContent).not.toBe(before);
});

it('respects disabled/min/max/date exclusions and clearing the selection', () => {
  const picker = document.createElement('zen-date-picker'); picker.setAttribute('value', '1403/01/10'); picker.setAttribute('min', '1403/01/10'); picker.setAttribute('max', '1403/01/12'); picker.setAttribute('disabled-dates', '["1403/01/11"]'); document.body.appendChild(picker);
  const root = picker.shadowRoot!; expect(root.querySelector<HTMLButtonElement>('[data-day="9"]')!.disabled).toBe(true); expect(root.querySelector<HTMLButtonElement>('[data-day="11"]')!.disabled).toBe(true); expect(root.querySelector<HTMLButtonElement>('[data-day="12"]')!.disabled).toBe(false);
  picker.removeAttribute('value'); expect(root.querySelector('[aria-selected="true"]')).toBeNull(); picker.setAttribute('disabled', ''); expect(root.querySelectorAll('[data-day]:not(:disabled)')).toHaveLength(0);
  picker.remove();
});
it('applies the explicit CSP nonce to its shadow stylesheet', () => {
  const picker = document.createElement('zen-date-picker'); picker.setAttribute('nonce', 'owner-nonce'); document.body.appendChild(picker); expect(picker.shadowRoot!.querySelector('style')!.getAttribute('nonce')).toBe('owner-nonce'); picker.remove();
});
it('registers a usable constructor in an iframe owner realm without changing global constructors', () => {
  const frame = document.createElement('iframe'); document.body.appendChild(frame); const doc = frame.contentDocument!; const base = HTMLElement;
  processDatePicker(doc.body, {}); const el = doc.createElement('zen-date-picker'); el.setAttribute('value', '1403/01/01'); doc.body.appendChild(el);
  expect(el.shadowRoot!.querySelector('[data-day="1"]')).not.toBeNull(); expect(HTMLElement).toBe(base); frame.remove();
});

it('sets nonce before stylesheet insertion and replaces the stylesheet when nonce changes', () => {
  processDatePicker(document.body, {}); const el = document.createElement('zen-date-picker'); el.setAttribute('nonce', 'first-nonce'); document.body.append(el); const first = el.shadowRoot!.querySelector('style')!;
  expect(first.nonce || first.getAttribute('nonce')).toBe('first-nonce'); el.setAttribute('nonce', 'second-nonce'); const second = el.shadowRoot!.querySelector('style')!; expect(second).not.toBe(first); expect(first.isConnected).toBe(false); expect(second.nonce || second.getAttribute('nonce')).toBe('second-nonce'); expect(el.shadowRoot!.querySelectorAll('style')).toHaveLength(1); el.removeAttribute('nonce'); const third = el.shadowRoot!.querySelector('style')!; expect(third).not.toBe(second); expect(third.hasAttribute('nonce')).toBe(false); el.remove();
});
