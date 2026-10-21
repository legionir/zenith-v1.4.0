// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { inertFallback } from '../src/inert-fallback';
const releases: Array<() => void> = [];
function root(html = '') { const el = document.createElement('section'); el.innerHTML = html; document.body.append(el); return el; }
afterEach(() => { for (const release of releases.splice(0).reverse()) release(); document.body.replaceChildren(); });
it('masks tab stops and restores exact authored values, including the root itself', () => {
  const el = root('<button tabindex="3">A</button><a href="/">B</a>'); el.tabIndex = 2; const before = el.outerHTML; const release = inertFallback(el); releases.push(release); expect(el.tabIndex).toBe(-1); expect(el.querySelector('button')!.tabIndex).toBe(-1); expect(el.querySelector('a')!.tabIndex).toBe(-1); release(); release(); expect(el.outerHTML).toBe(before);
});
it('counts overlapping fallback leases instead of reviving descendants too early', () => {
  const el = root('<section><button tabindex="4">A</button></section>'), child = el.querySelector('section')!, button = child.querySelector('button')!; const a = inertFallback(el), b = inertFallback(child); releases.push(a, b); a(); expect(button.tabIndex).toBe(-1); b(); expect(button.getAttribute('tabindex')).toBe('4');
});
it('masks inserted tab stops and releases a moved descendant without retaining its old scope', async () => {
  const el = root(), next = root(), release = inertFallback(el); releases.push(release); const button = document.createElement('button'); el.append(button); await Promise.resolve(); expect(button.tabIndex).toBe(-1); next.append(button); await Promise.resolve(); expect(button.hasAttribute('tabindex')).toBe(false); release(); expect(button.hasAttribute('tabindex')).toBe(false);
});
it('does not overwrite a new overlapping owner when a masked descendant moves', async () => {
  const a = root('<button tabindex="2">A</button>'), b = root(), button = a.querySelector('button')!, first = inertFallback(a); releases.push(first); b.append(button); const second = inertFallback(b); releases.push(second); await Promise.resolve(); expect(button.tabIndex).toBe(-1); second(); expect(button.getAttribute('tabindex')).toBe('2');
});
