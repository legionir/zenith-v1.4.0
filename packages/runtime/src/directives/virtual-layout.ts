/** Scroll ancestor discovery retains the existing document fallback. @internal */
export function findScrollContainer(startEl: HTMLElement | null): HTMLElement | null {
  let node: HTMLElement | null = startEl;
  while (node) {
    // Skip detached nodes — getComputedStyle returns all-'initial' for them
    // which would not match our scroll patterns, but the closest() guard
    // below also catches the case where node === document.documentElement.
    try {
      if (typeof getComputedStyle === 'function') {
        const style = getComputedStyle(node);
        const overflowY = style && style.overflowY;
        if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
          // Only treat as a real scroller if the element actually has a
          // bounded height (otherwise overflow-y has no effect). For the
          // <body> / <html> we accept unconditionally — they're the
          // document scroller.
          const isDocumentElement = node === document.documentElement || node === document.body;
          if (isDocumentElement) return node;
          const h = style.height;
          const mh = style.maxHeight;
          if ((h && h !== 'auto' && !h.endsWith('%')) || (mh && mh !== 'none')) {
            return node;
          }
        }
      }
    } catch {
      // getComputedStyle can throw on detached/pseudo elements in some
      // browsers — skip the node and continue up the chain.
    }
    node = node.parentElement;
  }
  // Fallback: the document's scrollingElement (usually <html>).
  if (typeof document !== 'undefined' && document.scrollingElement) {
    return document.scrollingElement as HTMLElement;
  }
  return null;
}

/** Virtual list scaffold dimensions are controlled by the caller. @internal */
export interface VirtualLayoutInput { parent: HTMLElement; isTableMode: boolean; }
/** Build table spacers or a generic wrapper in the original mutation order. @internal */
export function buildVirtualLayout(el: HTMLElement, input: VirtualLayoutInput): { topSpacer: HTMLElement; bottomSpacer: HTMLElement; contentContainer: HTMLElement } {
  const { parent, isTableMode } = input;
  let topSpacer: HTMLElement;
  let bottomSpacer: HTMLElement;
  let contentContainer: HTMLElement;

  if (isTableMode) {
    // Table mode: keep the original <tr> as the template for cloning.
    // Insert two spacer <tr> elements: one before, one after.
    topSpacer = document.createElement('tr');
    topSpacer.setAttribute('data-zenith-virtual-spacer', 'top');
    const topTd = document.createElement('td');
    topTd.style.padding = '0';
    topTd.style.border = '0';
    topSpacer.appendChild(topTd);

    bottomSpacer = document.createElement('tr');
    bottomSpacer.setAttribute('data-zenith-virtual-spacer', 'bottom');
    const bottomTd = document.createElement('td');
    bottomTd.style.padding = '0';
    bottomTd.style.border = '0';
    bottomSpacer.appendChild(bottomTd);

    parent.insertBefore(topSpacer, el);
    if (el.nextSibling) {
      parent.insertBefore(bottomSpacer, el.nextSibling);
    } else {
      parent.appendChild(bottomSpacer);
    }
    // The original <tr> itself becomes the content container — but we
    // remove it from the DOM since we'll re-create visible rows from its
    // template. We keep a deep clone as the template.
    contentContainer = el as HTMLElement;
    parent.removeChild(el);
  } else {
    // Generic mode: wrap the element inside a container with spacer divs.
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-zenith-virtual-wrapper', '');
    wrapper.style.position = 'relative';

    topSpacer = document.createElement('div');
    topSpacer.setAttribute('data-zenith-virtual-spacer', 'top');
    topSpacer.style.padding = '0';
    topSpacer.style.margin = '0';

    bottomSpacer = document.createElement('div');
    bottomSpacer.setAttribute('data-zenith-virtual-spacer', 'bottom');
    bottomSpacer.style.padding = '0';
    bottomSpacer.style.margin = '0';

    contentContainer = document.createElement('div');
    contentContainer.setAttribute('data-zenith-virtual-content', '');

    parent.replaceChild(wrapper, el);
    wrapper.appendChild(topSpacer);
    wrapper.appendChild(contentContainer);
    wrapper.appendChild(bottomSpacer);
  }

  return { topSpacer, bottomSpacer, contentContainer };
}
