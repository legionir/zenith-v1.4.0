// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createPortal, createDialog, createPopover, uiPlugin } from '../src';
import { floatingRoots, containsFloatingTarget } from '../src/internal';
import { createApp } from '@zenith/runtime-core';
const releases: Array<() => void> = [];
function root(html = '') { const el = document.createElement('section'); el.innerHTML = html; document.body.append(el); return el; }
afterEach(() => { for (const release of releases.splice(0).reverse()) release(); document.body.replaceChildren(); vi.restoreAllMocks(); });
it('registers generic portal content as a logical floating descendant until final release', () => {
  const source = root('<button>Before</button><aside><button>Portaled</button></aside>'), child = source.querySelector('aside')!;
  const first = createPortal(child, { target: document.body }), second = createPortal(child, { target: document.body }); releases.push(first, second);
  expect(floatingRoots(source)).toContain(child); expect(containsFloatingTarget(source, child.querySelector('button')!)).toBe(true); first(); expect(floatingRoots(source)).toContain(child); second(); expect(floatingRoots(source)).toEqual([source]); expect(child.parentElement).toBe(source);
});
it('returns portaled content to the detached source when that source is removed', async () => {
  const source = root('<aside>Content</aside>'), child = source.querySelector('aside')!, release = createPortal(child, { target: document.body }); releases.push(release);
  source.remove(); await Promise.resolve(); expect(child.parentElement).toBe(source); expect(child.isConnected).toBe(false); expect(floatingRoots(source)).toEqual([source]); release();
});
it('restores content when its target is removed and never steals an externally reparented element', async () => {
  const source = root('<aside>Content</aside>'), target = root(), child = source.querySelector('aside')!, release = createPortal(child, { target }); releases.push(release); target.remove(); await Promise.resolve(); expect(child.parentElement).toBe(source);
  const other = root(), next = createPortal(child, { target: document.body }); releases.push(next); other.append(child); await Promise.resolve(); next(); expect(child.parentElement).toBe(other); expect(floatingRoots(source)).toEqual([source]);
});
it('does not leave a body-level dialog orphaned after its App source subtree is removed', async () => {
  const source = root('<section zen-dialog><h2 zen-dialog-title>Title</h2><button>Inside</button></section>'), dialog = source.querySelector<HTMLElement>('[zen-dialog]')!;
  const app = createApp(); releases.push(() => app.dispose()); app.use(uiPlugin()); app.mount(source); expect(dialog.parentElement).toBe(document.body); source.remove(); await Promise.resolve(); await Promise.resolve(); expect(dialog.parentElement).toBe(source); expect(dialog.hasAttribute('role')).toBe(false); expect(document.body.style.overflow).not.toBe('hidden');
});
it('includes a generic portal branch in modal focus/inert leases', () => {
  const source = root('<h2 zen-dialog-title>Title</h2><div id="content"><button>Portaled</button></div><button>Local</button>'), target = root('<span>Unrelated</span>'), child = source.querySelector<HTMLElement>('#content')!, portal = createPortal(child, { target }); releases.push(portal);
  const dialog = createDialog(source); releases.push(dialog.dispose); dialog.open(); expect(child.closest('[aria-hidden="true"]')).toBeNull(); expect(target.querySelector('span')!.getAttribute('aria-hidden')).toBe('true'); expect(document.activeElement).toBe(source.querySelector('button'));
});
it('rolls back position and logical ancestry when a target append fails', () => {
  const source = root('<i>Before</i><aside>Content</aside><i>After</i>'), child = source.querySelector('aside')!, next = child.nextSibling, target = root();
  vi.spyOn(target, 'append').mockImplementation(() => { throw new Error('append failed'); }); expect(() => createPortal(child, { target })).toThrow('append failed'); expect(child.parentElement).toBe(source); expect(child.nextSibling).toBe(next); expect(floatingRoots(source)).toEqual([source]);
});
it('keeps generic portaled descendants inside a popover outside-click boundary', () => {
  const trigger = root('<button>Open</button>').querySelector('button')!, source = root('<div id="content"><button>Child</button></div>'), child = source.querySelector<HTMLElement>('#content')!;
  const surface = createPopover(source, { trigger }), portal = createPortal(child, { target: document.body }); releases.push(surface.dispose, portal); surface.open(); child.querySelector('button')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); expect(surface.state.peek()).toBe(true);
});

it('uses the saved sibling position if the source marker itself was removed', async () => {
  const source = root('<i>Before</i><aside>Content</aside><i>After</i>'), child = source.querySelector('aside')!, next = child.nextSibling, release = createPortal(child, { target: document.body }); releases.push(release);
  const marker = Array.from(source.childNodes).find(node => node.nodeType === Node.COMMENT_NODE)!; marker.parentNode!.removeChild(marker); await Promise.resolve(); expect(child.parentElement).toBe(source); expect(child.nextSibling).toBe(next);
});
it('keeps late releases from a source-removal lease from tearing down a newer portal', async () => {
  const source = root('<aside>Content</aside>'), child = source.querySelector('aside')!, old = createPortal(child, { target: document.body }); releases.push(old); source.remove(); await Promise.resolve(); document.body.append(source);
  const target = root(), current = createPortal(child, { target }); releases.push(current); old(); expect(child.parentElement).toBe(target); expect(floatingRoots(source)).toContain(child); current(); expect(child.parentElement).toBe(source);
});
