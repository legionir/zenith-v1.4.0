import { afterEach, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { serializeDOMChunks } from '../src/dom-stream';
const documents: JSDOM[] = [];
function root(html: string) { const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`); documents.push(dom); return dom.window.document.body.firstElementChild!; }
afterEach(() => { for (const dom of documents.splice(0)) dom.window.close(); });
it.each([1, 2, 7, 64, 16384])('matches native HTML serialization at chunk size %s', size => {
  const element = root('<main data-title="&quot;&amp;&nbsp;&lt;&gt;"><!--note--><p>&lt;&gt;&amp;&nbsp;🚀</p><br><input disabled value="&quot;"><textarea>\n&lt;b&gt;&amp;</textarea><pre>\nline</pre><script>const raw = "<&>🚀";</script><style>i::after{content:"<&>"}</style><template><b>&amp;🚀</b><template>nested</template></template><svg viewBox="0 0 10 10"><title>A&amp;B</title><foreignObject><p>HTML</p></foreignObject><use xlink:href="#x"></use></svg><math><mi>x</mi></math><noscript><b>fallback</b></noscript></main>');
  const chunks = [...serializeDOMChunks(element, size)]; expect(chunks.join('')).toBe(element.outerHTML); expect(chunks.every(chunk => chunk.length <= size + 1)).toBe(true); expect(Buffer.concat(chunks.map(chunk => Buffer.from(chunk))).toString('utf8')).toBe(element.outerHTML);
});
it('does not serialize the full root or use recursive calls for deeply nested trees', () => {
  const element = root('<main></main>'); let parent = element; for (let i = 0; i < 3000; i++) { const next = element.ownerDocument.createElement('div'); parent.append(next); parent = next; } parent.textContent = 'deep';
  Object.defineProperty(element, 'outerHTML', { configurable: true, get() { throw new Error('whole-root serialization'); } }); const chunks = [...serializeDOMChunks(element, 32)]; expect(chunks.every(chunk => chunk.length <= 32)).toBe(true); expect(chunks.join('')).toContain('deep'); expect(chunks.join('').match(/<div>/g)).toHaveLength(3000);
});
it('retains a pair split across adjacent Text nodes when encoding chunks independently', () => {
  const element = root('<main></main>'), doc = element.ownerDocument; element.append(doc.createTextNode('\uD83D'), doc.createTextNode('\uDE80'), doc.createTextNode('\uD83D'), doc.createTextNode('\uD83D'), doc.createTextNode('x'), doc.createTextNode('\uD83D'), doc.createTextNode('🚀'));
  const expected = Buffer.from(element.outerHTML).toString('utf8'); const chunks = [...serializeDOMChunks(element, 1)]; expect(Buffer.concat(chunks.map(chunk => Buffer.from(chunk))).toString('utf8')).toBe(expected); expect(chunks.every(chunk => chunk.length <= 2)).toBe(true);
});
it('serializes namespace-qualified attributes like the native HTML serializer', () => {
  const element = root('<main><svg><use></use></svg></main>'), use = element.querySelector('use')!; use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#a'); use.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'lang', 'fa'); expect([...serializeDOMChunks(element, 3)].join('')).toBe(element.outerHTML);
});
it('does not visit later text before the bounded chunk is requested and checks cancellation while walking', () => {
  const element = root('<main><p>early</p><p>later</p></main>'), last = element.lastElementChild!.firstChild!; let reads = 0, aborted = false; const original = last.nodeValue;
  Object.defineProperty(last, 'nodeValue', { get() { reads++; return original; } }); const chunks = serializeDOMChunks(element, 1, () => { if (aborted) throw new Error('cancelled'); }); expect(chunks.next().value).toBe('<'); expect(reads).toBe(0); aborted = true; expect(() => chunks.next()).toThrow('cancelled'); expect(reads).toBe(0);
});
