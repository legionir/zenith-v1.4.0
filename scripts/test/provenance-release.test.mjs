import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseReleaseArgs } from '../release.mjs';

describe('npm OIDC & provenance release workflow (#66)', () => {
  const root = process.cwd();

  it('configures .github/workflows/release.yml with id-token: write, environment: release, and zero NPM_TOKEN secrets', () => {
    const wfPath = join(root, '.github/workflows/release.yml');
    expect(existsSync(wfPath)).toBe(true);
    const wf = readFileSync(wfPath, 'utf8');

    expect(wf).toContain('id-token: write');
    expect(wf).toContain('environment: release');
    expect(wf).toContain("tags:\n      - 'v*'");
    expect(wf).toContain('--provenance');
    expect(wf).not.toContain('NPM_TOKEN');
  });

  it('supports --provenance in parseReleaseArgs', () => {
    const parsed = parseReleaseArgs(['--publish', '--provenance']);
    expect(parsed.dryRun).toBe(false);
    expect(parsed.provenance).toBe(true);
  });
});
