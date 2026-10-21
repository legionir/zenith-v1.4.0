import { randomUUID } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { generateHydrationScript, type StreamMetadata } from '@zenith/ssr';
import { createReservedError } from '@zenith/errors';

/** Parsed templates are exclusive to one request and never execute scripts. */
export function prepareTemplate(html: string, url: URL, nonce?: string) {
  const invalid = () => createReservedError('ZEN-1802');
  if (typeof html !== 'string') throw invalid();
  const dom = new JSDOM(html, { url: url.href });
  try {
    const doc = dom.window.document;
    const walker = doc.createTreeWalker(doc.body, dom.window.NodeFilter.SHOW_COMMENT);
    const outlets: Comment[] = []; let node: Node | null;
    while ((node = walker.nextNode())) if (node.nodeValue === 'zen-outlet') outlets.push(node as Comment);
    if (outlets.length !== 1) throw invalid();
    const outlet = outlets[0]!;
    // The marker identifies the mount container, not an instruction to throw
    // away the rest of the document. A bare body outlet gets its own root.
    let root = doc.getElementById('app') ?? outlet.parentElement;
    if (!root || root === doc.body) {
      root = doc.createElement('div'); root.id = 'app'; outlet.replaceWith(root);
    } else {
      if (!root.contains(outlet)) throw invalid();
      outlet.remove();
    }
    if (nonce) for (const element of doc.querySelectorAll('script,style')) element.setAttribute('nonce', nonce);
    const source = root.outerHTML;
    const token = `zenith-root-${randomUUID()}`;
    root.replaceWith(doc.createComment(token));
    const body = doc.body.innerHTML;
    const [prefix, suffix] = body.split(`<!--${token}-->`);
    if (prefix === undefined || suffix === undefined) throw invalid();
    const attrs = (element: Element) => Array.from(element.attributes).map(attr => ` ${attr.name}="${attr.value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"`).join('');
    const applyAttrs = (element: Element, values: string) => {
      const holder = doc.createElement('template'); holder.innerHTML = `<i${values}></i>`;
      for (const attr of Array.from(holder.content.firstElementChild?.attributes ?? [])) element.setAttribute(attr.name, attr.value);
    };
    const sameTag = (a: Element, b: Element): boolean => {
      if (a.tagName !== b.tagName) return false;
      const key = b.getAttribute('data-zen-head');
      if (key && a.getAttribute('data-zen-head') === key) return true;
      if (b.tagName === 'TITLE' || b.tagName === 'BASE') return true;
      if (b.tagName === 'META') return ['name', 'property', 'charset', 'http-equiv'].some(name => b.hasAttribute(name) && a.getAttribute(name) === b.getAttribute(name));
      return b.tagName === 'LINK' && a.getAttribute('rel') === b.getAttribute('rel') && a.getAttribute('href') === b.getAttribute('href');
    };
    const open = (result: StreamMetadata) => {
      const managed = doc.createElement('template'); managed.innerHTML = result.headTags ?? '';
      for (const element of Array.from(managed.content.children)) {
        for (const previous of Array.from(doc.head.children)) if (sameTag(previous, element)) previous.remove();
        doc.head.append(element);
      }
      applyAttrs(doc.documentElement, result.htmlAttrs ?? ''); applyAttrs(doc.body, result.bodyAttrs ?? '');
      return `<!DOCTYPE html><html${attrs(doc.documentElement)}><head>${doc.head.innerHTML}${generateHydrationScript({ ...result, html: '' }, nonce)}</head><body${attrs(doc.body)}>${prefix}`;
    };
    return { source, shell: { open, metadataOnly: true as const, close: `${suffix}</body></html>` }, dispose: () => dom.window.close() };
  } catch (error) { dom.window.close(); throw error; }
}
