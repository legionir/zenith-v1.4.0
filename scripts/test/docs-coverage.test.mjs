import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildApiSurfaceSnapshot } from '../generate-api-docs.mjs';
import { auditDocLinks } from '../check-doc-links.mjs';

const ROOT = process.cwd();

/** پکیج‌های انتشارپذیر: package.json بدون private + ورودی src. */
function publishablePackages(root = ROOT) {
  const dir = join(root, 'packages');
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('tmp-'))
    .map((d) => d.name)
    .filter(
      (slug) =>
        existsSync(join(dir, slug, 'package.json')) &&
        existsSync(join(dir, slug, 'src', 'index.ts')) &&
        JSON.parse(readFileSync(join(dir, slug, 'package.json'), 'utf8')).private !== true,
    )
    .map((slug) => ({
      slug,
      name: JSON.parse(readFileSync(join(dir, slug, 'package.json'), 'utf8')).name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

describe('typedoc reference + API inventory coverage (#103)', () => {
  it('covers every publishable package in the generated surface', () => {
    const surface = buildApiSurfaceSnapshot(ROOT);
    for (const { name } of publishablePackages(ROOT)) {
      expect(surface[name], name).toBeDefined();
    }
  });

  it('committed INDEX.md count is dynamic and matches its own table', () => {
    const text = readFileSync(join(ROOT, 'docs', 'api', 'INDEX.md'), 'utf8');
    const headerCount = Number(/(\d+) پکیج/.exec(text)?.[1]);
    const [packagesTable] = text.split('## زیرمسیرهای عمومی');
    const rows = [...packagesTable.matchAll(/^\| `([^`]+)` \|/gm)].map((m) => m[1]);
    expect(headerCount).toBeGreaterThan(0);
    expect(headerCount).toBe(rows.length);
  });

  it('committed INDEX.md covers the full surface and every row links a committed page', () => {
    const surface = buildApiSurfaceSnapshot(ROOT);
    const text = readFileSync(join(ROOT, 'docs', 'api', 'INDEX.md'), 'utf8');
    const links = [...text.matchAll(/\[([^\]]+\.md)\]\(\.\/([^)]+)\)/g)].map((m) => m[2]);
    for (const [key, info] of Object.entries(surface)) {
      if (info.subpath) continue;
      expect(text.includes(`\`${key}\``), key).toBe(true);
    }
    expect(links.length).toBeGreaterThan(0);
    for (const file of links) {
      expect(existsSync(join(ROOT, 'docs', 'api', file)), file).toBe(true);
    }
  });

  it('generator writes a dynamic package count (no hardcoded ۴۳)', () => {
    const gen = readFileSync(join(ROOT, 'scripts', 'generate-api-docs.mjs'), 'utf8');
    expect(gen).not.toMatch(/تمام \d+ پکیج/);
  });

  it('typedoc wiring is committed (config, script, dep, gitignore, workflow)', () => {
    const typedoc = JSON.parse(readFileSync(join(ROOT, 'typedoc.json'), 'utf8'));
    expect(typedoc.out).toBe('docs-site/api');
    expect(typedoc.entryPoints.some((e) => e.includes('packages/'))).toBe(true);
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.scripts['docs:reference']).toBeDefined();
    expect(pkg.scripts['check:doc-links']).toBeDefined();
    expect(pkg.devDependencies.typedoc).toBeDefined();
    const ignore = readFileSync(join(ROOT, '.gitignore'), 'utf8');
    expect(ignore).toMatch(/^docs-site\/$/m);
    const workflow = readFileSync(
      join(ROOT, '.github', 'workflows', 'docs-pages.yml'),
      'utf8',
    );
    expect(workflow).toContain('deploy-pages');
    expect(workflow).toMatch(/docs:reference|typedoc/);
  });

  it('root README and docs/README link the API inventory entry point', () => {
    expect(readFileSync(join(ROOT, 'README.md'), 'utf8')).toContain('docs/api/INDEX.md');
    expect(readFileSync(join(ROOT, 'docs', 'README.md'), 'utf8')).toContain('api/INDEX.md');
  });

  it('passes the API link-integrity audit (source-only)', () => {
    const { problems, checked } = auditDocLinks(ROOT);
    expect(problems).toEqual([]);
    expect(checked).toBeGreaterThan(0);
  });
});
