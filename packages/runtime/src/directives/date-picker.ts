// packages/runtime/src/directives/date-picker.ts
//
// FEATURE (v1.2.0): zen-date-picker — Persian (Jalali) date picker web component.
//
// Registers a `<zen-date-picker>` custom element that renders an RTL grid
// calendar with month navigation and day selection. The selected date is
// emitted as a Jalali `YYYY/MM/DD` string via a `change` event.
//
// Usage:
//   <zen-date-picker></zen-date-picker>
//   <zen-date-picker value="1403/05/15"></zen-date-picker>
//
// Implementation notes:
//   - #146: the component uses the base calendar API from `@zenith/jalali`
//     (`toJalaliParts`, `fromJalaliParts`, `monthDays`, `monthName`) — the
//     deprecated `@zenith/i18n` jalali aliases are no longer consumed here,
//     so mounting a picker emits no ZEN-DEPR warnings (precedent: #47).
//   - Calendar arithmetic is day-granular and UTC-deterministic:
//     `fromJalaliParts` returns UTC midnight and the weekday grid uses
//     `getUTCDay()`, so SSR/client rendering cannot drift by timezone.
//     The viewed-date extraction uses `timeZone: 'local'` (a picker shows
//     the user's own today).
//   - The grid is laid out in RTL direction (Saturday..Friday header row
//     followed by up to six day rows).
//   - Month navigation arrows move the viewed month; selecting a day both
//     updates the viewed month and fires `change`.
//
// SSR safety:
//   - `customElements.define` is called only when `customElements` is
//     available (i.e. in the browser). The directive is a no-op on the
//     server.

import {
  toJalaliParts,
  fromJalaliParts,
  monthDays,
  monthName,
  isValidJalali,
  toPersianDigits,
  toLatinDigits,
} from '@zenith/jalali';

const PICKER_TAG = 'zen-date-picker';

/**
 * The class registered as the `<zen-date-picker>` custom element.
 *
 * It is intentionally a standalone class so that consumers who want to
 * extend it can do so without re-registering the tag.
 */
export class ZenDatePicker extends HTMLElement {
  private viewYear: number;
  private viewMonth: number; // 1..12
  private selected: { y: number; m: number; d: number } | null = null;
  private root: ShadowRoot | HTMLElement;
  // Real listener cleanup storage
  private _listeners: Array<{ el: HTMLElement | Element; event: string; fn: EventListener }> = [];

  constructor() {
    super();
    const today = parseJalaliToday();
    this.viewYear = today.y;
    this.viewMonth = today.m;

    // Use a shadow DOM if available; otherwise render into the element.
    if (typeof (this as any).attachShadow === 'function') {
      this.root = (this as any).attachShadow({ mode: 'open' });
    } else {
      this.root = this;
    }
  }

  static get observedAttributes(): string[] {
    return ['value'];
  }

  attributeChangedCallback(name: string, _oldVal: string | null, newVal: string | null): void {
    if (name === 'value' && newVal) {
      const parsed = parseJalaliString(newVal);
      if (parsed) {
        this.selected = parsed;
        this.viewYear = parsed.y;
        this.viewMonth = parsed.m;
        this.render();
      }
    }
  }

  connectedCallback(): void {
    const initial = this.getAttribute('value');
    if (initial) {
      const parsed = parseJalaliString(initial);
      if (parsed) {
        this.selected = parsed;
        this.viewYear = parsed.y;
        this.viewMonth = parsed.m;
      }
    }
    this.render();
  }

  private addTrackedListener(el: HTMLElement | Element, event: string, fn: EventListener): void {
    el.addEventListener(event, fn);
    this._listeners.push({ el, event, fn });
  }

  public dispose(): void {
    for (const { el, event, fn } of this._listeners) {
      try {
        el.removeEventListener(event, fn);
      } catch {
        /* ignore */
      }
    }
    this._listeners.length = 0;
  }

  private render(): void {
    if (typeof document === 'undefined') return;
    const root = this.root;
    // Clear existing content.
    while (root.firstChild) root.removeChild(root.firstChild);

    const container = document.createElement('div');
    container.className = 'zen-date-picker';
    container.setAttribute('dir', 'rtl');

    // Header row: prev arrow, month/year label, next arrow.
    const header = document.createElement('div');
    header.className = 'zen-date-picker__header';

    const prev = document.createElement('button');
    prev.type = 'button';
    prev.textContent = '›'; // RTL: › points backward
    prev.className = 'zen-date-picker__nav';
    this.addTrackedListener(prev, 'click', () => this.moveMonth(-1));

    const label = document.createElement('span');
    label.className = 'zen-date-picker__label';
    label.textContent = `${monthName(this.viewMonth)} ${toPersianDigits(this.viewYear)}`;

    const next = document.createElement('button');
    next.type = 'button';
    next.textContent = '‹'; // RTL: ‹ points forward
    next.className = 'zen-date-picker__nav';
    this.addTrackedListener(next, 'click', () => this.moveMonth(1));

    header.appendChild(prev);
    header.appendChild(label);
    header.appendChild(next);
    container.appendChild(header);

    // Weekday header row. Persian week starts on Saturday.
    const weekdays = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
    const grid = document.createElement('div');
    grid.className = 'zen-date-picker__grid';
    for (const w of weekdays) {
      const cell = document.createElement('span');
      cell.className = 'zen-date-picker__weekday';
      cell.textContent = w;
      grid.appendChild(cell);
    }

    // Day cells.
    const days = monthDays(this.viewYear, this.viewMonth);
    // Find the weekday of the 1st of the month in the Jalali calendar.
    // #146: fromJalaliParts ⇒ UTC midnight; getUTCDay() keeps the grid
    // timezone-independent (same render on server and client).
    const firstDate = fromJalaliParts(this.viewYear, this.viewMonth, 1);
    // JS getUTCDay(): 0=Sunday, 6=Saturday. Convert to Persian (Sat=0..Fri=6).
    const jsDay = firstDate.getUTCDay();
    const persianFirstWeekday = (jsDay + 1) % 7; // Sat=0, Sun=1, ..., Fri=6

    for (let i = 0; i < persianFirstWeekday; i++) {
      const blank = document.createElement('span');
      blank.className = 'zen-date-picker__blank';
      grid.appendChild(blank);
    }

    for (let d = 1; d <= days; d++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'zen-date-picker__day';
      cell.textContent = toPersianDigits(d);
      if (
        this.selected &&
        this.selected.y === this.viewYear &&
        this.selected.m === this.viewMonth &&
        this.selected.d === d
      ) {
        cell.classList.add('zen-date-picker__day--selected');
      }
      this.addTrackedListener(cell, 'click', () => this.selectDay(d));
      grid.appendChild(cell);
    }

    container.appendChild(grid);

    // Inline minimal styles (so the picker is usable out of the box).
    if (this.root instanceof ShadowRoot) {
      const style = document.createElement('style');
      style.textContent = `
.zen-date-picker { display: inline-block; font-family: inherit; }
.zen-date-picker__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4em; }
.zen-date-picker__nav { background: none; border: 0; cursor: pointer; font-size: 1.2em; padding: 0 0.4em; }
.zen-date-picker__label { font-weight: 600; }
.zen-date-picker__grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.zen-date-picker__weekday, .zen-date-picker__day, .zen-date-picker__blank {
  display: inline-flex; align-items: center; justify-content: center;
  width: 2em; height: 2em;
}
.zen-date-picker__weekday { font-weight: 600; color: #666; }
.zen-date-picker__day { background: none; border: 1px solid transparent; cursor: pointer; border-radius: 4px; }
.zen-date-picker__day:hover { background: #eee; }
.zen-date-picker__day--selected { background: #15803d; color: white; }
      `.trim();
      this.root.appendChild(style);
    }

    this.root.appendChild(container);
  }

  private moveMonth(delta: number): void {
    let m = this.viewMonth + delta;
    let y = this.viewYear;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    if (m > 12) {
      m = 1;
      y += 1;
    }
    this.viewMonth = m;
    this.viewYear = y;
    this.render();
  }

  private selectDay(d: number): void {
    this.selected = { y: this.viewYear, m: this.viewMonth, d };
    this.render();
    const value = `${toPersianDigits(this.viewYear)}/${pad2(this.viewMonth)}/${pad2(d)}`;
    this.setAttribute('value', value);
    this.dispatchEvent(new CustomEvent('change', { detail: { value } }));
  }
}

/**
 * Process the `zen-date-picker` directive. Ensures the custom element is
 * registered, then returns a no-op dispose (the element manages its own
 * lifecycle).
 */
export function processDatePicker(_el: HTMLElement, _context: Record<string, any>): () => void {
  if (typeof customElements === 'undefined') {
    return () => {};
  }
  if (!customElements.get(PICKER_TAG)) {
    customElements.define(PICKER_TAG, ZenDatePicker);
  }
  return () => {};
}

// ── Helpers ──

function pad2(n: number): string {
  return toPersianDigits(String(n).padStart(2, '0'));
}

function parseJalaliToday(): { y: number; m: number; d: number } {
  // #146: محلی‌خوانی از @zenith/jalali — picker «امروز» کاربر را نشان می‌دهد.
  // مسیر throw (ورودی نامعتبر/خارج از بازه) همان branch قبلی را می‌دهد:
  // {y:0,m:0,d:0} تا تابع همیشه total بماند و throw نکند.
  try {
    const p = toJalaliParts(new Date(), { timeZone: 'local' });
    return { y: p.y, m: p.m, d: p.d };
  } catch {
    return { y: 0, m: 0, d: 0 };
  }
}

function parseJalaliString(s: string): { y: number; m: number; d: number } | null {
  // Convert Persian/Arabic digits to ASCII before parsing.
  const ascii = toLatinDigits(s);
  const m = ascii.match(/^(\d{1,4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const y = parseInt(m[1]!, 10);
  const mo = parseInt(m[2]!, 10);
  const d = parseInt(m[3]!, 10);
  // #146: اعتبار کامل تقویمی (روزهای ماه + کبیسه) از jalali؛ کد قدیمی تنها
  // «۳۱ روز» را چک می‌کرد و ۱۴۰۲/۱۲/۳۰ (ناموجود) را می‌پذیرفت.
  if (!isValidJalali(y, mo, d)) return null;
  return { y, m: mo, d };
}
