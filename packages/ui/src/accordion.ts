import { createUIMotion, UI_MOTION_SHAPE, type UITransitionConfig } from './motion';
import type { MaybeReactive } from '@zenith/shared';
import { signal, untrack } from '@zenith/state';
import { useId } from '@zenith/a11y';
import { s } from '@zenith/schema';
import { createReservedError } from '@zenith/errors';
import { ownership, readonlyState, event, idScopeFor } from './internal';
import { strictUIOptions, resolveUIOptions, watchUIOptions, sameUIValue } from './options';
/** @public */
export interface AccordionConfig extends UITransitionConfig { multiple?: boolean; collapsible?: boolean; value?: readonly number[]; }
/** @public */
export type AccordionOptions = { [K in keyof AccordionConfig]: MaybeReactive<AccordionConfig[K]> };
/** @public */
export const accordionOptions = /* @__PURE__ */ strictUIOptions<AccordionConfig>('AccordionOptions', s.object({
  ...UI_MOTION_SHAPE, multiple: s.default(s.boolean(), false), collapsible: s.default(s.boolean(), true), value: s.optional(s.array(s.number({ int: true, min: 0 }))),
}));
/** APG disclosures isolate nested collections and preserve authored panel nodes. @public */
export function createAccordion(el: HTMLElement, input: AccordionOptions = {}) {
  let options = untrack(() => resolveUIOptions(input, accordionOptions.resolve));
  const items = Array.from(el.querySelectorAll<HTMLElement>('[zen-accordion-item]')).filter(item => {
    for (let parent = item.parentElement; parent && parent !== el; parent = parent.parentElement) if (parent.matches('[zen-accordion],[zen-accordion-item]')) return false;
    return true;
  });
  const pairs = items.map(item => ({
    trigger: Array.from(item.querySelectorAll<HTMLElement>('[zen-accordion-trigger]')).find(node => node.closest('[zen-accordion-item]') === item),
    panel: Array.from(item.querySelectorAll<HTMLElement>('[zen-accordion-panel]')).find(node => node.closest('[zen-accordion-item]') === item),
  }));
  if (pairs.some(pair => !pair.trigger || !pair.panel)) throw createReservedError('ZEN-1601');
  const enabled = (index: number) => { const trigger = pairs[index]?.trigger; return !!trigger && !trigger.hasAttribute('disabled') && trigger.getAttribute('aria-disabled') !== 'true'; };
  const fallback = () => [pairs.findIndex((_, i) => enabled(i))].filter(i => i >= 0);
  const validateValue = (value: readonly number[], config: AccordionConfig) => {
    if (!Array.isArray(value) || value.some(i => !Number.isInteger(i) || !enabled(i)) || new Set(value).size !== value.length || (!config.multiple && value.length > 1) || (config.collapsible === false && fallback().length > 0 && !value.length)) throw createReservedError('ZEN-1603');
  };
  const initial = [...(options.value ?? (options.collapsible === false ? fallback() : []))]; validateValue(initial, options);
  const owner = ownership(el), state = signal<number[]>(initial), scope = idScopeFor(el); let revision = 0;
  owner.add(state);
  const motions = new Map<HTMLElement, ReturnType<typeof createUIMotion>>(), visible = new Map<HTMLElement, boolean>();
  const update = (version: number) => {
    const attr = (node: HTMLElement, name: string, value: string | null) => { if (!owner.disposed && revision === version) owner.attr(node, name, value); };
    pairs.forEach(({ trigger, panel }, i) => {
      if (!trigger || !panel) return; const open = state.peek().includes(i);
      attr(trigger, 'aria-expanded', String(open)); attr(panel, 'data-state', open ? 'open' : 'closed');
      if (owner.disposed || revision !== version) return;
      const before = visible.get(panel); if (before !== open) { const motion = motions.get(panel); if (open) { motion?.show(); if (before !== undefined) motion?.enter(); } else motion?.hide(before === true); visible.set(panel, open); }
    });
  };
  const setValue = (value: readonly number[], notify = true) => {
    if (owner.disposed) return; validateValue(value, options);
    const before = state.peek(); if (before.length === value.length && before.every((item, i) => item === value[i])) return;
    const version = ++revision; state.set([...value]);
    if (owner.disposed || version !== revision) return; update(version);
    if (notify && !owner.disposed && version === revision) event(el, 'zen-accordion-change', { value: [...state.peek()] });
  };
  const toggle = (i: number) => {
    if (owner.disposed) return;
    if (!Number.isInteger(i) || !pairs[i]) throw createReservedError('ZEN-1603'); if (!enabled(i)) return;
    const values = state.peek(); if (values.includes(i) && options.collapsible === false && values.length === 1) return;
    setValue(values.includes(i) ? values.filter(value => value !== i) : options.multiple ? [...values, i] : [i]);
  };
  try {
    pairs.forEach(({ trigger, panel }, i) => {
      if (!trigger || !panel || owner.disposed) return;
      motions.set(panel, createUIMotion(panel, owner, () => ({ ...options, transition: options.transition ?? el.getAttribute('zen-transition') ?? undefined })));
      if (!panel.id) owner.attr(panel, 'id', useId({ prefix: 'accordion-panel', scope })); if (!trigger.id) owner.attr(trigger, 'id', useId({ prefix: 'accordion-trigger', scope }));
      owner.attr(trigger, 'aria-controls', panel.id); owner.attr(panel, 'aria-labelledby', trigger.id);
      const native = trigger.tagName === 'BUTTON'; if (!native) { owner.attr(trigger, 'role', 'button'); owner.attr(trigger, 'tabindex', '0'); }
      owner.on(trigger, 'click', () => toggle(i)); owner.on(trigger, 'keydown', e => {
        if (e.isComposing) return;
        if (e.key === 'Enter' || e.key === ' ') { if (!native) { e.preventDefault(); toggle(i); } return; }
        const candidates = pairs.flatMap((pair, index) => enabled(index) && pair.trigger ? [pair.trigger] : []), current = candidates.indexOf(trigger); let next = current;
        if (!candidates.length || current < 0) return;
        if (e.key === 'ArrowDown') next = (current + 1) % candidates.length; else if (e.key === 'ArrowUp') next = (current + candidates.length - 1) % candidates.length;
        else if (e.key === 'Home') next = 0; else if (e.key === 'End') next = candidates.length - 1; else return;
        e.preventDefault(); candidates[next]?.focus();
      });
    }); update(revision);
    if (!owner.disposed) owner.add(watchUIOptions(input, accordionOptions.resolve, options, next => {
      if (owner.disposed) return;
      let value = !sameUIValue(next.value, options.value) ? [...(next.value ?? (next.collapsible === false ? fallback() : []))] : [...state.peek()];
      if (next.value === undefined) { if (!next.multiple) value = value.slice(0, 1); if (!value.length && next.collapsible === false) value = fallback(); }
      validateValue(value, next); const motionChanged = options.transition !== next.transition || options.transitionDuration !== next.transitionDuration; options = next; if (motionChanged) for (const motion of motions.values()) motion.finish(); setValue(value, false);
    }));
  } catch (error) { try { owner.dispose(); } catch {} throw error; }
  return { toggle, setValue: (value: readonly number[]) => setValue(value, false), state: readonlyState(state), dispose: owner.dispose };
}
