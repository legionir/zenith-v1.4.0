import { popoverOptions } from './surface-options';
export { popoverOptions } from './surface-options';
import { registerEscapeLayer, useId } from '@zenith/a11y';
import { signal, untrack } from '@zenith/state';
import type { Cleanup, MaybeReactive } from '@zenith/shared';
import { createReservedError } from '@zenith/errors';
import { computePosition, autoUpdate, type ComputePositionOptions } from './position';
import { ownership, cleanupScope, readonlyState, event, idScopeFor, containsFloatingTarget, floatingBranch, refreshFloating } from './internal';
import { resolveUIOptions, watchUIOptions } from './options';
import { createUIMotion, type UITransitionConfig } from './motion';
/** @public */
export interface PopoverConfig extends ComputePositionOptions, UITransitionConfig { trigger?: HTMLElement | string; triggerOn?: 'click' | 'hover' | 'focus' | 'manual'; returnFocus?: boolean; role?: string; }
/** @public */
export type PopoverOptions = { [K in keyof PopoverConfig]: MaybeReactive<PopoverConfig[K]> };
/** Client-owned floating surface, with outside click/Escape and geometry cleanup. @public */
export function createPopover(el: HTMLElement, input: PopoverOptions = {}) {
  let options = untrack(() => resolveUIOptions(input, popoverOptions.resolve));
  const doc = el.ownerDocument, ssr = Boolean((doc as Document & { __zenithSSR__?: boolean }).__zenithSSR__), originalStyle = el.getAttribute('style'), originalRole = el.getAttribute('role');
  const validate = (config: PopoverConfig): HTMLElement => {
    let target: HTMLElement | null | undefined;
    try { target = typeof config.trigger === 'string' ? doc.querySelector<HTMLElement>(config.trigger) : config.trigger; } catch { throw createReservedError('ZEN-1601'); }
    if (!target || target.ownerDocument !== doc || target === el || el.contains(target) || (config.arrow && (config.arrow === el || config.arrow.ownerDocument !== doc || !el.contains(config.arrow)))) throw createReservedError('ZEN-1601');
    return target;
  };
  let anchor = validate(options);
  const owner = ownership(el), state = signal(false); let revision = 0, activation = 0, bindingVersion = 0, isOpen = false, release: Cleanup = () => {}, binding = cleanupScope();
  owner.add(() => binding.dispose());
  owner.add(() => { revision++; activation++; bindingVersion++; isOpen = false; const undo = release; release = () => {}; try { state.set(false); } finally { try { undo(); } finally { state.dispose(); if (originalStyle === null) el.removeAttribute('style'); else el.setAttribute('style', originalStyle); } } });
  const motion = createUIMotion(el, owner, () => options);
  const arrowStyles = new Map<HTMLElement, string | null>();
  owner.add(() => { for (const [arrow, style] of arrowStyles) { if (style === null) arrow.removeAttribute('style'); else arrow.setAttribute('style', style); } arrowStyles.clear(); });
  const rememberArrow = () => { if (options.arrow && !arrowStyles.has(options.arrow)) arrowStyles.set(options.arrow, options.arrow.getAttribute('style')); };
  const outside = (target: EventTarget | null) => !target || typeof (target as Node).nodeType !== 'number' || (!containsFloatingTarget(el, target as Node) && !anchor.contains(target as Node));
  const close = () => {
    if (owner.disposed || !isOpen) return;
    const version = ++revision, undo = release; activation++; release = () => {}; isOpen = false;
    owner.attr(el, 'data-state', 'closed');
    try { undo(); } finally {
      if (!owner.disposed && revision === version && !isOpen) {
        try { motion.hide(); refreshFloating(doc); if (!owner.disposed && revision === version && !isOpen && (options.role ?? originalRole) !== 'tooltip') anchor.setAttribute('aria-expanded', 'false'); }
        finally { if (!owner.disposed && revision === version && !isOpen) state.set(false); }
      }
    }
    if (!owner.disposed && revision === version && !isOpen) event(el, 'zen-popover-close');
  };
  const activate = () => {
    const version = ++activation, undo = release; release = () => {}; undo();
    const current = () => !owner.disposed && isOpen && activation === version;
    if (!current() || ssr || !doc.defaultView) return; const leases = cleanupScope(); release = leases.dispose;
    try {
      refreshFloating(doc); if (!current()) return;
      leases.add(registerEscapeLayer(doc, () => { close(); if (!owner.disposed && !state.peek() && options.returnFocus !== false && anchor.isConnected) anchor.focus(); })); if (!current()) return;
      leases.add(autoUpdate(anchor, el, () => {
        if (!current()) return; const { arrow, ...geometry } = options, reference = anchor;
        const pos = computePosition(reference, el, geometry); if (!current()) return;
        const rect = reference.getBoundingClientRect(); if (!current()) return;
        const view = doc.defaultView; el.style.position = 'absolute'; el.style.left = `${pos.x + (view?.scrollX ?? 0)}px`; el.style.top = `${pos.y + (view?.scrollY ?? 0)}px`;
        el.style.setProperty('--zen-ui-z-index', '1000'); el.style.setProperty('--zen-ui-anchor-width', `${rect.width}px`); el.style.setProperty('--zen-ui-available-height', `${Math.max(0, (view?.innerHeight ?? 0) - pos.y)}px`);
        if (arrow) { arrow.style.setProperty('--zen-ui-arrow-x', `${rect.left + rect.width / 2 - pos.x}px`); arrow.style.setProperty('--zen-ui-arrow-y', `${rect.top + rect.height / 2 - pos.y}px`); }
        owner.attr(el, 'data-placement', pos.placement);
      }));
    } catch (error) { try { if (current()) close(); else leases.dispose(); } catch {} throw error; }
  };
  const open = () => {
    if (owner.disposed || isOpen || ssr) return;
    const version = ++revision; isOpen = true; const current = () => !owner.disposed && revision === version && isOpen;
    motion.show(); owner.attr(el, 'data-state', 'open'); if (current() && (options.role ?? originalRole) !== 'tooltip') anchor.setAttribute('aria-expanded', 'true');
    if (current()) state.set(true); if (!current()) return;
    try { activate(); if (!current()) return; motion.enter(); if (current()) event(el, 'zen-popover-open'); }
    catch (error) { try { if (current()) close(); } catch {} throw error; }
  };
  const bind = (target: HTMLElement) => {
    const version = ++bindingVersion, previous = binding; binding = cleanupScope(); previous.dispose(); if (owner.disposed || version !== bindingVersion) return;
    anchor = target; const scope = binding, triggerOwner = ownership(anchor); scope.add(triggerOwner); scope.add(owner.watch(anchor));
    const role = options.role ?? originalRole;
    if (role !== 'tooltip') {
      triggerOwner.attr(anchor, 'aria-expanded', String(isOpen)); triggerOwner.attr(anchor, 'aria-controls', el.id);
      const popup = role === 'alertdialog' ? 'dialog' : role; if (popup && ['dialog', 'menu', 'listbox', 'tree', 'grid'].includes(popup)) triggerOwner.attr(anchor, 'aria-haspopup', popup);
    }
    scope.add(floatingBranch(anchor.closest<HTMLElement>('[role="dialog"],[role="alertdialog"],[role="menu"]') ?? anchor, el));
    const on = <K extends keyof HTMLElementEventMap>(node: HTMLElement, type: K, callback: (event: HTMLElementEventMap[K]) => void) => triggerOwner.on(node, type, callback);
    if (options.triggerOn === 'click') on(anchor, 'click', () => isOpen ? close() : open());
    if (options.triggerOn === 'hover') { on(anchor, 'mouseenter', open); on(el, 'mouseenter', open); on(anchor, 'mouseleave', event => { if (outside(event.relatedTarget)) close(); }); on(el, 'mouseleave', event => { if (outside(event.relatedTarget)) close(); }); }
    if (options.triggerOn === 'focus') { on(anchor, 'focusin', open); on(anchor, 'focusout', event => { if (outside(event.relatedTarget)) close(); }); on(el, 'focusout', event => { if (outside(event.relatedTarget)) close(); }); }
  };
  try {
    if (!el.id) owner.attr(el, 'id', useId({ prefix: 'popover', scope: idScopeFor(el) }));
    owner.attr(el, 'role', options.role ?? originalRole); owner.attr(el, 'data-state', 'closed'); motion.hide(false); rememberArrow(); bind(anchor);
    owner.on(doc, 'mousedown', event => { if (outside(event.target)) close(); });
    if (!owner.disposed) owner.add(watchUIOptions(input, popoverOptions.resolve, options, next => {
      if (owner.disposed) return; const target = validate(next), before = options, previousAnchor = anchor;
      const rebind = target !== anchor || next.triggerOn !== options.triggerOn || next.role !== options.role;
      activation++; options = next;
      try {
        if (before.arrow && before.arrow !== next.arrow) { const style = arrowStyles.get(before.arrow); if (style === null) before.arrow.removeAttribute('style'); else if (style !== undefined) before.arrow.setAttribute('style', style); arrowStyles.delete(before.arrow); }
        rememberArrow(); owner.attr(el, 'role', options.role ?? originalRole); if (rebind) bind(target); if (owner.disposed) return;
        if (before.transition !== next.transition || before.transitionDuration !== next.transitionDuration) motion.finish();
        if (isOpen) activate();
      } catch (error) { options = before; if (!owner.disposed) { try { owner.attr(el, 'role', options.role ?? originalRole); bind(previousAnchor); if (isOpen) activate(); } catch { try { close(); } catch {} } } throw error; }
    }));
  } catch (error) { try { owner.dispose(); } catch {} throw error; }
  return { open, close, toggle: () => isOpen ? close() : open(), state: readonlyState(state), dispose: owner.dispose };
}
