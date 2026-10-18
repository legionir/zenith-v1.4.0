// @vitest-environment node
import { expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { sanitizeHTMLInDocument } from '../src';
import { XSS_CORPUS } from './xss-corpus.mjs';
it.each(XSS_CORPUS)('cleans $name in an explicit document without installing Node DOM globals', ({ html }) => {
  const globals = ['window', 'document', 'DOMParser', 'Node'].map(name => Reflect.get(globalThis, name)); const dom = new JSDOM();
  try {
    const clean = sanitizeHTMLInDocument(html, dom.window.document);
    expect(clean).not.toMatch(/<(?:script|iframe|object|embed|svg|math|template)\b|\son\w+\s*=|(?:java|vb)script\s*:/i);
    expect(['window', 'document', 'DOMParser', 'Node'].map(name => Reflect.get(globalThis, name))).toEqual(globals);
  } finally { dom.window.close(); }
});
it('does not let one document sanitize into or mutate another document', () => {
  const first = new JSDOM('<p id="owner">first</p>'), second = new JSDOM('<p id="owner">second</p>');
  try { expect(sanitizeHTMLInDocument('<b>safe</b><script>bad()</script>', first.window.document)).toBe('<b>safe</b>'); expect(second.window.document.body.textContent).toBe('second'); expect(first.window.document.body.textContent).toBe('first'); }
  finally { first.window.close(); second.window.close(); }
});
