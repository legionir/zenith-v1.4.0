import { dialogOptions } from './surface-options';
export { dialogOptions } from './surface-options';
import { signal, untrack } from '@zenith/state';
import type { Cleanup, MaybeReactive } from '@zenith/shared';
import { createReservedError } from '@zenith/errors';
import { createFocusTrap, getFocusable, registerEscapeLayer, lockScroll, inert, useId, type IdScope } from '@zenith/a11y';
import { ownership, cleanupScope, readonlyState, event, eventTarget, idScopeFor, modalLease, floatingRoots, containsFloatingTarget } from './internal';
import { resolveUIOptions, watchUIOptions } from './options';
import { createPortal } from './portal';
import { createUIMotion, type UITransitionConfig } from './motion';
/** @public */
export interface DialogConfig extends UITransitionConfig { modal?: boolean; role?: 'dialog' | 'alertdialog'; closeOnEsc?: boolean; closeOnBackdrop?: boolean; initialFocus?: string | HTMLElement; returnFocus?: boolean; scrollLock?: boolean; initialOpen?: boolean; idScope?: IdScope; portal?: string | HTMLElement | false; }
/** @public */
export type DialogOptions = { [K in keyof DialogConfig]: MaybeReactive<DialogConfig[K]> };
/** Nested dialogs share Escape ownership and independent focus/scroll/inert leases. @public */
export function createDialog(el: HTMLElement, input: DialogOptions = {}) {
  const doc = el.ownerDocument, ssr = Boolean((doc as Document & { __zenithSSR__?: boolean }).__zenithSSR__);
  let options = untrack(() => resolveUIOptions(input, dialogOptions.resolve));
  const validate = (config: DialogConfig) => {
    let focus: HTMLElement | null | undefined, target: HTMLElement | null | undefined;
    try { focus = typeof config.initialFocus === 'string' ? el.querySelector<HTMLElement>(config.initialFocus) : config.initialFocus; } catch { throw createReservedError('ZEN-1601'); }
    if ((config.initialFocus && !focus) || (focus && (focus.ownerDocument !== doc || !containsFloatingTarget(el, focus)))) throw createReservedError('ZEN-1601');
    if (!ssr && config.portal) {
      try { target = typeof config.portal === 'string' ? doc.querySelector<HTMLElement>(config.portal) : config.portal; } catch { throw createReservedError('ZEN-1604'); }
      if (!target || target.ownerDocument !== doc || el.contains(target)) throw createReservedError('ZEN-1604');
    }
    return target ?? undefined;
  };
  const initialTarget = validate(options), owner = ownership(el), opened = signal(false);
  let revision = 0, activation = 0, portalVersion = 0, isOpen = false, release: Cleanup = () => {}, releasePortal: Cleanup = () => {}, returnTarget: HTMLElement | null = null;
  owner.add(() => { portalVersion++; releasePortal(); });
  owner.add(() => {
    revision++; activation++; isOpen = false; const undo = release, previous = returnTarget; release = () => {}; returnTarget = null;
    try { undo(); } finally { try { if (!ssr && options.returnFocus !== false && previous?.isConnected) previous.focus(); } finally { try { opened.set(false); } finally { opened.dispose(); } } }
  });
  const motion = createUIMotion(el, owner, () => options);
  const title = el.querySelector<HTMLElement>('[zen-dialog-title]'), description = el.querySelector<HTMLElement>('[zen-dialog-description]');
  const generatedTitle = !!title && !title.id, generatedDescription = !!description && !description.id;
  const attributes = (renewIds = false) => {
    const scope = options.idScope ?? idScopeFor(el);
    const titleId = title && (generatedTitle && (renewIds || !title.id) ? useId({ prefix: 'dialog-title', scope }) : title.id);
    const descriptionId = description && (generatedDescription && (renewIds || !description.id) ? useId({ prefix: 'dialog-description', scope }) : description.id);
    owner.attr(el, 'role', options.role ?? 'dialog'); owner.attr(el, 'aria-modal', options.modal !== false ? 'true' : null);
    if (title && titleId) { owner.attr(title, 'id', titleId); owner.attr(el, 'aria-labelledby', titleId); }
    if (description && descriptionId) { owner.attr(description, 'id', descriptionId); owner.attr(el, 'aria-describedby', descriptionId); }
  };
  const portal = (target?: HTMLElement) => {
    if (owner.disposed) return;
    activation++; const stop = release; release = () => {}; stop(); motion.finish();
    const version = ++portalVersion, undo = releasePortal; releasePortal = () => {}; undo();
    if (!owner.disposed && version === portalVersion && target && target !== el.parentElement) {
      const next = createPortal(el, { target }); if (owner.disposed || version !== portalVersion) next(); else releasePortal = next;
    }
  };
  const close = (reason: 'esc' | 'backdrop' | 'api' = 'api') => {
    if (owner.disposed || !isOpen) return;
    const version = ++revision, undo = release, previous = returnTarget; activation++; release = () => {}; returnTarget = null; isOpen = false;
    owner.attr(el, 'data-state', 'closed');
    try { undo(); } finally {
      if (!owner.disposed && revision === version && !isOpen) {
        try { motion.hide(); if (!ssr && options.returnFocus !== false && previous?.isConnected) previous.focus(); }
        finally { if (!owner.disposed && revision === version && !isOpen) opened.set(false); }
      }
    }
    if (!owner.disposed && revision === version && !isOpen && !ssr) event(el, 'zen-dialog-close', { reason });
  };
  const activate = (refocus: boolean) => {
    const version = ++activation, undo = release; release = () => {}; undo();
    const current = () => !owner.disposed && isOpen && activation === version;
    if (!current() || ssr) return;
    const leases = cleanupScope(); release = leases.dispose;
    const focused = doc.activeElement as HTMLElement | null;
    const initialFocus = !refocus && focused && containsFloatingTarget(el, focused) ? focused : options.initialFocus;
    try {
      if (options.modal !== false) {
        if (options.scrollLock !== false) leases.add(lockScroll(doc)); if (!current()) return;
        leases.add(modalLease(el, inert)); if (!current()) return;
        const trap = createFocusTrap(el, { initialFocus, containers: () => floatingRoots(el), returnFocus: false, escapeDeactivates: false, onEscape: () => { if (options.closeOnEsc !== false) close('esc'); } });
        leases.add(trap); if (current()) trap.activate();
      } else {
        leases.add(registerEscapeLayer(doc, () => { if (options.closeOnEsc !== false) close('esc'); }));
        if (!current()) return;
        const target = typeof initialFocus === 'string' ? el.querySelector<HTMLElement>(initialFocus) : initialFocus ?? getFocusable(el)[0];
        if (target) target.focus(); else { owner.attr(el, 'tabindex', '-1'); el.focus(); }
      }
    } catch (error) { try { if (current()) close(); else leases.dispose(); } catch {} throw error; }
  };
  const open = () => {
    if (owner.disposed || isOpen) return;
    const version = ++revision; returnTarget = doc.activeElement as HTMLElement | null; isOpen = true;
    const current = () => !owner.disposed && isOpen && revision === version;
    motion.show(); owner.attr(el, 'data-state', 'open'); if (current()) opened.set(true); if (!current()) return;
    try { activate(true); if (!current()) return; motion.enter(); if (current() && !ssr) event(el, 'zen-dialog-open'); }
    catch (error) { try { if (current()) close(); } catch {} throw error; }
  };
  try {
    portal(initialTarget); attributes(); owner.attr(el, 'data-state', 'closed'); motion.hide(false);
    owner.on(el, 'click', e => { const target = eventTarget(e); if (target?.closest('[role="dialog"],[role="alertdialog"]') !== el) return; if (target.closest('[zen-dialog-close]')) close(); else if (options.closeOnBackdrop !== false && target.hasAttribute('zen-dialog-backdrop')) close('backdrop'); });
    if (options.initialOpen) open();
    if (!owner.disposed) owner.add(watchUIOptions(input, dialogOptions.resolve, options, next => {
      if (owner.disposed) return; const target = validate(next), before = options;
      const rebuild = before.modal !== next.modal || before.scrollLock !== next.scrollLock || before.initialFocus !== next.initialFocus || before.portal !== next.portal;
      options = next;
      try {
        attributes(before.idScope !== next.idScope);
        if (before.portal !== next.portal) portal(target); if (owner.disposed) return;
        if (before.transition !== next.transition || before.transitionDuration !== next.transitionDuration) motion.finish();
        if (before.initialOpen !== next.initialOpen) { if (next.initialOpen) open(); else close(); }
        else if (isOpen && rebuild) activate(before.initialFocus !== next.initialFocus);
      } catch (error) {
        options = before;
        if (!owner.disposed) { try { portal(validate(before)); attributes(); if (isOpen) activate(false); } catch { try { close(); } catch {} } }
        throw error;
      }
    }));
  } catch (error) { try { owner.dispose(); } catch {} throw error; }
  return { open, close: () => close(), toggle: () => isOpen ? close() : open(), state: readonlyState(opened), dispose: owner.dispose };
}
