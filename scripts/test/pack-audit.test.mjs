import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { auditPackages } from '../pack-audit.mjs';

describe('Published package tarball & ATTW types resolution audit (#74)', () => {
  it('verifies files allowlist, LICENSE/README presence, and ATTW types-first exports across all 43 publishable packages', () => {
    const res = auditPackages(process.cwd(), { runNpmPack: false });
    expect(res.errors).toEqual([]);
    expect(res.ok).toBe(true);
    expect(res.checked).toBe(43);
  });

  it('runs pack-audit --pack in the CI package-lint job', () => {
    const wf = readFileSync(join(process.cwd(), '.github/workflows/main.yml'), 'utf8');
    expect(wf).toContain('node scripts/pack-audit.mjs --pack');
  });
});
