import { menuOptions, FLOATING_OPTION_KEYS } from './surface-options';
import { untrack } from '@zenith/state';
import { isReadable, type MaybeReactive } from '@zenith/shared';
import { resolveUIOptions, watchUIOptions, projectUIOptions, sameUIValue } from './options';
export { menuOptions } from './surface-options';
import { createRovingTabindex, useId } from '@zenith/a11y';
import { createReservedError } from '@zenith/errors';
import { createPopover, type PopoverConfig } from './popover';
import { ownership, cleanupScope, eventTarget, event, idScopeFor, floatingBranch } from './internal';
/** @public */
export interface MenuConfig extends PopoverConfig { role?: 'menu'; loop?: boolean; typeahead?: boolean; closeOnSelect?: boolean; }
/** @public */
export type MenuOptions = { [K in keyof MenuConfig]: MaybeReactive<MenuConfig[K]> };
/** @public */
export type MenuController = ReturnType<typeof createPopover>;
const parentDismiss = new WeakMap<HTMLElement, (reason: 'select' | 'tab') => boolean>();
const constructing = new WeakSet<HTMLElement>();
interface MenuEntry { controller: MenuController; references: number; closed: boolean; source: MenuOptions; config(): MenuConfig; }
const controllers = new WeakMap<HTMLElement, MenuEntry>();
const parentLinks = new WeakMap<HTMLElement, { parent: HTMLElement; trigger: HTMLElement }>();
function lease(entry: MenuEntry): MenuController {
  entry.references++; let active = true;
  return { ...entry.controller,
    open() { if (active && !entry.closed) entry.controller.open(); },
    close() { if (active && !entry.closed) entry.controller.close(); },
    toggle() { if (active && !entry.closed) entry.controller.toggle(); },
    dispose() { if (!active) return; active = false; if (--entry.references === 0 && !entry.closed) entry.controller.dispose(); },
  };
}
const triggers = new WeakMap<HTMLElement, HTMLElement>();
/**
 * APG menus with one configuration source per element. Acquisitions may omit
 * options, match current concrete values, or reuse the exact same readables.
 * An unrelated readable is never silently ignored, even if its value matches.
 * @public
 */
export function createMenu(el: HTMLElement, input: MenuOptions = {}): MenuController {
  let options = untrack(() => resolveUIOptions(input, menuOptions.resolve));
  const existing = controllers.get(el);
  if (existing) {
    if (existing.closed) throw createReservedError('ZEN-1001', { details: { expected: 'a menu outside teardown' } });
    const current = existing.config();
    for (const key of Object.keys(input) as Array<keyof MenuConfig>) {
      const source = input[key]; if (source === undefined) continue;
      if (isReadable(source)) {
        if (source !== existing.source[key]) throw createReservedError('ZEN-1603', { details: { option: key, expected: 'the existing menu configuration source' } });
        continue; // The identical source may have a scheduled, not-yet-applied update.
      }
      if (key === 'trigger') {
        let requested: Element | null | undefined;
        try { requested = typeof options.trigger === 'string' ? el.ownerDocument.querySelector(options.trigger) : options.trigger; } catch { throw createReservedError('ZEN-1601'); }
        if (requested !== triggers.get(el)) throw createReservedError('ZEN-1601');
      } else if (!sameUIValue(key === 'role' ? options.role ?? 'menu' : options[key], key === 'role' ? current.role ?? 'menu' : current[key])) throw createReservedError('ZEN-1603', { details: { option: key, expected: 'the existing menu configuration' } });
    }
    return lease(existing);
  }
  const surface = createPopover(el, { ...projectUIOptions(input, FLOATING_OPTION_KEYS), role: 'menu' }); const owner = ownership(el);
  let trigger = typeof options.trigger === 'string' ? el.ownerDocument.querySelector<HTMLElement>(options.trigger) : options.trigger;
  let triggerBinding = cleanupScope(); owner.add(() => triggerBinding.dispose());
  const bindTrigger = () => {
    triggerBinding.dispose(); triggerBinding = cleanupScope(); if (owner.disposed || !trigger) return;
    // Popover is the sole writer of trigger ARIA. A second snapshot owner
    // would resurrect stale attributes after anchor replacement/disposal.
    triggerBinding.add(owner.watch(trigger));
  };
  const submenus = new Map<HTMLElement, MenuController>();
  const owns = (item: HTMLElement) => item.closest('[zen-menu],[role="menu"]') === el;
  const items = () => Array.from(el.querySelectorAll<HTMLElement>('[zen-menu-item]')).filter(owns);
  const enabled = (item: HTMLElement) => item.getAttribute('aria-disabled') !== 'true' && !item.hasAttribute('disabled') && !item.closest('[hidden],[inert]');
  const focusFirst = () => items().find(enabled)?.focus();
  const rtl = () => el.ownerDocument.defaultView?.getComputedStyle(el).direction === 'rtl' || el.closest('[dir]')?.getAttribute('dir') === 'rtl';
  const dismiss = (reason: 'select' | 'tab'): boolean => { surface.close(); const parentClosed = parentDismiss.get(el)?.(reason); if (!parentClosed && options.returnFocus !== false && trigger?.isConnected) trigger.focus(); return true; };
  let timer: ReturnType<typeof setTimeout> | undefined; let search = '';
  owner.add(surface); constructing.add(el);
  try {
    if (!el.id) owner.attr(el, 'id', useId({ prefix: 'menu', scope: idScopeFor(el) }));
    bindTrigger();
    for (const item of items()) {
      owner.attr(item, 'role', item.hasAttribute('zen-menu-checkbox') ? 'menuitemcheckbox' : item.hasAttribute('zen-menu-radio') ? 'menuitemradio' : 'menuitem');
      if (item.hasAttribute('zen-menu-item-disabled')) owner.attr(item, 'aria-disabled', 'true');
      if (item.matches('[zen-menu-checkbox],[zen-menu-radio]') && !item.hasAttribute('aria-checked')) owner.attr(item, 'aria-checked', String(item.hasAttribute('zen-menu-checked')));
      const selector = item.getAttribute('zen-menu-submenu');
      if (selector) {
        let child: HTMLElement | null;
        try { child = el.ownerDocument.querySelector<HTMLElement>(selector); } catch { throw createReservedError('ZEN-1601'); }
        if (!child || child === el || child.contains(el) || constructing.has(child)) throw createReservedError('ZEN-1601');
        const previousLink = parentLinks.get(child);
        if (previousLink && (previousLink.parent !== el || previousLink.trigger !== item)) throw createReservedError('ZEN-1601');
        // A separately configured child owns its own sources. Internal parent
        // attachment borrows that configuration rather than pretending to apply
        // inherited sources. New children inherit the parent's live behavior.
        const submenu = createMenu(child, controllers.has(child) ? { trigger: item } : { ...input, trigger: item, triggerOn: 'manual', arrow: undefined, placement: rtl() ? 'left' : 'right' }); submenus.set(item, submenu); owner.add(submenu);
        const link = { parent: el, trigger: item }; parentLinks.set(child, link);
        owner.add(() => { if (parentLinks.get(child) === link) parentLinks.delete(child); });
        owner.add(floatingBranch(el, child));
        const dismissChild = (reason: 'select' | 'tab') => reason === 'select' && options.closeOnSelect === false ? false : dismiss(reason); parentDismiss.set(child, dismissChild); owner.add(() => { if (parentDismiss.get(child) === dismissChild) parentDismiss.delete(child); });
        owner.on(child, 'keydown', e => { if (e.key === (rtl() ? 'ArrowRight' : 'ArrowLeft')) { e.preventDefault(); e.stopPropagation(); submenu.close(); item.focus(); } });
      }
    }
    owner.add(createRovingTabindex(el, { selector: '[zen-menu-item]', orientation: 'vertical', get loop() { return options.loop; }, filter: owns }));
    const onOpen = (e: Event) => { if (e.target === el) focusFirst(); };
    const onClose = (e: Event) => { if (e.target === el) for (const submenu of submenus.values()) submenu.close(); };
    const onSelect = (e: Event) => { if (e.target === el && options.closeOnSelect !== false) dismiss('select'); };
    el.addEventListener('zen-popover-open', onOpen); el.addEventListener('zen-popover-close', onClose); el.addEventListener('zen-menu-select', onSelect);
    owner.add(() => { el.removeEventListener('zen-popover-open', onOpen); el.removeEventListener('zen-popover-close', onClose); el.removeEventListener('zen-menu-select', onSelect); });
    const choose = (item: HTMLElement) => {
      if (!enabled(item)) return;
      const submenu = submenus.get(item); if (submenu) { submenu.open(); return; }
      if (item.hasAttribute('zen-menu-checkbox')) owner.attr(item, 'aria-checked', String(item.getAttribute('aria-checked') !== 'true'));
      if (item.hasAttribute('zen-menu-radio')) for (const candidate of items()) if (candidate.hasAttribute('zen-menu-radio') && candidate.getAttribute('zen-menu-radio') === item.getAttribute('zen-menu-radio')) owner.attr(candidate, 'aria-checked', String(candidate === item));
      event(el, 'zen-menu-select', { value: item.getAttribute('data-value') ?? item.textContent });
    };
    owner.on(el, 'click', e => { const item = eventTarget(e)?.closest<HTMLElement>('[zen-menu-item]'); if (item && owns(item)) choose(item); });
    owner.on(el, 'keydown', e => {
      if (e.isComposing) return;
      const item = eventTarget(e)?.closest<HTMLElement>('[zen-menu-item]'); if (!item || !owns(item)) return;
      if (e.key === 'Tab') { dismiss('tab'); return; }
      if (e.key === (rtl() ? 'ArrowLeft' : 'ArrowRight') && submenus.has(item)) { e.preventDefault(); submenus.get(item)!.open(); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(item); }
      else if (options.typeahead !== false && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        clearTimeout(timer); search += e.key.toLocaleLowerCase(); const prefix = [...search].every(char => char === search[0]) ? search[0]! : search;
        const all = items().filter(enabled); const index = all.indexOf(item); const ordered = [...all.slice(index + 1), ...all.slice(0, index + 1)]; ordered.find(candidate => candidate.textContent?.trim().toLocaleLowerCase().startsWith(prefix))?.focus();
        timer = setTimeout(() => { search = ''; }, 500);
      }
    });
    owner.add(() => { clearTimeout(timer); });
    if (!owner.disposed) owner.add(watchUIOptions(input, menuOptions.resolve, options, next => {
      if (owner.disposed) return; let target: HTMLElement | null | undefined;
      try { target = typeof next.trigger === 'string' ? el.ownerDocument.querySelector<HTMLElement>(next.trigger) : next.trigger; } catch { throw createReservedError('ZEN-1601'); }
      if (!target || target.ownerDocument !== el.ownerDocument || target === el || el.contains(target)) throw createReservedError('ZEN-1601');
      options = next; if (!next.typeahead) { clearTimeout(timer); search = ''; }
      if (target !== trigger) { trigger = target; bindTrigger(); if (!owner.disposed) triggers.set(el, target); }
    }));
    owner.afterDispose(() => { controllers.delete(el); triggers.delete(el); });
    const controller: MenuController = { ...surface, open() { if (owner.disposed) return; surface.open(); if (!owner.disposed && surface.state.peek()) focusFirst(); }, dispose: owner.dispose };
    const entry: MenuEntry = { controller, references: 0, closed: false, source: { ...input }, config: () => options };
    owner.add(() => { entry.closed = true; });
    controllers.set(el, entry); if (trigger) triggers.set(el, trigger); return lease(entry);
  } catch (error) { try { owner.dispose(); } catch {} throw error; } finally { constructing.delete(el); }
}
