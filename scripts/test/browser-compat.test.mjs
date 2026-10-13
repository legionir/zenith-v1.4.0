import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Browser (Chrome/Firefox/Safari) & Node (18.19/20/22) compatibility (#32)', () => {
  const root = process.cwd();

  it('defines Node 18.19, 20, and 22 in the CI build matrix', () => {
    const wf = readFileSync(join(root, '.github/workflows/main.yml'), 'utf8');
    expect(wf).toContain("node: ['18.19', '20', '22']");
    expect(wf).toContain('npx playwright install --with-deps chromium firefox webkit');
  });

  it('configures Chromium, Firefox, and WebKit projects in playwright.config.ts', () => {
    const pwConfig = readFileSync(join(root, 'playwright.config.ts'), 'utf8');
    expect(pwConfig).toContain("name: 'chromium'");
    expect(pwConfig).toContain("name: 'firefox'");
    expect(pwConfig).toContain("name: 'webkit'");
  });

  it('declares browserslist in package.json and documents it in README.md & docs/BROWSER-SUPPORT.md', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    expect(Array.isArray(pkg.browserslist)).toBe(true);
    expect(pkg.browserslist).toEqual(
      expect.arrayContaining(['Chrome >= 109', 'Firefox >= 115', 'Safari >= 16.4']),
    );

    const readme = readFileSync(join(root, 'README.md'), 'utf8');
    expect(readme).toContain('browserslist');
    expect(existsSync(join(root, 'docs/BROWSER-SUPPORT.md'))).toBe(true);
  });
});
