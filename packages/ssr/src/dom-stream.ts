/** Internal HTML serializer: bounded output chunks, no full root.outerHTML copy. */
const HTML = 'http://www.w3.org/1999/xhtml';
const VOID = new Set(['area', 'base', 'basefont', 'bgsound', 'link', 'meta', 'br', 'col', 'embed', 'hr', 'img', 'input', 'keygen', 'param', 'source', 'track', 'wbr']);
const RAW = new Set(['style', 'script', 'xmp', 'iframe', 'noembed', 'noframes', 'plaintext']);
function endAt(value: string, offset: number, size: number): number {
  let end = Math.min(value.length, offset + size);
  if (end < value.length && /[\uD800-\uDBFF]/.test(value[end - 1]!) && /[\uDC00-\uDFFF]/.test(value[end]!)) end++;
  return end;
}
function* escaped(value: string, size: number, attribute = false): Generator<string> {
  for (let offset = 0; offset < value.length;) {
    const end = endAt(value, offset, size), text = value.slice(offset, end).replace(/&/g, '&amp;').replace(/\u00a0/g, '&nbsp;');
    yield attribute ? text.replace(/"/g, '&quot;') : text.replace(/</g, '&lt;').replace(/>/g, '&gt;'); offset = end;
  }
}
interface Frame { node: Node; opened: boolean; child: Node | null; tag?: string; }
/** Walk iteratively: stack storage scales with nesting depth, not sibling count. */
function* tokens(root: Node, size: number, check: () => void): Generator<string> {
  const stack: Frame[] = [{ node: root, opened: false, child: null }];
  while (stack.length) {
    check(); const frame = stack[stack.length - 1]!, node = frame.node;
    if (!frame.opened) {
      frame.opened = true;
      if (node.nodeType === 1) {
        const element = node as Element, html = element.namespaceURI === HTML;
        const tag = html || element.namespaceURI === 'http://www.w3.org/2000/svg' || element.namespaceURI === 'http://www.w3.org/1998/Math/MathML' ? element.localName : element.tagName;
        // Native noscript serialization depends on the DOM implementation's
        // scripting flag, which has no portable public accessor. Preserve it.
        if (html && tag === 'noscript') { yield element.outerHTML; stack.pop(); continue; }
        yield `<${tag}`;
        for (const attribute of Array.from(element.attributes)) {
          const ns = attribute.namespaceURI, local = attribute.localName;
          const name = ns === 'http://www.w3.org/XML/1998/namespace' ? `xml:${local}` : ns === 'http://www.w3.org/1999/xlink' ? `xlink:${local}` : ns === 'http://www.w3.org/2000/xmlns/' ? local === 'xmlns' ? 'xmlns' : `xmlns:${local}` : attribute.name;
          check(); yield ` ${name}="`; yield* escaped(attribute.value, size, true); yield '"';
        }
        yield '>';
        if (html && VOID.has(tag)) { stack.pop(); continue; }
        frame.tag = tag;
        frame.child = html && tag === 'template' ? (element as HTMLTemplateElement).content.firstChild : element.firstChild;
      } else if (node.nodeType === 3 || node.nodeType === 4) {
        const parent = node.parentElement;
        if (parent?.namespaceURI === HTML && RAW.has(parent.localName)) yield node.nodeValue ?? '';
        else yield* escaped(node.nodeValue ?? '', size);
        stack.pop(); continue;
      } else if (node.nodeType === 8) {
        yield '<!--'; yield node.nodeValue ?? ''; yield '-->'; stack.pop(); continue;
      } else if (node.nodeType === 7) {
        const instruction = node as ProcessingInstruction; yield `<?${instruction.target} ${instruction.data}>`; stack.pop(); continue;
      } else if (node.nodeType === 10) {
        yield `<!DOCTYPE ${(node as DocumentType).name}>`; stack.pop(); continue;
      } else frame.child = node.firstChild;
    }
    if (frame.child) { const child = frame.child; frame.child = child.nextSibling; stack.push({ node: child, opened: false, child: null }); }
    else { if (frame.tag) yield `</${frame.tag}>`; stack.pop(); }
  }
}
/** UTF-16 chunk boundaries keep pairs intact for independent UTF-8 encoding. */
export function* serializeDOMChunks(root: Element, size = 16384, check: () => void = () => {}): Generator<string> {
  const limit = Number.isFinite(size) && size > 0 ? Math.max(1, Math.floor(size)) : 16384;
  // Custom XML DOMs retain their native serialization contract. HTML SSR uses
  // the incremental walker; no DOM globals or constructor identities are read.
  const xml = root.ownerDocument.contentType && root.ownerDocument.contentType !== 'text/html';
  const parts = xml ? [root.outerHTML] : tokens(root, limit, check);
  let buffer = '';
  for (const part of parts) {
    check();
    if (buffer && part && /[\uD800-\uDBFF]/.test(buffer[buffer.length - 1]!) && !/[\uDC00-\uDFFF]/.test(part[0]!)) {
      // The deferred high surrogate is unpaired; emit it before accepting a
      // new pair, otherwise size=1 could combine three code units in one chunk.
      yield buffer; buffer = '';
    }
    for (let offset = 0; offset < part.length;) {
      const end = endAt(part, offset, Math.max(1, limit - buffer.length)); buffer += part.slice(offset, end); offset = end;
      if (buffer.length >= limit) {
        // A pair may span two adjacent Text nodes or token pieces. Retain a
        // trailing high surrogate until the next piece establishes its mate.
        const high = /[\uD800-\uDBFF]/.test(buffer[buffer.length - 1]!);
        const output = high ? buffer.slice(0, -1) : buffer;
        if (output) { check(); yield output; buffer = high ? buffer.slice(-1) : ''; }
      }
    }
  }
  if (buffer) { check(); yield buffer; }
}
