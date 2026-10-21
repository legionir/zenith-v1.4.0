import { tooltipOptions, FLOATING_OPTION_KEYS } from './surface-options';
export { tooltipOptions } from './surface-options';
import { createPopover, type PopoverConfig } from './popover';
import { ownership, cleanupScope, idScopeFor, attributeToken } from './internal';
import { useId } from '@zenith/a11y';
import { untrack } from '@zenith/state';
import { toValue, type MaybeReactive } from '@zenith/shared';
import { createReservedError } from '@zenith/errors';
import { resolveUIOptions, watchUIOptions, projectUIOptions } from './options';
/** @public */
export interface TooltipConfig extends PopoverConfig { role?: 'tooltip'; delay?: number; hideDelay?: number; disabled?: boolean; }
/** @public */
export type TooltipOptions = { [K in keyof TooltipConfig]: MaybeReactive<TooltipConfig[K]> };
/** Tooltip hover/focus intent, timers and aria-describedby have independent ownership. @public */
export function createTooltip(el: HTMLElement, input: TooltipOptions = {}) {
  let options = untrack(() => resolveUIOptions(input, tooltipOptions.resolve));
  const resolveTrigger = (config: TooltipConfig) => {
    let node: HTMLElement | null | undefined;
    try { node = typeof config.trigger === 'string' ? el.ownerDocument.querySelector<HTMLElement>(config.trigger) : config.trigger; } catch { throw createReservedError('ZEN-1601'); }
    if (!node || node.ownerDocument !== el.ownerDocument || node === el || el.contains(node)) throw createReservedError('ZEN-1601'); return node;
  };
  let trigger = resolveTrigger(options), binding = cleanupScope(), bindingVersion = 0;
  const owner = ownership(el); let timer: ReturnType<typeof setTimeout> | undefined, pending: 'show' | 'hide' | undefined;
  let triggerHover = false, surfaceHover = false, focused = false, dismissed = false;
  const active = () => triggerHover || surfaceHover || focused;
  const cancel = () => { clearTimeout(timer); timer = undefined; pending = undefined; };
  owner.add(cancel); owner.add(() => { bindingVersion++; binding.dispose(); });
  try {
    if (!el.id) owner.attr(el, 'id', useId({ prefix: 'tooltip', scope: idScopeFor(el) }));
    const surface = createPopover(el, { ...projectUIOptions(input, FLOATING_OPTION_KEYS), role: 'tooltip', placement: { get: () => toValue<PopoverConfig['placement']>(input.placement) ?? 'top' }, triggerOn: 'manual', returnFocus: false }); owner.add(surface);
    const inside = (node: HTMLElement, target: EventTarget | null) => !!target && typeof (target as Node).nodeType === 'number' && node.contains(target as Node);
    const show = () => { cancel(); if (!owner.disposed && !options.disabled) { dismissed = false; surface.open(); } };
    const hide = () => { cancel(); dismissed = active(); if (!owner.disposed) surface.close(); };
    const reconcile = () => {
      if (owner.disposed || options.disabled) { cancel(); return; }
      if (active()) {
        if (dismissed || surface.state.peek()) { cancel(); return; }
        if (pending === 'show') return;
        cancel(); pending = 'show'; timer = setTimeout(() => { cancel(); if (!owner.disposed && active() && !dismissed && !options.disabled && !trigger.closest('[hidden],[inert]')) surface.open(); }, options.delay ?? 500);
      } else {
        dismissed = false; if (!surface.state.peek()) { cancel(); return; } if (pending === 'hide') return;
        cancel(); pending = 'hide'; timer = setTimeout(() => { cancel(); if (!owner.disposed && !active()) surface.close(); }, options.hideDelay ?? 0);
      }
    };
    const bind = (next: HTMLElement) => {
      const version = ++bindingVersion, old = binding; binding = cleanupScope(); old.dispose(); if (owner.disposed || version !== bindingVersion) return;
      trigger = next; const lease = binding, targetOwner = ownership(trigger); lease.add(targetOwner); lease.add(owner.watch(trigger)); lease.add(attributeToken(trigger, 'aria-describedby', el.id));
      targetOwner.on(trigger, 'mouseenter', () => { triggerHover = true; reconcile(); });
      targetOwner.on(trigger, 'mouseleave', event => { triggerHover = false; surfaceHover = inside(el, event.relatedTarget); reconcile(); });
      targetOwner.on(trigger, 'focusin', () => { focused = true; reconcile(); });
      targetOwner.on(trigger, 'focusout', event => { focused = inside(trigger, event.relatedTarget); reconcile(); });
      targetOwner.on(trigger, 'keydown', event => { if (!event.isComposing && event.key === 'Escape') hide(); });
    };
    const onClose = (event: Event) => { if (!owner.disposed && event.target === el) { cancel(); dismissed = active(); } };
    el.addEventListener('zen-popover-close', onClose); owner.add(() => el.removeEventListener('zen-popover-close', onClose));
    bind(trigger);
    owner.on(el, 'mouseenter', () => { surfaceHover = true; triggerHover = false; reconcile(); });
    owner.on(el, 'mouseleave', event => { surfaceHover = false; triggerHover = inside(trigger, event.relatedTarget); reconcile(); });
    if (!owner.disposed) owner.add(watchUIOptions(input, tooltipOptions.resolve, options, next => {
      if (owner.disposed) return; const target = resolveTrigger(next), before = options, changed = target !== trigger; options = next;
      if (changed) { cancel(); triggerHover = false; focused = target.contains(el.ownerDocument.activeElement); dismissed = false; bind(target); }
      if (next.disabled) { cancel(); surface.close(); }
      else if (changed || before.disabled !== next.disabled || before.delay !== next.delay || before.hideDelay !== next.hideDelay) { cancel(); if (before.disabled !== next.disabled) dismissed = false; reconcile(); }
    }));
    return { ...surface, open: show, close: hide, toggle: () => surface.state.peek() ? hide() : show(), dispose: owner.dispose };
  } catch (error) { try { owner.dispose(); } catch {} throw error; }
}
