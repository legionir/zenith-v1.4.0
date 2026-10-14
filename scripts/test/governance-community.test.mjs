import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Project governance, community health files & CODEOWNERS (#80, #107)', () => {
  const root = process.cwd();

  it('provides CONTRIBUTING.md, CODE_OF_CONDUCT.md, GOVERNANCE.md, ROADMAP.md, and MAINTAINERS.md', () => {
    for (const file of [
      'CONTRIBUTING.md',
      'CODE_OF_CONDUCT.md',
      'GOVERNANCE.md',
      'ROADMAP.md',
      'MAINTAINERS.md',
    ]) {
      const full = join(root, file);
      expect(existsSync(full), `Missing ${file}`).toBe(true);
      expect(readFileSync(full, 'utf8').length).toBeGreaterThan(200);
    }
  });

  it('registers at least two maintainers in MAINTAINERS.md and .github/CODEOWNERS with security paths protected', () => {
    const maintainers = readFileSync(join(root, 'MAINTAINERS.md'), 'utf8');
    expect(maintainers).toContain('@legionir');
    expect(maintainers).toContain('@zenith-framework/core-maintainers');

    const codeownersPath = join(root, '.github/CODEOWNERS');
    expect(existsSync(codeownersPath)).toBe(true);
    const codeowners = readFileSync(codeownersPath, 'utf8');
    expect(codeowners).toContain('* @legionir @zenith-framework/core-maintainers');
    expect(codeowners).toContain('/packages/security/');
    expect(codeowners).toContain('/packages/auth/');
    expect(codeowners).toContain('/packages/expressions/');
  });
});
