import type { DisposeFn, Hydrator } from './hydration-types';
import { buildContext } from './hydration-context';
import { hydrateText, hydrateHtmlTrusted, hydrateHtml, hydrateShow, hydrateIf, hydrateModel, hydrateBind } from './hydration-values';

/** Existing root-level hydration and SSR marker behavior. @public */
export function createHydrator(root: HTMLElement, state: Record<string, unknown>): Hydrator {
  const disposes: DisposeFn[] = [];
  return {
    root,
    state,
    context: () => buildContext(state),
    hydrateAll(): DisposeFn {
      const ctx = buildContext(state);
      // Walk all descendant elements and hydrate each known directive.
      const elements =
        typeof root.querySelectorAll === 'function'
          ? (Array.from(root.querySelectorAll('*')) as HTMLElement[])
          : [];
      for (const el of elements) {
        if (el.hasAttribute('zen-text')) {
          disposes.push(hydrateText(el, el.getAttribute('zen-text')!, ctx));
        } else if (el.hasAttribute('zen-html-trusted')) {
          disposes.push(hydrateHtmlTrusted(el, el.getAttribute('zen-html-trusted')!, ctx));
        } else if (el.hasAttribute('zen-html')) {
          disposes.push(hydrateHtml(el, el.getAttribute('zen-html')!, ctx));
        }
        if (el.hasAttribute('zen-show')) {
          disposes.push(hydrateShow(el, el.getAttribute('zen-show')!, ctx));
        }
        if (el.hasAttribute('zen-if')) {
          disposes.push(hydrateIf(el, el.getAttribute('zen-if')!, ctx));
        }
        if (el.hasAttribute('zen-model')) {
          disposes.push(hydrateModel(el, el.getAttribute('zen-model')!, ctx, state));
        }
        for (const attr of Array.from(el.attributes)) {
          if (attr.name.startsWith('zen-bind:')) {
            const attrName = attr.name.slice('zen-bind:'.length);
            disposes.push(hydrateBind(el, attrName, attr.value, ctx));
          }
        }
      }
      return () => {
        for (const d of disposes) {
          try {
            d();
          } catch {
            /* noop */
          }
        }
        disposes.length = 0;
      };
    },
    dispose(): void {
      for (const d of disposes) {
        try {
          d();
        } catch {
          /* noop */
        }
      }
      disposes.length = 0;
    },
  };
}

/** Existing root-level hydration and SSR marker behavior. @public */
export function hasHydrationMarkers(root: HTMLElement): boolean {
  if (typeof document === 'undefined' || typeof root.querySelectorAll !== 'function') {
    return false;
  }
  // SSR markers are emitted as HTML comments; we use a TreeWalker to find
  // any comment whose data starts with `zenith-ssr:`.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  let node: Node | null;
  while ((node = walker.nextNode()) !== null) {
    const data = (node as Comment).data || '';
    if (data.trim().startsWith('zenith-ssr:')) return true;
  }
  return false;
}

/** Existing root-level hydration and SSR marker behavior. @public */
export function countHydrationMarkers(root: HTMLElement): number {
  if (typeof document === 'undefined' || typeof root.querySelectorAll !== 'function') {
    return 0;
  }
  let count = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  let node: Node | null;
  while ((node = walker.nextNode()) !== null) {
    const data = (node as Comment).data || '';
    if (data.trim().startsWith('zenith-ssr:')) count++;
  }
  return count;
}
