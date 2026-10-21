import { createUIMotion, UI_MOTION_SHAPE, type UITransitionConfig } from './motion';
import { signal, untrack } from '@zenith/state';
import { createRovingTabindex, useId } from '@zenith/a11y';
import { s } from '@zenith/schema';
import { createReservedError } from '@zenith/errors';
import type { Cleanup, MaybeReactive } from '@zenith/shared';
import { ownership, readonlyState, event, idScopeFor } from './internal';
import { strictUIOptions, resolveUIOptions, watchUIOptions } from './options';
/** @public */
export interface TabsConfig extends UITransitionConfig {
  orientation?: 'horizontal' | 'vertical'; activation?: 'auto' | 'manual'; value?: number; lazy?: boolean;
  /** Called once per visited panel. The controller owns the returned cleanup. */
  mountPanel?: (panel: HTMLElement, index: number) => void | Cleanup;
}
/** @public */
export type TabsOptions = { [K in keyof TabsConfig]: MaybeReactive<TabsConfig[K]> };
/** @public */
export const tabsOptions = /* @__PURE__ */ strictUIOptions<TabsConfig>('TabsOptions', s.object({
  ...UI_MOTION_SHAPE, orientation: s.default(s.enum(['horizontal', 'vertical']), 'horizontal'), activation: s.default(s.enum(['auto', 'manual']), 'auto'), value: s.optional(s.number({ int: true, min: 0 })), lazy: s.default(s.boolean(), false), mountPanel: s.optional(s.custom<NonNullable<TabsConfig['mountPanel']>>(value => typeof value === 'function', 'panel mount callback')),
}));
/** APG tabs with nested-widget isolation and identity-preserving lazy panels. @public */
export function createTabs(el: HTMLElement, input: TabsOptions = {}) {
  let options = untrack(() => resolveUIOptions(input, tabsOptions.resolve));
  const list = el.querySelector<HTMLElement>('[zen-tablist]') ?? el;
  const belongs = (node: HTMLElement) => { const nearest = node.closest('[zen-tabs],[role="tablist"]'); return nearest === el || nearest === list || nearest === null; };
  const tabs = Array.from(list.querySelectorAll<HTMLElement>('[zen-tab]')).filter(belongs);
  const panels = Array.from(el.querySelectorAll<HTMLElement>('[zen-tabpanel]')).filter(panel => { for (let parent = panel.parentElement; parent && parent !== el; parent = parent.parentElement) if (parent.matches('[zen-tabs],[zen-tabpanel]')) return false; return true; });
  if (!tabs.length || tabs.length !== panels.length) throw createReservedError('ZEN-1602');
  const enabled = (tab: HTMLElement) => !tab.hasAttribute('disabled') && tab.getAttribute('aria-disabled') !== 'true';
  const validateValue = (index: number) => { if (!Number.isInteger(index) || !tabs[index] || !enabled(tabs[index]!)) throw createReservedError('ZEN-1603'); };
  const initial = options.value ?? tabs.findIndex(enabled); validateValue(initial);
  const owner = ownership(el), state = signal(initial), scope = idScopeFor(el); owner.add(state);
  const ssr = Boolean((el.ownerDocument as Document & { __zenithSSR__?: boolean }).__zenithSSR__);
  const motions = new Map<HTMLElement, ReturnType<typeof createUIMotion>>(); let renderedIndex: number | undefined;
  const parked = new Map<HTMLElement, { content: DocumentFragment; marker?: HTMLTemplateElement }>(), mounted = new Set<HTMLElement>(); let revision = 0, rovingVersion = 0, stopRoving: Cleanup = () => {};
  owner.add(() => { for (const [panel, entry] of parked) { entry.marker?.remove(); panel.appendChild(entry.content); } parked.clear(); });
  owner.add(() => { rovingVersion++; stopRoving(); });
  const reveal = (panel: HTMLElement) => { const entry = parked.get(panel); if (entry) { entry.marker?.remove(); panel.appendChild(entry.content); parked.delete(panel); } };
  const syncLazy = () => {
    for (const panel of panels) {
      if (owner.disposed) return;
      if (!options.lazy || mounted.has(panel)) {
        const newlyRevealed = !options.lazy && parked.has(panel) && !mounted.has(panel); reveal(panel);
        if (newlyRevealed && !owner.disposed) {
          mounted.add(panel);
          try { const cleanup = options.mountPanel?.(panel, panels.indexOf(panel)); if (cleanup) owner.add(cleanup); } catch (error) { mounted.delete(panel); throw error; }
        }
        continue;
      }
      if (parked.has(panel)) continue;
      const content = el.ownerDocument.createDocumentFragment();
      // Register restoration before moving custom elements (disconnect callbacks
      // may synchronously dispose this controller). Never loop over a live list.
      const entry: { content: DocumentFragment; marker?: HTMLTemplateElement } = { content }; parked.set(panel, entry);
      for (const child of Array.from(panel.childNodes)) { if (owner.disposed) return; content.appendChild(child); }
      if (owner.disposed) return;
      if (ssr) { const marker = el.ownerDocument.createElement('template'); marker.setAttribute('data-zen-lazy-panel', ''); const holder = el.ownerDocument.createElement('div'); holder.appendChild(content.cloneNode(true)); marker.innerHTML = holder.innerHTML; panel.appendChild(marker); entry.marker = marker; }
    }
  };
  const select = (index: number, notify = true) => {
    if (owner.disposed) return;
    if (!Number.isInteger(index) || !tabs[index]) throw createReservedError('ZEN-1603'); if (!enabled(tabs[index]!)) return;
    const version = ++revision, current = () => !owner.disposed && version === revision, panel = panels[index]!;
    if (!mounted.has(panel)) {
      mounted.add(panel); reveal(panel); if (!current()) return;
      try { const cleanup = options.mountPanel?.(panel, index); if (cleanup) owner.add(cleanup); } catch (error) { mounted.delete(panel); throw error; }
    }
    if (!current()) return;
    const changed = state.peek() !== index; state.set(index); if (!current()) return;
    const attr = (node: HTMLElement, name: string, value: string | null) => { if (current()) owner.attr(node, name, value); };
    tabs.forEach((item, i) => {
      if (!current()) return; attr(item, 'aria-selected', String(i === index)); attr(item, 'tabindex', i === index ? '0' : '-1'); attr(panels[i]!, 'data-state', i === index ? 'active' : 'inactive');
      if (renderedIndex !== index) { const motion = motions.get(panels[i]!); if (i === index) { motion?.show(); if (renderedIndex !== undefined) motion?.enter(); } else motion?.hide(renderedIndex === i); }
    });
    if (current()) renderedIndex = index;
    if (notify && current() && changed) event(el, 'zen-tabs-change', { index });
  };
  const roving = () => {
    const version = ++rovingVersion; stopRoving(); stopRoving = () => {};
    if (owner.disposed) return;
    owner.attr(list, 'aria-orientation', options.orientation ?? 'horizontal'); owner.attr(el, 'data-orientation', options.orientation ?? 'horizontal');
    const cleanup = createRovingTabindex(list, { selector: '[zen-tab]', orientation: options.orientation, filter: item => tabs.includes(item) });
    if (owner.disposed || version !== rovingVersion) cleanup(); else stopRoving = cleanup;
  };
  try {
    owner.attr(list, 'role', 'tablist');
    tabs.forEach((tab, index) => {
      if (owner.disposed) return;
      const panel = panels[index]!;
      motions.set(panel, createUIMotion(panel, owner, () => ({ ...options, transition: options.transition ?? el.getAttribute('zen-transition') ?? undefined })));
      if (!tab.id) owner.attr(tab, 'id', useId({ prefix: 'tab', scope })); if (!panel.id) owner.attr(panel, 'id', useId({ prefix: 'panel', scope }));
      owner.attr(tab, 'role', 'tab'); owner.attr(tab, 'aria-controls', panel.id); owner.attr(panel, 'role', 'tabpanel'); owner.attr(panel, 'aria-labelledby', tab.id);
      // Restore a server marker before deciding whether the client remains lazy.
      const hydration = Array.from(panel.children).find(node => node.tagName === 'TEMPLATE' && node.hasAttribute('data-zen-lazy-panel')) as HTMLTemplateElement | undefined;
      if (hydration) hydration.replaceWith(hydration.content);
      owner.on(tab, 'click', () => select(index)); owner.on(tab, 'focus', () => { if (options.activation !== 'manual') select(index); }); owner.on(tab, 'keydown', e => { if (!e.isComposing && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(index); } });
    });
    syncLazy(); select(initial, false); if (!owner.disposed) roving();
    if (!owner.disposed) owner.add(watchUIOptions(input, tabsOptions.resolve, options, next => {
      if (owner.disposed) return;
      const index = next.value !== options.value ? next.value ?? tabs.findIndex(enabled) : state.peek(); validateValue(index);
      const orientationChanged = options.orientation !== next.orientation, motionChanged = options.transition !== next.transition || options.transitionDuration !== next.transitionDuration; options = next; if (motionChanged) for (const motion of motions.values()) motion.finish(); syncLazy(); select(index, false); if (orientationChanged && !owner.disposed) roving();
    }));
  } catch (error) { try { owner.dispose(); } catch {} throw error; }
  return { select: (index: number) => select(index), setValue: (index: number) => select(index, false), state: readonlyState(state), dispose: owner.dispose };
}
