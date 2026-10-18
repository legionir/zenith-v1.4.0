// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createApp } from '@zenith/runtime-core';
import { createDialog, createPopover, createTabs, createMenu, uiPlugin } from '../src';
function root(html: string) { const element = document.createElement('div'); element.innerHTML = html; document.body.appendChild(element); return element; }
function key(element: HTMLElement, value: string) { element.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true })); }
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });
it('closes only the inner popover before the enclosing dialog on Escape', () => {
  const element = root('<h2 zen-dialog-title>Dialog</h2><button id="trigger">Open</button><section id="popup"><button>Inside</button></section>');
  const dialog = createDialog(element); const trigger = element.querySelector<HTMLElement>('#trigger')!; const popup = element.querySelector<HTMLElement>('#popup')!;
  const popover = createPopover(popup, { trigger });
  try {
    dialog.open(); popover.open(); key(popup.querySelector('button')!, 'Escape');
    expect(popover.state.get()).toBe(false); expect(dialog.state.get()).toBe(true); expect(document.activeElement).toBe(trigger);
    key(trigger, 'Escape'); expect(dialog.state.get()).toBe(false);
  } finally { popover.dispose(); dialog.dispose(); }
});
it('parks unvisited lazy panels, mounts once, and restores the same content nodes', () => {
  const element = root('<div zen-tablist><button zen-tab>A</button><button zen-tab>B</button></div><section zen-tabpanel>A</section><section zen-tabpanel><button>B content</button></section>');
  const panel = element.querySelectorAll<HTMLElement>('[zen-tabpanel]')[1]!; const original = panel.firstChild; const dispose = vi.fn(); const mount = vi.fn(() => dispose);
  const tabs = createTabs(element, { lazy: true, mountPanel: mount }); expect(panel.firstChild).toBeNull(); expect(mount).toHaveBeenCalledTimes(1);
  tabs.select(1); expect(panel.firstChild).toBe(original); tabs.select(0); tabs.select(1); expect(mount).toHaveBeenCalledTimes(2);
  tabs.dispose(); expect(dispose).toHaveBeenCalledTimes(2); expect(panel.firstChild).toBe(original);
});
it('integrates lazy directive content with actual App binding without double mounts', () => {
  const element = root('<section zen-tabs zen-tabs-lazy><div zen-tablist><button zen-tab>A</button><button zen-tab>B</button></div><div zen-tabpanel><span zen-probe>A</span></div><div zen-tabpanel><span zen-probe>B</span></div></section>');
  const calls: string[] = []; const releases: string[] = []; const app = createApp({ plugins: [uiPlugin()] });
  app.directive({ name: 'probe', bind(el) { const name = el.textContent!; calls.push(name); return () => { releases.push(name); }; } });
  app.mount(element); expect(calls).toEqual(['A']); element.querySelectorAll<HTMLButtonElement>('[zen-tab]')[1]!.click(); expect(calls).toEqual(['A', 'B']);
  element.querySelectorAll<HTMLButtonElement>('[zen-tab]')[0]!.click(); element.querySelectorAll<HTMLButtonElement>('[zen-tab]')[1]!.click(); expect(calls).toEqual(['A', 'B']);
  app.dispose(); expect(releases.sort()).toEqual(['A', 'B']);
});
it('keeps independent radio groups and nested submenu Escape/focus ownership', () => {
  const trigger = document.createElement('button'); document.body.appendChild(trigger);
  const element = root('<button zen-menu-item zen-menu-radio="theme">Light</button><button zen-menu-item zen-menu-radio="theme">Dark</button><button zen-menu-item zen-menu-radio="size" aria-checked="true">Small</button><button zen-menu-item zen-menu-submenu="#child-menu">More</button><div zen-menu id="child-menu"><button zen-menu-item>Child</button></div>');
  const menu = createMenu(element, { trigger, closeOnSelect: false });
  try {
    menu.open(); const items = element.querySelectorAll<HTMLButtonElement>('[zen-menu-item]'); items[1]!.click(); expect(items[1]!.getAttribute('aria-checked')).toBe('true'); expect(items[2]!.getAttribute('aria-checked')).toBe('true');
    items[3]!.focus(); key(items[3]!, 'ArrowRight'); const child = element.querySelector<HTMLElement>('#child-menu')!; expect(child.hidden).toBe(false); expect(document.activeElement).toBe(child.querySelector('button'));
    key(child.querySelector('button')!, 'Escape'); expect(child.hidden).toBe(true); expect(menu.state.get()).toBe(true); expect(document.activeElement).toBe(items[3]);
    key(items[3]!, 'Escape'); expect(menu.state.get()).toBe(false);
  } finally { menu.dispose(); }
});
it('rejects cyclic submenu ownership rather than recursing or leaking controllers', () => {
  const trigger = document.createElement('button'); document.body.appendChild(trigger);
  const element = root('<button zen-menu-item zen-menu-submenu="#self">Cycle</button>'); element.id = 'self';
  expect(() => createMenu(element, { trigger })).toThrow(); expect(element.hasAttribute('role')).toBe(false); expect(trigger.hasAttribute('aria-expanded')).toBe(false);
});

it('supports nonmodal Escape without locking scroll or trapping ordinary Tab', () => {
  const before = document.createElement('button'); document.body.appendChild(before); before.focus();
  const element = root('<h2 zen-dialog-title>Nonmodal</h2><button>inside</button>'); const dialog = createDialog(element, { modal: false });
  try { dialog.open(); expect(document.body.style.overflow).not.toBe('hidden'); expect(document.activeElement).toBe(element.querySelector('button')); key(element.querySelector('button')!, 'Escape'); expect(dialog.state.get()).toBe(false); expect(document.activeElement).toBe(before); }
  finally { dialog.dispose(); }
});
it('never acquires inert/scroll/Escape leases for a server-open dialog', () => {
  Object.defineProperty(document, '__zenithSSR__', { configurable: true, value: true });
  const sibling = root('background'); const element = root('<h2 zen-dialog-title>SSR</h2>');
  try { const dialog = createDialog(element, { initialOpen: true }); expect(element.hidden).toBe(false); expect(sibling.hasAttribute('aria-hidden')).toBe(false); expect(document.body.style.overflow).not.toBe('hidden'); dialog.dispose(); }
  finally { Reflect.deleteProperty(document, '__zenithSSR__'); }
});

it('serializes unvisited lazy markup inertly and binds it on a later client visit', () => {
  const serverDocument = document.implementation.createHTMLDocument(); Object.defineProperty(serverDocument, '__zenithSSR__', { value: true, configurable: true });
  serverDocument.body.innerHTML = '<section zen-tabs zen-tabs-lazy><div zen-tablist><button zen-tab>A</button><button zen-tab>B</button></div><section zen-tabpanel><span>A</span></section><section zen-tabpanel><span zen-text="title"></span></section></section>';
  const serverRoot = serverDocument.body.firstElementChild as HTMLElement; const server = createApp({ state: { title: 'later' }, plugins: [uiPlugin()] });
  let client: ReturnType<typeof createApp> | undefined;
  try {
    server.mount(serverRoot); expect(serverRoot.querySelector('template[data-zen-lazy-panel]')).not.toBeNull();
    const element = root(serverRoot.outerHTML); client = createApp({ state: { title: 'later' }, plugins: [uiPlugin()] }); client.mount(element);
    expect(element.querySelectorAll('[zen-tabpanel]')[1]!.childNodes).toHaveLength(0);
    element.querySelectorAll<HTMLButtonElement>('[zen-tab]')[1]!.click(); expect(element.querySelectorAll('[zen-tabpanel]')[1]!.textContent).toBe('later');
  } finally { client?.dispose(); server.dispose(); }
});

it('closes a portaled submenu chain on selection/Tab and returns focus to the outer trigger', () => {
  const trigger = document.createElement('button'); document.body.appendChild(trigger);
  const child = root('<button zen-menu-item>Child</button>'); child.id = 'portaled-child'; child.setAttribute('zen-menu', '');
  const element = root('<button zen-menu-item zen-menu-submenu="#portaled-child">More</button>'); const menu = createMenu(element, { trigger });
  try { menu.open(); element.querySelector('button')!.click(); child.querySelector('button')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); expect(menu.state.get()).toBe(true); child.querySelector('button')!.click(); expect(menu.state.get()).toBe(false); expect(document.activeElement).toBe(trigger);
    menu.open(); element.querySelector('button')!.click(); key(child.querySelector('button')!, 'Tab'); expect(menu.state.get()).toBe(false); expect(document.activeElement).toBe(trigger);
  } finally { menu.dispose(); }
});

it('includes portaled menu focus in the modal trap without exposing background siblings', () => {
  const background = root('<button>background</button>'); const host = root('<aside><button>unrelated</button></aside><section id="modal-portal"><button zen-menu-item>Portaled item</button></section>');
  const element = root('<h2 zen-dialog-title>Modal</h2><button id="portal-trigger">Open menu</button><button id="last">Last</button>');
  const dialog = createDialog(element); const trigger = element.querySelector<HTMLElement>('#portal-trigger')!; const portal = host.querySelector<HTMLElement>('#modal-portal')!;
  const menu = createMenu(portal, { trigger });
  try {
    dialog.open(); expect(background.getAttribute('aria-hidden')).toBe('true'); menu.open(); const item = portal.querySelector<HTMLElement>('button')!; item.focus();
    expect(document.activeElement).toBe(item); expect(portal.closest('[inert]')).toBeNull(); expect(host.querySelector('aside')!.getAttribute('aria-hidden')).toBe('true'); expect(background.getAttribute('aria-hidden')).toBe('true');
    key(item, 'Escape'); expect(menu.state.get()).toBe(false); expect(dialog.state.get()).toBe(true); expect(document.activeElement).toBe(trigger);
    dialog.close(); expect(background.hasAttribute('aria-hidden')).toBe(false); expect(host.querySelector('aside')!.hasAttribute('aria-hidden')).toBe(false);
  } finally { menu.dispose(); dialog.dispose(); }
});
it('leases duplicate menu calls without disposing another consumer or duplicating item listeners', () => {
  const trigger = document.createElement('button'); document.body.appendChild(trigger);
  const element = root('<button zen-menu-item>Pick</button>');
  const first = createMenu(element, { trigger }); const second = createMenu(element, { trigger }); const selected = vi.fn(); element.addEventListener('zen-menu-select', selected);
  try {
    first.dispose(); first.dispose(); second.open(); element.querySelector('button')!.click(); expect(selected).toHaveBeenCalledOnce();
    second.open(); expect(second.state.get()).toBe(true); first.close(); expect(second.state.get()).toBe(true);
  } finally { first.dispose(); second.dispose(); }
  expect(element.hasAttribute('role')).toBe(false); expect(trigger.hasAttribute('aria-expanded')).toBe(false);
});
it('releases a parent submenu lease while retaining a separately acquired child controller', () => {
  const trigger = document.createElement('button'); document.body.appendChild(trigger);
  const element = root('<button zen-menu-item zen-menu-submenu="#borrowed-menu">More</button>'); const child = root('<button zen-menu-item>Child</button>'); child.id = 'borrowed-menu';
  const item = element.querySelector<HTMLElement>('button')!; const borrowed = createMenu(child, { trigger: item, triggerOn: 'manual' }); const parent = createMenu(element, { trigger });
  try {
    parent.open(); item.click(); expect(borrowed.state.get()).toBe(true); parent.dispose(); borrowed.open(); expect(borrowed.state.get()).toBe(true); expect(child.getAttribute('role')).toBe('menu');
  } finally { parent.dispose(); borrowed.dispose(); }
  expect(child.hasAttribute('role')).toBe(false);
});
it('rejects a second trigger without invalidating an existing menu lease', () => {
  const first = document.createElement('button'), other = document.createElement('button'); document.body.append(first, other); const element = root('<button zen-menu-item>Pick</button>'); const owned = createMenu(element, { trigger: first });
  try { expect(() => createMenu(element, { trigger: other })).toThrow(); owned.open(); expect(owned.state.get()).toBe(true); } finally { owned.dispose(); }
});
