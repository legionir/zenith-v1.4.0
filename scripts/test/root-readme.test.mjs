import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readmePath = join(ROOT, 'README.md');
const readme = existsSync(readmePath) ? readFileSync(readmePath, 'utf8') : '';

const pkgDirs = readdirSync(join(ROOT, 'packages')).filter((d) =>
  statSync(join(ROOT, 'packages', d)).isDirectory(),
);

describe('root README.md (issue #69)', () => {
  it('exists', () => {
    expect(existsSync(readmePath)).toBe(true);
  });

  it('introduces the framework with a runnable quickstart', () => {
    expect(readme).toMatch(/HTML-First/);
    expect(readme).toMatch(/Signal/);
    expect(readme).toMatch(/npm run build:browser/);
    expect(readme).toMatch(/Zen\.start\(/);
    expect(readme).toMatch(/<button zen-action="inc">/);
    expect(readme).toMatch(/Zen\.action\('inc'/);
  });

  it('lists all 41 package directories in the table', () => {
    expect(pkgDirs).toHaveLength(41); // #142: schema (40 → 41)
    for (const d of pkgDirs) {
      expect(readme, `table row for packages/${d}`).toContain(`(packages/${d})`);
    }
  });

  it('every package has a README (table links resolve)', () => {
    const missing = pkgDirs.filter((d) => !existsSync(join(ROOT, 'packages', d, 'README.md')));
    expect(missing, `packages without README: ${missing.join(', ')}`).toEqual([]);
  });

  it('links ARCHITECTURE, docs hub, SECURITY.md, MANUAL-STEPS and LICENSE', () => {
    expect(readme).toMatch(/\[ARCHITECTURE\.md\]\(ARCHITECTURE\.md\)/);
    expect(readme).toMatch(/\[docs\/README\.md\]\(docs\/README\.md\)/);
    expect(readme).toMatch(/\[SECURITY\.md\]\(SECURITY\.md\)/);
    expect(readme).toMatch(/\[docs\/MANUAL-STEPS\.md\]\(docs\/MANUAL-STEPS\.md\)/);
    expect(readme).toMatch(/\[MIT\]\(LICENSE\)/);
  });

  it('all relative markdown links resolve to existing files', () => {
    const linkRe = /\]\(([^)\s#]+)(?:#[^)]*)?\)/g;
    const broken = [];
    let m;
    while ((m = linkRe.exec(readme))) {
      const target = m[1];
      if (/^[a-z]+:\/\//.test(target) || target.startsWith('mailto:')) continue;
      if (!existsSync(join(ROOT, target))) broken.push(target);
    }
    expect(broken, `broken relative links: ${broken.join(', ')}`).toEqual([]);
  });

  it('quickstart signals use the real API (.get/.set, not callable)', () => {
    expect(readme).toMatch(/count\.get\(\)/);
    expect(readme).not.toMatch(/count\(\)/);
    // #187 fixed: quickstart uses computed directly (no signal+effect workaround)
    expect(readme).toMatch(/const double = computed\(\(\) => count\.get\(\) \* 2\);/);
  });
});
