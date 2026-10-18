import { monthName } from '@zenith/jalali';
import { effect } from '@zenith/state';
import { toValue, type Cleanup } from '@zenith/shared';
import { createReservedError } from '@zenith/errors';
import { cleanupScope, ownership } from './internal';
import { calendarDays, calendarUTC, calendarParts, calendarValid, dateOrder, parseCalendarDate, formatCalendarDate, utcDate, type CalendarDate, type Calendar } from './date-calendar';
import { readDateOptions, datePickerOptions, type DatePickerConfig, type DatePickerOptions } from './date-options';
export { datePickerOptions, type DatePickerConfig, type DatePickerOptions } from './date-options';
/** @public */
export type DatePickerCalendar = Calendar;
/** @public */
export interface DatePickerChange { value: string; start: string | null; end: string | null; complete: boolean; calendar: DatePickerCalendar; }
/** Public element contract; methods and events use the element's owner realm. @public */
export interface DatePickerElement extends HTMLElement {
  value: string; defaultValue: string; min: string; max: string; disabled: boolean; readOnly: boolean; required: boolean; range: boolean;
  calendar: DatePickerCalendar; locale: string; firstDay: number; format: string; name: string;
  readonly form: HTMLFormElement | null; readonly validity: ValidityState; readonly validationMessage: string; readonly willValidate: boolean;
  checkValidity(): boolean; reportValidity(): boolean; setCustomValidity(message: string): void; formResetCallback(): void;
  formDisabledCallback(disabled: boolean): void; formStateRestoreCallback(value: string | File | FormData | null, mode: 'restore' | 'autocomplete'): void;
  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void;
  connectedCallback(): void; disconnectedCallback(): void; dispose(): void;
}
/** @public */
export interface DatePickerConstructor { new(): DatePickerElement; readonly observedAttributes: string[]; readonly formAssociated: boolean; }
const PICKER_TAG = 'zen-date-picker';
const OBSERVED = ['value', 'min', 'max', 'disabled', 'readonly', 'required', 'range', 'calendar', 'locale', 'first-day', 'format', 'name', 'form', 'disabled-dates', 'nonce', 'dir'];
const STYLE = '.zen-date-picker{display:inline-block;font-family:inherit}.zen-date-picker__header{display:flex;justify-content:space-between;align-items:center}.zen-date-picker__grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}.zen-date-picker__day,.zen-date-picker__weekday,.zen-date-picker__blank{display:inline-flex;align-items:center;justify-content:center;min-width:2em;min-height:2em}.zen-date-picker__day--selected{outline:2px solid currentColor}.zen-date-picker__day--range{background:Highlight;color:HighlightText}';

function createPickerClass(Base: typeof HTMLElement): DatePickerConstructor {
  return class Picker extends Base {
    static readonly formAssociated = true;
    static get observedAttributes(): string[] { return [...OBSERVED]; }
    private config: DatePickerConfig = {};
    private configError = false;
    private selected: CalendarDate[] = [];
    private excluded: CalendarDate[] = [];
    private minimum: CalendarDate | null = null;
    private maximum: CalendarDate | null = null;
    private viewYear = 1400;
    private viewMonth = 1;
    private focusedDay = 1;
    private viewSet = false;
    private lastValue = '';
    private lastCalendar: Calendar | undefined;
    private disposed = true;
    private revision = 0;
    private rendering = false;
    private pendingRender = false;
    private renderScope = cleanupScope();
    private connection = cleanupScope();
    private root: ShadowRoot | HTMLElement;
    private rendered?: HTMLElement;
    private styleElement?: HTMLStyleElement;
    private announcer?: HTMLElement;
    private internals?: ElementInternals;
    private proxy?: HTMLInputElement;
    private associatedForm: HTMLFormElement | null = null;
    private stopForm: Cleanup = () => {};
    private externalDisabled = false;
    private initialValue: string | undefined;
    private resetValue = '';
    private customMessage = '';
    private message = '';
    private flags: ValidityState = this.emptyValidity();

    constructor() {
      super();
      this.root = typeof this.attachShadow === 'function' ? this.attachShadow({ mode: 'open' }) : this;
      try { const internals = this.attachInternals?.(); if (internals && typeof internals.setFormValue === 'function' && typeof internals.setValidity === 'function') this.internals = internals; } catch { /* A partial DOM implementation uses the owned proxy fallback. */ }
    }
    private emptyValidity(): ValidityState { return Object.freeze({ badInput: false, customError: false, patternMismatch: false, rangeOverflow: false, rangeUnderflow: false, stepMismatch: false, tooLong: false, tooShort: false, typeMismatch: false, valueMissing: false, valid: true }); }
    get value(): string { return this.getAttribute('value') ?? ''; }
    set value(value: string) { this.setAttribute('value', value); }
    get defaultValue(): string { return this.resetValue; }
    set defaultValue(value: string) { this.resetValue = String(value); }
    get min(): string { return this.getAttribute('min') ?? ''; }
    set min(value: string) { this.setAttribute('min', value); }
    get max(): string { return this.getAttribute('max') ?? ''; }
    set max(value: string) { this.setAttribute('max', value); }
    get disabled(): boolean { return this.hasAttribute('disabled'); }
    set disabled(value: boolean) { this.toggleAttribute('disabled', value); }
    get readOnly(): boolean { return this.hasAttribute('readonly'); }
    set readOnly(value: boolean) { this.toggleAttribute('readonly', value); }
    get required(): boolean { return this.hasAttribute('required'); }
    set required(value: boolean) { this.toggleAttribute('required', value); }
    get range(): boolean { return this.hasAttribute('range'); }
    set range(value: boolean) { this.toggleAttribute('range', value); }
    get calendar(): Calendar { return this.config.calendar ?? 'jalali'; }
    set calendar(value: Calendar) { this.setAttribute('calendar', value); }
    get locale(): string { return this.config.locale ?? (this.closest('[lang]')?.getAttribute('lang') || this.ownerDocument.documentElement.lang || (this.calendar === 'jalali' ? 'fa-IR' : 'en-US')); }
    set locale(value: string) { this.setAttribute('locale', value); }
    get firstDay(): number { return this.config.firstDay ?? (this.calendar === 'jalali' ? 6 : 1); }
    set firstDay(value: number) { this.setAttribute('first-day', String(value)); }
    get format(): string { return this.config.format ?? 'YYYY/MM/DD'; }
    set format(value: string) { this.setAttribute('format', value); }
    get name(): string { return this.getAttribute('name') ?? ''; }
    set name(value: string) { this.setAttribute('name', value); }
    get form(): HTMLFormElement | null { return this.internals?.form ?? this.associatedForm; }
    get validity(): ValidityState { return this.flags; }
    get validationMessage(): string { return this.message; }
    get willValidate(): boolean { return !this.disposed && !this.inactive && !this.readOnly; }
    private get inactive(): boolean { return this.disabled || this.externalDisabled; }
    private get rtl(): boolean { const direction = this.closest('[dir]')?.getAttribute('dir'); return direction === 'rtl' || (direction !== 'ltr' && /^(fa|ar|he|ur|ps|sd|ug|yi)\b/i.test(this.locale)); }
    private parse(value: string): CalendarDate | null { return parseCalendarDate(value, this.calendar, this.format, this.locale); }
    private print(value: CalendarDate): string { return formatCalendarDate(value, this.format, this.locale); }

    attributeChangedCallback(_name: string, oldValue: string | null, newValue: string | null): void {
      if (oldValue === newValue) return;
      this.readConfiguration(); if (!this.disposed) this.render();
    }
    private readConfiguration(): void {
      this.configError = false; this.selected = []; this.excluded = [];
      try {
        this.config = readDateOptions(this);
        // Validate inherited locale before any Intl rendering/formatting.
        new Intl.NumberFormat(this.locale);
        this.minimum = this.min ? this.parse(this.min) : null; this.maximum = this.max ? this.parse(this.max) : null;
        if ((this.min && !this.minimum) || (this.max && !this.maximum) || (this.minimum && this.maximum && dateOrder(this.minimum) > dateOrder(this.maximum))) throw createReservedError('ZEN-1603');
        for (const value of this.config.disabledDates ?? []) { const date = this.parse(value); if (!date) throw createReservedError('ZEN-1603'); this.excluded.push(date); }
        if (this.value) {
          const parts = this.range ? this.value.split('..') : [this.value];
          if (parts.length > 2 || !parts[0] || (!this.range && this.value.includes('..'))) throw createReservedError('ZEN-1603');
          const start = this.parse(parts[0]); if (!start) throw createReservedError('ZEN-1603'); this.selected.push(start);
          if (parts[1]) { const end = this.parse(parts[1]); if (!end || dateOrder(end) < dateOrder(start)) throw createReservedError('ZEN-1603'); this.selected.push(end); }
          if (!this.viewSet || this.value !== this.lastValue || this.calendar !== this.lastCalendar) { const focus = this.selected[this.selected.length - 1]!; this.viewYear = focus.y; this.viewMonth = focus.m; this.focusedDay = focus.d; this.viewSet = true; }
        }
        if (!this.viewSet || (!this.value && this.calendar !== this.lastCalendar) || !calendarValid(this.calendar, { y: this.viewYear, m: this.viewMonth, d: 1 })) {
          const now = new Date(); const today = calendarParts(this.calendar, utcDate(now.getFullYear(), now.getMonth() + 1, now.getDate())) ?? { y: this.calendar === 'jalali' ? 1400 : 2000, m: 1, d: 1 };
          this.viewYear = today.y; this.viewMonth = today.m; this.focusedDay = today.d; this.viewSet = true;
        }
        this.lastValue = this.value; this.lastCalendar = this.calendar;
      } catch { this.configError = true; }
    }
    connectedCallback(): void {
      if (!this.disposed) return;
      this.disposed = false; this.connection = cleanupScope();
      if (this.initialValue === undefined) { this.initialValue = this.value; this.resetValue = this.value; }
      this.readConfiguration();
      const Observer = this.ownerDocument.defaultView?.MutationObserver;
      if (Observer) {
        let locale = this.locale, direction = this.rtl;
        const observer = new Observer(() => {
          if (this.disposed) return;
          if (locale !== this.locale || direction !== this.rtl) { locale = this.locale; direction = this.rtl; this.readConfiguration(); this.render(); }
          else if (!this.internals) { const previous = this.externalDisabled; this.syncForm(); if (previous !== this.externalDisabled) this.render(); }
        });
        observer.observe(this.ownerDocument, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'id', 'lang', 'dir'] }); this.connection.add(() => observer.disconnect());
      }
      this.render();
    }
    disconnectedCallback(): void { this.dispose(); }
    dispose(): void {
      if (this.disposed) return; this.disposed = true; this.revision++;
      try { this.renderScope.dispose(); } finally {
        try { this.connection.dispose(); } finally {
          this.stopForm(); this.stopForm = () => {}; this.associatedForm = null; this.proxy?.remove(); this.proxy = undefined;
          this.internals?.setFormValue(null); this.internals?.setValidity({}); this.flags = this.emptyValidity(); this.message = '';
        }
      }
    }
    formDisabledCallback(disabled: boolean): void { this.externalDisabled = disabled; if (!this.disposed) this.render(); }
    formResetCallback(): void {
      this.customMessage = '';
      if (this.value !== this.resetValue) this.value = this.resetValue;
      else { this.readConfiguration(); if (!this.disposed) this.render(); }
    }
    formStateRestoreCallback(value: string | File | FormData | null, _mode: 'restore' | 'autocomplete'): void { if (typeof value === 'string') this.value = value; }
    setCustomValidity(message: string): void { this.customMessage = String(message); if (!this.disposed) this.syncForm(); }
    checkValidity(): boolean { if (!this.willValidate) return true; return this.internals?.checkValidity() ?? this.proxy?.checkValidity() ?? this.flags.valid; }
    reportValidity(): boolean { if (!this.willValidate) return true; return this.internals?.reportValidity() ?? this.proxy?.reportValidity() ?? this.flags.valid; }
    private complete(): boolean { return this.selected.length === (this.range ? 2 : 1); }
    private allowed(date: CalendarDate): boolean {
      const order = dateOrder(date);
      return !this.inactive && !this.configError && calendarValid(this.calendar, date) && (!this.minimum || order >= dateOrder(this.minimum)) && (!this.maximum || order <= dateOrder(this.maximum)) && !this.excluded.some(value => dateOrder(value) === order);
    }
    private intervalAllowed(start: CalendarDate, end: CalendarDate): boolean { return !this.excluded.some(value => dateOrder(value) >= dateOrder(start) && dateOrder(value) <= dateOrder(end)); }
    private syncForm(): void {
      if (this.disposed) return;
      if (!this.internals) {
        if (!this.proxy) {
          const proxy = this.ownerDocument.createElement('input'); proxy.type = 'text'; proxy.hidden = true; proxy.tabIndex = -1; proxy.setAttribute('aria-hidden', 'true'); proxy.setAttribute('data-zen-date-picker-proxy', ''); this.proxy = proxy;
          const invalid = (event: Event) => { event.preventDefault(); this.focusDay(); }; proxy.addEventListener('invalid', invalid); this.connection.add(() => proxy.removeEventListener('invalid', invalid));
          this.append(proxy);
        }
        const proxy = this.proxy; if (proxy.disabled !== this.disabled) proxy.disabled = this.disabled; proxy.readOnly = this.readOnly; proxy.name = this.name;
        const formId = this.getAttribute('form'); if (formId !== null) proxy.setAttribute('form', formId); else proxy.removeAttribute('form');
        this.externalDisabled = !this.disabled && proxy.matches(':disabled');
        const form = proxy.form;
        if (form !== this.associatedForm) {
          this.stopForm(); this.associatedForm = form;
          const reset = (event: Event) => { queueMicrotask(() => { if (!event.defaultPrevented && !this.disposed && this.associatedForm === form) this.formResetCallback(); }); };
          form?.addEventListener('reset', reset); this.stopForm = () => { form?.removeEventListener('reset', reset); };
        }
      }
      const required = this.required && !this.complete();
      const badInput = this.configError || (!!this.value && !this.complete()) || (this.selected.length === 2 && !this.intervalAllowed(this.selected[0]!, this.selected[1]!));
      const under = !!this.minimum && this.selected.some(value => dateOrder(value) < dateOrder(this.minimum!));
      const over = !!this.maximum && this.selected.some(value => dateOrder(value) > dateOrder(this.maximum!));
      const excluded = this.selected.some(value => this.excluded.some(day => dateOrder(day) === dateOrder(value)));
      const flags = { valueMissing: required, badInput, rangeUnderflow: under, rangeOverflow: over, customError: !!this.customMessage || excluded };
      const valid = !this.willValidate || !Object.values(flags).some(Boolean);
      this.flags = Object.freeze({ ...this.emptyValidity(), ...(this.willValidate ? flags : {}), valid });
      this.message = valid ? '' : this.customMessage || (required ? 'Choose a date' : under || over ? 'Date is outside the allowed range' : 'Choose an available date or complete range');
      const value = this.complete() && !this.configError && !badInput && !under && !over && !excluded ? this.value : null;
      if (this.internals) { this.internals.setFormValue(this.inactive ? null : value, this.value); this.internals.setValidity(valid ? {} : flags, this.message, this.root.querySelector<HTMLElement>('[data-day][tabindex="0"],[role="grid"][tabindex="0"]') ?? undefined); }
      if (this.proxy) { this.proxy.value = value ?? ''; this.proxy.required = this.required; this.proxy.setCustomValidity(this.message); }
    }
    private focusDay(): void { (this.root.querySelector<HTMLElement>(`[data-day="${this.focusedDay}"]:not(:disabled)`) ?? this.root.querySelector<HTMLElement>('[role="grid"][tabindex="0"]'))?.focus(); }
    private emit(name: string, detail: DatePickerChange): void { const Event = this.ownerDocument.defaultView?.CustomEvent; if (Event && !this.disposed) this.dispatchEvent(new Event(name, { detail, bubbles: true, composed: true })); }
    private selectDay(day: number): void {
      const date = { y: this.viewYear, m: this.viewMonth, d: day }; if (this.disposed || this.readOnly || !this.allowed(date)) return;
      let next = [date];
      if (this.range && this.selected.length === 1) { next = [this.selected[0]!, date].sort((a, b) => dateOrder(a) - dateOrder(b)); if (!this.intervalAllowed(next[0]!, next[1]!)) return; }
      const complete = !this.range || next.length === 2, start = this.print(next[0]!), end = next[1] ? this.print(next[1]) : null;
      const value = this.range ? `${start}..${end ?? ''}` : start;
      this.focusedDay = day; if (this.value === value) this.render(); else this.value = value;
      if (this.disposed || this.value !== value) return;
      if (this.viewYear !== date.y || this.viewMonth !== date.m || this.focusedDay !== date.d) { this.viewYear = date.y; this.viewMonth = date.m; this.focusedDay = date.d; this.render(); }
      this.focusDay(); if (this.disposed || this.value !== value) return;
      const calendar = this.calendar, range = this.range, current = () => !this.disposed && this.value === value && this.calendar === calendar && this.range === range;
      const detail: DatePickerChange = { value, start, end, complete, calendar };
      this.emit('input', detail); if (!current()) return;
      this.emit('zen-date-picker-change', detail); if (complete && current()) this.emit('change', detail);
    }
    private moveMonth(delta: number): void {
      if (this.disposed || this.inactive || this.configError) return;
      const active = this.root === this ? this.ownerDocument.activeElement : (this.root as ShadowRoot).activeElement, nav = active?.getAttribute('data-nav');
      const absolute = this.viewYear * 12 + this.viewMonth - 1 + delta, y = Math.floor(absolute / 12), m = ((absolute % 12) + 12) % 12 + 1;
      if (!calendarValid(this.calendar, { y, m, d: 1 })) return;
      this.viewYear = y; this.viewMonth = m; this.focusedDay = Math.min(this.focusedDay, calendarDays(this.calendar, y, m)); this.render();
      if (nav && !this.disposed) this.root.querySelector<HTMLElement>(`[data-nav="${nav}"]`)?.focus();
    }
    private onCalendarKey(event: KeyboardEvent, day: number): void {
      if (this.disposed || event.isComposing || this.inactive || this.configError) return;
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.selectDay(day); return; }
      if (event.key === 'PageUp' || event.key === 'PageDown') { event.preventDefault(); this.moveMonth((event.key === 'PageUp' ? -1 : 1) * (event.shiftKey ? 12 : 1)); if (!this.disposed) this.focusDay(); return; }
      const date = calendarUTC(this.calendar, { y: this.viewYear, m: this.viewMonth, d: day }), weekday = (date.getUTCDay() - this.firstDay + 7) % 7;
      const delta = event.key === 'ArrowLeft' ? this.rtl ? 1 : -1 : event.key === 'ArrowRight' ? this.rtl ? -1 : 1 : event.key === 'ArrowUp' ? -7 : event.key === 'ArrowDown' ? 7 : event.key === 'Home' ? -weekday : event.key === 'End' ? 6 - weekday : undefined;
      if (delta === undefined) return; event.preventDefault(); date.setUTCDate(date.getUTCDate() + delta);
      let next = calendarParts(this.calendar, date), attempts = 0; const step = delta < 0 ? -1 : 1;
      while (next && !this.allowed(next) && attempts++ < 3660) { date.setUTCDate(date.getUTCDate() + step); next = calendarParts(this.calendar, date); }
      if (!next || !this.allowed(next)) return;
      this.viewYear = next.y; this.viewMonth = next.m; this.focusedDay = next.d; this.render(); if (!this.disposed) this.focusDay();
    }
    private render(): void {
      if (this.disposed) return; if (this.rendering) { this.pendingRender = true; return; }
      this.rendering = true;
      try { do { this.pendingRender = false; this.renderCalendar(); } while (this.pendingRender && !this.disposed); }
      finally { this.rendering = false; }
    }
    private renderCalendar(): void {
      this.renderScope.dispose(); this.renderScope = cleanupScope(); const version = ++this.revision, doc = this.ownerDocument;
      const bind = (el: HTMLElement, name: string, callback: (event: Event) => void) => { const fn = (event: Event) => { if (!this.disposed && version === this.revision) callback(event); }; el.addEventListener(name, fn); this.renderScope.add(() => el.removeEventListener(name, fn)); };
      const container = doc.createElement('div'); container.className = 'zen-date-picker'; container.dir = this.rtl ? 'rtl' : 'ltr';
      const header = doc.createElement('div'); header.className = 'zen-date-picker__header';
      const label = doc.createElement('span'); label.className = 'zen-date-picker__label';
      const safeDate = calendarValid(this.calendar, { y: this.viewYear, m: this.viewMonth, d: 1 }) ? { y: this.viewYear, m: this.viewMonth, d: 1 } : { y: this.calendar === 'jalali' ? 1400 : 2000, m: 1, d: 1 };
      // Invalid attributes stay observable as validity errors, never unchecked Intl/DOM input.
      let locale: string; try { locale = new Intl.NumberFormat(this.locale).resolvedOptions().locale; } catch { locale = this.calendar === 'jalali' ? 'fa-IR' : 'en-US'; }
      const persian = /^fa\b/i.test(locale), number = (n: number) => new Intl.NumberFormat(locale, { useGrouping: false }).format(n);
      label.textContent = this.calendar === 'jalali' ? `${monthName(safeDate.m, { locale: persian ? 'fa' : 'en' })} ${number(safeDate.y)}` : new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', calendar: 'gregory', timeZone: 'UTC' }).format(calendarUTC(this.calendar, safeDate));
      for (const [nav, delta] of [['previous', -1], ['next', 1]] as const) {
        const button = doc.createElement('button'); button.type = 'button'; button.className = 'zen-date-picker__nav'; button.dataset.nav = nav; button.textContent = (delta === -1) !== this.rtl ? '‹' : '›';
        button.setAttribute('aria-label', persian ? delta < 0 ? 'ماه قبل' : 'ماه بعد' : delta < 0 ? 'Previous month' : 'Next month'); button.disabled = this.inactive || this.configError;
        bind(button, 'click', () => this.moveMonth(delta)); if (delta < 0) header.append(button, label); else header.append(button);
      }
      const grid = doc.createElement('div'); grid.className = 'zen-date-picker__grid'; grid.setAttribute('role', 'grid'); grid.setAttribute('aria-label', label.textContent ?? 'Calendar'); grid.setAttribute('aria-readonly', String(this.readOnly)); if (this.range) grid.setAttribute('aria-multiselectable', 'true');
      const row = () => { const value = doc.createElement('div'); value.setAttribute('role', 'row'); value.style.display = 'contents'; return value; };
      const headings = row();
      for (let i = 0; i < 7; i++) { const cell = doc.createElement('span'); cell.className = 'zen-date-picker__weekday'; cell.setAttribute('role', 'columnheader'); cell.textContent = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(utcDate(2024, 1, 7 + (this.firstDay + i) % 7)); headings.append(cell); }
      grid.append(headings); const first = (calendarUTC(this.calendar, safeDate).getUTCDay() - this.firstDay + 7) % 7, days = calendarDays(this.calendar, safeDate.y, safeDate.m);
      let currentRow = row(); grid.append(currentRow);
      for (let i = 0; i < first; i++) { const blank = doc.createElement('span'); blank.className = 'zen-date-picker__blank'; blank.setAttribute('role', 'gridcell'); blank.setAttribute('aria-disabled', 'true'); currentRow.append(blank); }
      for (let day = 1; day <= days; day++) {
        if ((first + day - 1) % 7 === 0 && day !== 1) { currentRow = row(); grid.append(currentRow); }
        const date = { y: safeDate.y, m: safeDate.m, d: day }, cell = doc.createElement('button'); cell.type = 'button'; cell.className = 'zen-date-picker__day'; cell.dataset.day = String(day); cell.setAttribute('role', 'gridcell'); cell.setAttribute('aria-label', `${date.y}/${date.m}/${day}`); cell.textContent = number(day);
        cell.disabled = !this.allowed(date); cell.setAttribute('aria-disabled', String(cell.disabled)); cell.tabIndex = !cell.disabled && day === this.focusedDay ? 0 : -1;
        const order = dateOrder(date), selected = this.selected.some(value => dateOrder(value) === order), inRange = this.selected.length === 2 && order >= dateOrder(this.selected[0]!) && order <= dateOrder(this.selected[1]!);
        cell.setAttribute('aria-selected', String(selected || inRange)); if (selected) cell.classList.add('zen-date-picker__day--selected'); if (inRange) cell.classList.add('zen-date-picker__day--range');
        bind(cell, 'click', () => this.selectDay(day)); bind(cell, 'keydown', event => this.onCalendarKey(event as KeyboardEvent, day)); currentRow.append(cell);
      }
      const enabled = Array.from(grid.querySelectorAll<HTMLButtonElement>('[data-day]:not(:disabled)'));
      if (!enabled.some(cell => cell.tabIndex === 0)) { if (enabled[0]) { enabled[0].tabIndex = 0; this.focusedDay = Number(enabled[0].dataset.day); } else { grid.tabIndex = 0; grid.setAttribute('aria-disabled', 'true'); bind(grid, 'keydown', event => { if (event.target === grid) this.onCalendarKey(event as KeyboardEvent, this.focusedDay); }); } }
      container.append(header, grid);
      if (this.root !== this) {
        const nonce = this.config.nonce ?? '';
        if (!this.styleElement || this.styleElement.parentNode !== this.root || (this.styleElement.nonce || this.styleElement.getAttribute('nonce') || '') !== nonce) {
          // CSP authorizes a stylesheet at insertion. Setting nonce afterward
          // cannot rescue a blocked sheet; nonce rotation needs a fresh sheet.
          const style = doc.createElement('style');
          if (nonce) style.setAttribute('nonce', nonce);
          style.textContent = STYLE;
          if (this.styleElement?.parentNode === this.root) this.styleElement.replaceWith(style); else this.root.prepend(style);
          this.styleElement = style;
        }
      }
      if (this.rendered?.parentNode === this.root) this.rendered.replaceWith(container); else this.root.append(container);
      this.rendered = container;
      // Keep the live region connected across calendar renders. Replacing a
      // populated aria-live node on every keypress loses month announcements.
      if (!this.announcer || this.announcer.parentNode !== this.root) {
        this.announcer = doc.createElement('span'); this.announcer.className = 'zen-date-picker__announcer'; this.announcer.setAttribute('role', 'status'); this.announcer.setAttribute('aria-live', 'polite'); this.announcer.setAttribute('aria-atomic', 'true');
        Object.assign(this.announcer.style, { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }); this.root.append(this.announcer);
      }
      if (this.announcer.textContent !== label.textContent) this.announcer.textContent = label.textContent;
      const inactive = this.inactive; this.syncForm(); if (inactive !== this.inactive) this.pendingRender = true; grid.setAttribute('aria-invalid', String(!this.flags.valid)); grid.setAttribute('data-range-pending', String(this.range && this.selected.length === 1));
    }
  };
}

const BaseHTMLElement: typeof HTMLElement = typeof HTMLElement !== 'undefined' ? HTMLElement : (class {} as unknown as typeof HTMLElement);
/** Standalone constructor for this realm; foreign documents use processDatePicker. @public */
export class ZenDatePicker extends createPickerClass(BaseHTMLElement) {}
const leases = new WeakMap<DatePickerElement, { count: number }>();
/** Register in the owner realm and acquire a cleanup lease without duplicate listeners. @public */
export function processDatePicker(el: HTMLElement, _context: Record<string, unknown>): Cleanup {
  const view = el.ownerDocument.defaultView, registry = view?.customElements;
  if (!view || !registry || (el.ownerDocument as Document & { __zenithSSR__?: boolean }).__zenithSSR__) return () => {};
  if (!registry.get(PICKER_TAG)) registry.define(PICKER_TAG, view.HTMLElement === BaseHTMLElement ? ZenDatePicker : createPickerClass(view.HTMLElement));
  const nodes = (el.matches(PICKER_TAG) ? [el] : Array.from(el.querySelectorAll<HTMLElement>(PICKER_TAG))) as DatePickerElement[];
  const release = cleanupScope();
  try {
    for (const node of nodes) {
      if (typeof node.dispose !== 'function' || typeof node.connectedCallback !== 'function') throw createReservedError('ZEN-1601');
      let entry = leases.get(node); if (!entry) { entry = { count: 0 }; leases.set(node, entry); }
      entry.count++; const token = entry;
      release.add(() => { if (--token.count === 0) { if (leases.get(node) === token) leases.delete(node); node.dispose(); } });
      node.connectedCallback();
    }
    return release.dispose;
  } catch (error) { try { release.dispose(); } catch {} throw error; }
}
/** @public */
export interface DatePickerController { readonly element: HTMLElement; readonly value: string; setValue(value: string): void; focus(): void; checkValidity(): boolean; reportValidity(): boolean; dispose(): void; }
const configured = new WeakSet<HTMLElement>();
/** Reactive, strictly validated attributes owned by one configuration controller. @public */
export function createDatePicker(el: HTMLElement, options: DatePickerOptions = {}): DatePickerController {
  if (!el.matches(PICKER_TAG) || configured.has(el)) throw createReservedError('ZEN-1601');
  const owner = ownership(el); configured.add(el); owner.afterDispose(() => { configured.delete(el); });
  const names: Record<keyof DatePickerConfig, string> = { calendar: 'calendar', locale: 'locale', value: 'value', min: 'min', max: 'max', firstDay: 'first-day', format: 'format', disabled: 'disabled', readOnly: 'readonly', required: 'required', name: 'name', range: 'range', disabledDates: 'disabled-dates', nonce: 'nonce' };
  const ssr = Boolean((el.ownerDocument as Document & { __zenithSSR__?: boolean }).__zenithSSR__);
  let element: DatePickerElement;
  try {
    owner.add(effect(() => {
      if (owner.disposed) return; const resolved: Record<string, unknown> = {};
      for (const key of Object.keys(options) as Array<keyof DatePickerOptions>) { if (!Object.prototype.hasOwnProperty.call(names, key)) throw createReservedError('ZEN-1001', { details: { expected: 'DatePickerOptions field', field: key } }); const value = options[key]; if (value !== undefined) resolved[key] = toValue<unknown>(value); }
      const value = datePickerOptions.resolve(resolved);
      for (const key of Object.keys(resolved) as Array<keyof DatePickerConfig>) {
        if (owner.disposed) break; const next = value[key]; owner.attr(el, names[key], next === undefined || next === false ? null : next === true ? '' : key === 'disabledDates' ? JSON.stringify(next) : String(next));
      }
    }));
    owner.add(processDatePicker(el, {})); element = el as DatePickerElement;
    if (!ssr && typeof element.checkValidity !== 'function') throw createReservedError('ZEN-1601');
  } catch (error) { try { owner.dispose(); } catch {} throw error; }
  return { element, get value() { return element.getAttribute('value') ?? ''; }, setValue(value) { if (!owner.disposed) owner.attr(el, 'value', value); }, focus() { if (!owner.disposed) element.shadowRoot?.querySelector<HTMLElement>('[data-day][tabindex="0"],[role="grid"][tabindex="0"]')?.focus(); }, checkValidity: () => element.checkValidity?.() ?? true, reportValidity: () => element.reportValidity?.() ?? true, dispose: owner.dispose };
}
