// @vitest-environment jsdom
//
// #30 — corpus XSS/mXSS روی sanitizer در jsdom: هیچ payload شناخته‌شده‌ای
// نباید پس از sanitize به‌صورت executable در خروجی بماند (script tag،
// event handler attribute، javascript:/data: URL در attrهای URL‌بر،
// CSS expression()). اجرای واقعی در مرورگر توسط e2e/xss-corpus.spec.ts
// (Playwright + Chromium) شاهد می‌شود.
import { describe, it, expect } from 'vitest';
import { sanitizeHTML, sanitizeCSS, generateCSP } from '../src/index';
import { XSS_CORPUS, CSS_CORPUS } from './xss-corpus.mjs';

describe('sanitizeHTML: XSS/mXSS corpus (#30)', () => {
  it.each(XSS_CORPUS)('$name — no executable construct survives', ({ html }) => {
    const clean = sanitizeHTML(html);
    expect(clean).not.toMatch(/<script\b/i);
    expect(clean).not.toMatch(/\son\w+\s*=/i);
    expect(clean).not.toMatch(/javascript\s*:/i);
    expect(clean).not.toMatch(/vbscript\s*:/i);
    expect(clean).not.toMatch(/expression\s*\(/i);
    expect(clean).not.toMatch(/-moz-binding/i);
    expect(clean).not.toMatch(/behavior\s*:/i);
    expect(clean).not.toMatch(/@import/i);
    // مXSS مخزن‌ها باید حذف/تخت شده باشند
    expect(clean).not.toMatch(/<template\b/i);
    expect(clean).not.toMatch(/<svg\b/i);
    expect(clean).not.toMatch(/<math\b/i);
    expect(clean).not.toMatch(/<iframe\b/i);
    expect(clean).not.toMatch(/<object\b/i);
    expect(clean).not.toMatch(/<embed\b/i);
    expect(clean).not.toMatch(/<frameset\b/i);
    expect(clean).not.toMatch(/<base\b/i);
    expect(clean).not.toMatch(/<link\b/i);
    expect(clean).not.toMatch(/<meta\b/i);
    expect(clean).not.toMatch(/<style\b/i);
    expect(clean).not.toMatch(/<noscript\b/i);
  });

  it('benign content passes through', () => {
    const clean = sanitizeHTML('<p>Hello <b>world</b></p><a href="/ok">link</a>');
    expect(clean).toContain('Hello');
    expect(clean).toContain('<b>world</b>');
    expect(clean).toContain('href="/ok"');
  });
});

describe('sanitizeCSS + generateCSP (#30)', () => {
  it.each(CSS_CORPUS)('$name', ({ css, banned }) => {
    const clean = sanitizeCSS(css);
    if (banned) expect(clean).not.toMatch(banned);
    else expect(clean).toBe(css);
  });

  it('generateCSP has no unsafe-inline by default', () => {
    const csp = generateCSP();
    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).toContain("script-src 'self'");
  });

  it('generateCSP nonce and explicit opt-ins work', () => {
    const csp = generateCSP({ nonce: 'abc123', allowInlineStyle: true });
    expect(csp).toContain('nonce-abc123');
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
  });
});
