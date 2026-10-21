import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  loadManifest,
  auditDemos,
  relToRoot,
  rewriteForStage,
  stripEscapedSamples,
} from '../build-demos.mjs';

const ROOT = process.cwd();

describe('demos manifest and demo-site contract (#114)', () => {
  it('loads a well-formed manifest with unique slugs and on-disk paths', () => {
    const manifest = loadManifest(ROOT);
    expect(manifest.version).toBe(1);
    expect(manifest.demos.length).toBe(22);
    for (const entry of manifest.demos) {
      expect(existsSync(join(ROOT, entry.path)), entry.path).toBe(true);
    }
  });

  it('covers every demos/* directory exactly once', () => {
    const manifest = loadManifest(ROOT);
    const slugs = new Set(
      manifest.demos.filter((d) => d.path.startsWith('demos/')).map((d) => d.slug),
    );
    expect(slugs.size).toBe(20);
    for (const slug of slugs) {
      expect(existsSync(join(ROOT, 'demos', slug, 'index.html'))).toBe(true);
    }
  });

  it('matches every demos/index.html card to the manifest (no orphans either way)', () => {
    const manifest = loadManifest(ROOT);
    const cardsHtml = readFileSync(join(ROOT, manifest.index), 'utf8');
    const cards = [...cardsHtml.matchAll(/href="([a-z0-9-]+)\/index\.html"/g)].map((m) => m[1]);
    const manifestSlugs = manifest.demos.filter((d) => d.path.startsWith('demos/')).map((d) => d.slug);
    expect([...cards].sort()).toEqual([...manifestSlugs].sort());
  });

  it('passes the source-only audit (importmaps resolve to workspace dist, no stray absolutes)', () => {
    const { failures, references } = auditDemos(ROOT);
    expect(failures).toEqual([]);
    // every demo wires at least one workspace package; integration wires many.
    expect(references.length).toBeGreaterThan(20);
    expect(references.every((r) => /^packages\/[^/]+\/dist\/.+/.test(r))).toBe(true);
  });

  it('links every root-homage demo card to a manifest path', () => {
    const manifest = loadManifest(ROOT);
    const home = readFileSync(join(ROOT, manifest.home), 'utf8');
    const links = [...home.matchAll(/href="(demos\/[a-z0-9-]+\/index\.html)"/g)].map((m) => m[1]);
    const manifestPaths = new Set(manifest.demos.map((d) => d.path));
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(manifestPaths.has(link), link).toBe(true);
  });

  it('computes stage-relative prefixes by file depth', () => {
    expect(relToRoot('index.html')).toBe('');
    expect(relToRoot('demos/index.html')).toBe('../');
    expect(relToRoot('demos/auth/index.html')).toBe('../../');
    expect(relToRoot('packages/state/dist/index.js')).toBe('../../');
  });

  it('relativizes root-absolute refs and leaves router/API/escaped samples alone', () => {
    const deep = rewriteForStage(
      '<script type="importmap">{"imports":{"@zenith/a":"/packages/a/dist/index.js"}}</script>' +
        '<script src="/dashboard/src/main.js"></script>' +
        '<a href="/index.html">x</a><a href="/demos/">y</a>' +
        '<zen-route path="/about" src="/demos/router/pages/about.html"></zen-route>',
      'demos/router/index.html',
    );
    expect(deep).toContain('"../../packages/a/dist/index.js"');
    expect(deep).toContain('src="../../dashboard/src/main.js"');
    expect(deep).toContain('href="../../index.html"');
    expect(deep).toContain('href="../../demos/"');
    expect(deep).toContain('src="../../demos/router/pages/about.html"');
    // route semantics and API contracts are not URLs and stay put.
    expect(deep).toContain('path="/about"');
    const shallow = rewriteForStage(
      '<a href="/index.html">x</a><script>fetch("/api/items")</script>',
      'index.html',
    );
    expect(shallow).toContain('href="index.html"');
    expect(shallow).toContain('fetch("/api/items")');
    expect(stripEscapedSamples('&lt;zen-route src="/pages/x.html"&gt;')).not.toContain('src="/');
  });
});
