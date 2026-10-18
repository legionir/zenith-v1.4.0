/** Internal shared document leases; no manager can destroy another manager's tags. */
export interface HeadDOMTag { key: string; tag: string; attrs: Record<string, string>; text?: string; }
interface Projection { tags: readonly HeadDOMTag[]; html: Record<string, string>; body: Record<string, string>; }
interface Snapshot { attrs: Array<[string, string]>; children: Node[]; }
interface Slot { node: HTMLElement; original?: Snapshot; mounted: boolean; }
interface DocumentOwner { owners: Set<Projection>; slots: Map<string, Slot>; attrs: Map<Element, Map<string, string | null>>; revision: number; }
const documents = new WeakMap<Document, DocumentOwner>();
function fail(errors: unknown[]) {
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, 'Head DOM ownership writes failed.');
}
function writeAttrs(node: Element, attrs: Record<string, string>, current: () => boolean) {
  const errors: unknown[] = [];
  for (const attr of Array.from(node.attributes)) {
    if (!current()) return;
    try { if (!(attr.name in attrs)) node.removeAttribute(attr.name); } catch (error) { errors.push(error); }
  }
  for (const [name, value] of Object.entries(attrs)) {
    if (!current()) return;
    try { if (node.getAttribute(name) !== value) node.setAttribute(name, value); } catch (error) { errors.push(error); }
  }
  fail(errors);
}
function commit(doc: Document, state: DocumentOwner) {
  const errors: unknown[] = [];
  const attempt = (run: () => void) => { try { run(); } catch (error) { errors.push(error); } };
  const revision = ++state.revision, current = () => state.revision === revision;
  const tags = new Map<string, HeadDOMTag>(), html: Record<string, string> = Object.create(null), body: Record<string, string> = Object.create(null);
  for (const owner of state.owners) { for (const tag of owner.tags) tags.set(tag.key, tag); Object.assign(html, owner.html); Object.assign(body, owner.body); }
  for (const [key, slot] of state.slots) {
    if (!current()) return;
    if (tags.has(key)) continue;
    const failures = errors.length;
    if (slot.node.parentNode === doc.head) {
      const original = slot.original;
      if (original) { attempt(() => writeAttrs(slot.node, Object.fromEntries(original.attrs), current)); if (current()) attempt(() => slot.node.replaceChildren(...original.children)); }
      else attempt(() => slot.node.remove());
    }
    if (current() && errors.length === failures && state.slots.get(key) === slot) state.slots.delete(key);
  }
  for (const tag of tags.values()) {
    if (!current()) return;
    let slot = state.slots.get(tag.key);
    if (!slot) {
      const marked = Array.from(doc.head.querySelectorAll<HTMLElement>('[data-zen-head]')).find(node => node.getAttribute('data-zen-head') === tag.key && node.localName === tag.tag);
      const singleton = tag.tag === 'title' || tag.tag === 'base' ? doc.head.querySelector<HTMLElement>(`${tag.tag}:not([data-zen-head])`) : null;
      const borrowed = marked ?? singleton;
      const node = borrowed ?? doc.createElement(tag.tag);
      slot = { node, mounted: !!borrowed, original: borrowed ? { attrs: Array.from(node.attributes, attr => [attr.name, attr.value]), children: Array.from(node.childNodes) } : undefined };
      state.slots.set(tag.key, slot);
    }
    // An outside owner moved/removed this node. Do not reclaim its DOM position.
    if (slot.mounted && slot.node.parentNode !== doc.head) continue;
    const node = slot.node;
    attempt(() => writeAttrs(node, { ...tag.attrs, 'data-zen-head': tag.key }, current));
    if (!current()) return;
    const text = tag.text; if (text !== undefined && node.textContent !== text) attempt(() => { node.textContent = text; });
    if (!current()) return;
    // Attributes (notably nonce) are authorized before connecting a new node.
    if (!slot.mounted) {
      attempt(() => doc.head.append(node));
      if (current()) slot.mounted = node.parentNode === doc.head;
      else if (state.slots.get(tag.key) !== slot && !slot.original && slot.node.parentNode === doc.head) slot.node.remove();
    }
  }
  for (const [element, values] of [[doc.documentElement, html], [doc.body, body]] as const) {
    if (!current()) return;
    if (!element) continue;
    let originals = state.attrs.get(element);
    if (!originals) { originals = new Map(); state.attrs.set(element, originals); }
    for (const [name, original] of originals) {
      if (!current()) return;
      if (name in values) continue;
      const failures = errors.length;
      attempt(() => { if (original === null) element.removeAttribute(name); else element.setAttribute(name, original); });
      if (current() && errors.length === failures) originals.delete(name);
    }
    for (const [name, value] of Object.entries(values)) {
      if (!current()) return;
      if (!originals.has(name)) originals.set(name, element.getAttribute(name));
      attempt(() => { if (element.getAttribute(name) !== value) element.setAttribute(name, value); });
    }
    if (!originals.size) state.attrs.delete(element);
  }
  fail(errors);
}
export function createHeadDOMOwner(doc: Document) {
  let state = documents.get(doc);
  if (!state) { state = { owners: new Set(), slots: new Map(), attrs: new Map(), revision: 0 }; documents.set(doc, state); }
  const owned = state, value: Projection = { tags: [], html: {}, body: {} }; let disposed = false;
  owned.owners.add(value);
  return {
    update(tags: readonly HeadDOMTag[], html: Record<string, string>, body: Record<string, string>) {
      if (disposed) return;
      const before = { ...value }; Object.assign(value, { tags, html, body });
      try { commit(doc, owned); }
      catch (error) { Object.assign(value, before); try { commit(doc, owned); } catch { /* Keep the primary write failure. */ } throw error; }
    },
    dispose() {
      if (disposed) return; disposed = true; owned.owners.delete(value);
      commit(doc, owned);
    },
  };
}
