// packages/runtime/src/directives/date-picker.ts
//
// FEATURE (v1.2.0): zen-date-picker — Persian (Jalali) date picker web component.
//
// Registers a `<zen-date-picker>` custom element that renders an RTL grid
// calendar with month navigation and day selection.
import { toJalali, fromJalali, jalaliMonthDays, jalaliMonthName, parseJalaliParts } from '@zenith/i18n';
const PICKER_TAG = 'zen-date-picker';
/**
 * The class registered as the `<zen-date-picker>` custom element.
 */
export class ZenDatePicker extends HTMLElement {
    constructor() {
        super();
        const today = parseJalaliToday();
        this.viewYear = today.y;
        this.viewMonth = today.m;
        // Use a shadow DOM if available; otherwise render into the element.
        if (typeof this.attachShadow === 'function') {
            this.root = this.attachShadow({ mode: 'open' });
        }
        else {
            this.root = this;
        }
    }
    static get observedAttributes() {
        return ['value'];
    }
    attributeChangedCallback(name, _oldVal, newVal) {
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
    connectedCallback() {
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
    render() {
        if (typeof document === 'undefined')
            return;
        const root = this.root;
        // Clear existing content.
        while (root.firstChild)
            root.removeChild(root.firstChild);
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
        prev.addEventListener('click', () => this.moveMonth(-1));
        const label = document.createElement('span');
        label.className = 'zen-date-picker__label';
        label.textContent = `${jalaliMonthName(this.viewMonth)} ${toPersianDigits(this.viewYear)}`;
        const next = document.createElement('button');
        next.type = 'button';
        next.textContent = '‹'; // RTL: ‹ points forward
        next.className = 'zen-date-picker__nav';
        next.addEventListener('click', () => this.moveMonth(1));
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
        const days = jalaliMonthDays(this.viewYear, this.viewMonth);
        const firstDate = fromJalali(this.viewYear, this.viewMonth, 1);
        const jsDay = firstDate.getDay();
        const persianFirstWeekday = (jsDay + 1) % 7;
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
            if (this.selected &&
                this.selected.y === this.viewYear &&
                this.selected.m === this.viewMonth &&
                this.selected.d === d) {
                cell.classList.add('zen-date-picker__day--selected');
            }
            cell.addEventListener('click', () => this.selectDay(d));
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
    moveMonth(delta) {
        let m = this.viewMonth + delta;
        let y = this.viewYear;
        if (m < 1) { m = 12; y -= 1; }
        if (m > 12) { m = 1; y += 1; }
        this.viewMonth = m;
        this.viewYear = y;
        this.render();
    }
    selectDay(d) {
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
export function processDatePicker(_el, _context) {
    if (typeof customElements === 'undefined') {
        return () => { };
    }
    if (!customElements.get(PICKER_TAG)) {
        customElements.define(PICKER_TAG, ZenDatePicker);
    }
    return () => { };
}
// ── Helpers ──
function toPersianDigits(n) {
    return String(n).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.charAt(+d));
}
function pad2(n) {
    return toPersianDigits(String(n).padStart(2, '0'));
}
function parseJalaliToday() {
    const [y, m, d] = parseJalaliParts(new Date());
    return { y, m, d };
}
function parseJalaliString(s) {
    const ascii = s.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
    const m = ascii.match(/^(\d{1,4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!m)
        return null;
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    const d = parseInt(m[3], 10);
    if (mo < 1 || mo > 12 || d < 1 || d > 31)
        return null;
    return { y, m: mo, d };
}
// Re-export the helpers so callers can build dates from the change event.
export { toJalali, fromJalali, jalaliMonthDays, jalaliMonthName };
//# sourceMappingURL=date-picker.js.map
