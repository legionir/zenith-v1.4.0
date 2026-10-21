import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const EXT = join(ROOT, 'tools', 'devtools-extension');
const WEBVIEW_SRC = join(ROOT, 'tools', 'vscode-extension', 'src', 'webview.ts');

const PAGES = ['popup.html', 'devtools.html', 'graph-viewer.html'];

function metaCsp(html) {
  const m = /<meta[^>]*http-equiv="Content-Security-Policy"[^>]*content="([^"]+)"[^>]*>/i.exec(html);
  return m ? m[1] : null;
}

describe('extension strict CSP without unsafe-inline (#67)', () => {
  it('ships zero unsafe-inline in the manifest policy and every page policy', () => {
    const manifest = JSON.parse(readFileSync(join(EXT, 'manifest.json'), 'utf8'));
    const policy = manifest.content_security_policy.extension_pages;
    expect(policy).toContain("style-src 'self'");
    expect(policy).not.toContain('unsafe-inline');
    for (const page of PAGES) {
      const html = readFileSync(join(EXT, page), 'utf8');
      const csp = metaCsp(html);
      expect(csp, page).not.toBeNull();
      expect(csp).not.toContain('unsafe-inline');
      // the page meta carries exactly the manifest policy (manifest appends
      // frame-ancestors, which <meta> cannot express).
      expect(csp, page).toBe(policy.replace(/; frame-ancestors 'none'$/, ''));
    }
  });

  it('has no inline style surface in any extension page', () => {
    for (const page of PAGES) {
      const html = readFileSync(join(EXT, page), 'utf8');
      expect(html, page).not.toContain('<style');
      expect(html, page).not.toMatch(/\sstyle=/);
    }
    // stylesheets arrive only as same-package <link> targets that exist.
    for (const [page, sheet] of [['popup.html', 'popup.css'], ['graph-viewer.html', 'graph-viewer.css']]) {
      const html = readFileSync(join(EXT, page), 'utf8');
      expect(html).toContain(`<link rel="stylesheet" href="${sheet}" />`);
      expect(existsSync(join(EXT, sheet)), sheet).toBe(true);
    }
  });

  it('has no inline script surface in any extension page', () => {
    for (const page of PAGES) {
      const html = readFileSync(join(EXT, page), 'utf8');
      for (const m of html.matchAll(/<script\b([^>]*)>/gi)) {
        expect(m[1], `${page}: ${m[0]}`).toMatch(/\bsrc=/);
      }
      expect(html, page).not.toMatch(/\son(click|load|error|input|change|submit|focus|blur|mouseover|message)=/i);
      // every page boots through the shared message validator.
      expect(html, page).toContain('<script src="message-schema.js">');
    }
  });

  it('keeps dangerous sinks out of extension scripts', () => {
    const jsFiles = readdirSync(EXT).filter((f) => f.endsWith('.js'));
    expect(jsFiles.length).toBeGreaterThan(0);
    for (const file of jsFiles) {
      const src = readFileSync(join(EXT, file), 'utf8');
      for (const sink of ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'eval(', 'new Function(']) {
        expect(src, `${file}: ${sink}`).not.toContain(sink);
      }
      expect(src, file).not.toMatch(/set(Timeout|Interval)\(\s*['"]/);
    }
  });

  it('keeps the VS Code webview free of unsafe-inline too', () => {
    const src = readFileSync(WEBVIEW_SRC, 'utf8');
    expect(src).not.toContain("'unsafe-inline'");
    expect(src).toContain('<style nonce="${config.nonce}">');
    expect(src).not.toMatch(/style="[^"]*"/);
  });
});
