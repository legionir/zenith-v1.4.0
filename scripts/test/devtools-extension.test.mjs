// Tests for tools/devtools-extension manifest & CSP (#8)
// Covers BUG-DEVTEXT-01, BUG-DEVTEXT-02, BUG-DEVTEXT-03, BUG-DEVTEXT-05,
// BUG-DEVTEXT-06, BUG-DEVTEXT-07, BUG-DEVTEXT-08, IMP-DEVTEXT-01, IMP-DEVTEXT-05,
// BUG-DEV-04, BUG-DEV-07
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const EXT_DIR = join(process.cwd(), 'tools', 'devtools-extension');

describe('devtools-extension manifest & CSP (#8)', () => {
  it('manifest.json is valid strict JSON without comments and uses MV3', () => {
    const raw = readFileSync(join(EXT_DIR, 'manifest.json'), 'utf8');
    expect(raw).not.toMatch(/^\s*\/\//m);
    const manifest = JSON.parse(raw);
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe('Zenith DevTools');
  });

  it('does not request blanket host_permissions on install and uses activeTab + optional_host_permissions', () => {
    const manifest = JSON.parse(readFileSync(join(EXT_DIR, 'manifest.json'), 'utf8'));
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.permissions).toContain('activeTab');
    expect(manifest.optional_host_permissions).toEqual(['http://*/*', 'https://*/*']);
    expect(manifest.content_security_policy?.extension_pages).toContain("script-src 'self'");
    expect(manifest.content_security_policy?.extension_pages).toContain("object-src 'none'");
  });

  it('all extension HTML pages enforce CSP and contain no inline <script> blocks', () => {
    for (const page of ['devtools.html', 'popup.html', 'graph-viewer.html']) {
      const html = readFileSync(join(EXT_DIR, page), 'utf8');
      expect(html, `${page} CSP meta`).toContain('http-equiv="Content-Security-Policy"');
      expect(html, `${page} script-src 'self'`).toContain("script-src 'self'");
      // Every <script> tag must have a src="..." attribute (no inline JS)
      const scripts = html.match(/<script\b[^>]*>/gi) ?? [];
      expect(scripts.length, `${page} has external script`).toBeGreaterThan(0);
      for (const tag of scripts) {
        expect(tag, `${page} script tag must be external`).toMatch(/\bsrc="[^"]+"/);
      }
    }
    expect(existsSync(join(EXT_DIR, 'graph-viewer.js'))).toBe(true);
  });
});
