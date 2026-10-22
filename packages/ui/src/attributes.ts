import { compileExpression, createBindingContext } from '@zenith/expressions';
import { toValue, isReadable, type MaybeReactive } from '@zenith/shared';
import { UI_MOTION_SHAPE } from './motion';
import { UI_TARGET } from './surface-options';
import { s, validate, type Schema, type DirectiveMeta } from '@zenith/schema';
import { createReservedError } from '@zenith/errors';
import type { Placement } from './position';
const boolean = s.boolean(), duration = s.duration({ min: 0, max: 2147483647 });
export function uiAttribute<T>(el: HTMLElement, name: string, schema: Schema<T>, fallback: T): T {
  const raw = el.getAttribute(name); return raw === null ? fallback : validate<T>(schema, raw, { name, mode: 'throw', coerce: true });
}
export function uiBoolean(el: HTMLElement, name: string, fallback: boolean): boolean {
  const raw = el.getAttribute(name); return raw === null ? fallback : validate<boolean>(boolean, raw === '' ? true : raw, { name, mode: 'throw', coerce: true });
}
export function uiDuration(el: HTMLElement, name: string, fallback: number): number { return uiAttribute(el, name, duration, fallback); }
interface AttributeContext { context: Record<string, unknown>; state?: Record<string, unknown>; }
/** A colon opts into the normal expression engine; literals never execute as code. */
export function uiConfigured<T>(el: HTMLElement, name: string, schema: Schema<T>, fallback: T, context: AttributeContext): MaybeReactive<T> {
  const raw = el.getAttribute(name);
  if (!raw?.startsWith(':')) return uiAttribute(el, name, schema, fallback);
  const read = compileExpression(raw.slice(1)), view = createBindingContext(context.state ?? {}, context.context);
  return { get() { const value = read(view); return value === undefined ? fallback : validate<T>(schema, value, { name, mode: 'throw', coerce: true }); } };
}
export function uiConfiguredBoolean(el: HTMLElement, name: string, fallback: boolean, context: AttributeContext): MaybeReactive<boolean> {
  return el.getAttribute(name)?.startsWith(':') ? uiConfigured(el, name, boolean, fallback, context) : uiBoolean(el, name, fallback);
}
export function uiConfiguredDuration(el: HTMLElement, name: string, fallback: number, context: AttributeContext): MaybeReactive<number> { return uiConfigured(el, name, duration, fallback, context); }
export function uiMotion(el: HTMLElement, name: string, context: AttributeContext) {
  const raw = el.getAttribute(`zen-${name}-transition`);
  return { transition: raw === 'false' ? false as const : raw === '' ? undefined : uiConfigured(el, `zen-${name}-transition`, UI_MOTION_SHAPE.transition, undefined, context), transitionDuration: uiConfiguredDuration(el, `zen-${name}-transition-duration`, 300, context) };
}
export function uiPortal(el: HTMLElement, context: AttributeContext) {
  const raw = el.getAttribute('zen-dialog-portal');
  return raw === 'false' ? false as const : raw === '' ? 'body' : uiConfigured(el, 'zen-dialog-portal', s.union([s.enum([false]), UI_TARGET]), 'body', context);
}
export function uiFloating(el: HTMLElement, name: string, fallback: Placement, context: AttributeContext) {
  const placement = uiConfigured(el, `zen-${name}-placement`, s.custom<Placement>(value => typeof value === 'string' && /^(?:top|bottom|left|right)(?:-(?:start|end))?$/.test(value), 'floating placement'), fallback, context);
  const rawArrow = uiConfigured(el, `zen-${name}-arrow`, s.optional(s.custom<string | HTMLElement | boolean>(value => typeof value === 'string' || typeof value === 'boolean' || (!!value && typeof value === 'object' && Reflect.get(value, 'nodeType') === 1), 'arrow selector, element or boolean')), undefined, context);
  const resolveArrow = (): HTMLElement | undefined => {
    const value = toValue<string | HTMLElement | boolean | undefined>(rawArrow);
    if (value === undefined || value === false || value === 'false') return undefined;
    let arrow: HTMLElement | null;
    try { arrow = typeof value === 'string' || value === true ? el.querySelector<HTMLElement>(value === true || value === '' || value === 'true' ? '[zen-ui-arrow]' : value) : value; } catch { throw createReservedError('ZEN-1601'); }
    if (!arrow || arrow.ownerDocument !== el.ownerDocument || !el.contains(arrow)) throw createReservedError('ZEN-1601'); return arrow;
  };
  return { ...uiMotion(el, name, context), trigger: uiConfigured(el, `zen-${name}-trigger`, s.optional(UI_TARGET), undefined, context), placement, arrow: isReadable(rawArrow) ? { get: resolveArrow } : resolveArrow(),
    offset: uiConfigured(el, `zen-${name}-offset`, s.number(), 8, context), flip: uiConfiguredBoolean(el, `zen-${name}-flip`, true, context), shift: uiConfiguredBoolean(el, `zen-${name}-shift`, true, context),
    ...(name === 'popover' ? { role: uiConfigured(el, `zen-${name}-role`, s.optional(s.string({ min: 1 })), undefined, context) } : {}) as { role?: never },
    ...(name === 'tooltip' ? {} : { triggerOn: uiConfigured(el, `zen-${name}-trigger-on`, s.enum(['click', 'hover', 'focus', 'manual']), 'click', context), returnFocus: uiConfiguredBoolean(el, `zen-${name}-return-focus`, true, context) }) };
}

const definitions: Array<[string, string, string[]]> = [
  ['dialog', 'Modal or nonmodal dialog with owned focus, scroll and two-way open value.', ['modal','role','close-on-esc','close-on-backdrop','initial-focus','return-focus','scroll-lock','portal']],
  ['popover', 'Floating surface with a two-way open value and owned geometry.', ['trigger','placement','offset','flip','shift','arrow','trigger-on','return-focus','role']],
  ['tooltip', 'Descriptive tooltip with independent focus and hover intent.', ['trigger','placement','offset','flip','shift','arrow','delay','hide-delay','disabled']],
  ['tabs', 'APG tab collection with reactive controlled selection and lazy panels.', ['orientation','activation','lazy']],
  ['accordion', 'APG disclosure collection with controlled selection.', ['multiple','collapsible']],
  ['menu', 'Keyboard menu, check/radio items and nested submenus.', ['trigger','placement','offset','flip','shift','arrow','trigger-on','return-focus','loop','typeahead','close-on-select']],
  ['combobox', 'Owned listbox with reactive options, controlled value and cancellable async search.', ['options','option-label','option-value','filter','allow-custom','async','debounce','min-chars','multiple']],
];
export const UI_METAS: ReadonlyMap<string, DirectiveMeta> = new Map(definitions.map(([name, description, options]) => [name, { name: `zen-${name}`, description, attributes: [...options, 'transition', 'transition-duration'].map(option => `zen-${name}-${option}`) }]));
