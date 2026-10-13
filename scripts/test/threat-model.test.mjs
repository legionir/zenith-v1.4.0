import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Security threat model documentation (#60)', () => {
  const root = process.cwd();
  const threatModelPath = join(root, 'docs/security/threat-model.md');

  it('covers all 6 attack surfaces, STRIDE categories, and accepted risks', () => {
    expect(existsSync(threatModelPath)).toBe(true);
    const content = readFileSync(threatModelPath, 'utf8');

    expect(content).toContain('STRIDE');
    expect(content).toContain('@zenith/expressions');
    expect(content).toContain('@zenith/security');
    expect(content).toContain('zen-html-trusted');
    expect(content).toContain('@zenith/ssr');
    expect(content).toContain('@zenith/auth');
    expect(content).toContain('@zenith/service-worker');
    expect(content).toContain('devtools-extension');
    expect(content).toContain('Accepted Risks');
  });

  it('links to existing source and test files across the repository', () => {
    const content = readFileSync(threatModelPath, 'utf8');
    const relLinks = [...content.matchAll(/\]\(\.\.\/\.\.\/([^)]+)\)/g)].map((m) => m[1]);
    expect(relLinks.length).toBeGreaterThanOrEqual(12);
    for (const rel of relLinks) {
      expect(existsSync(join(root, rel)), `Missing linked file: ${rel}`).toBe(true);
    }

    const auditPkg = readFileSync(join(root, 'docs/security/AUDIT-PACKAGE.md'), 'utf8');
    expect(auditPkg).toContain('threat-model.md');
  });
});
