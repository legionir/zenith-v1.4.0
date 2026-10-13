import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkWorkspacePackageNames, planScopeMigration } from '../check-npm-scope.mjs';

describe('NPM scope & naming audit (#77)', () => {
  it('verifies all workspace package names conform to @zenith/* or approved unscoped names', () => {
    const res = checkWorkspacePackageNames(process.cwd());
    expect(res.errors).toEqual([]);
    expect(res.ok).toBe(true);
    expect(res.packages.length).toBeGreaterThanOrEqual(40);
  });

  it('produces a deterministic fallback scope migration plan when requested', () => {
    const plan = planScopeMigration(process.cwd(), '@zenithjs');
    const stateMapping = plan.find((p) => p.from === '@zenith/state');
    expect(stateMapping?.to).toBe('@zenithjs/state');
    const umbrellaMapping = plan.find((p) => p.from === 'zenith');
    expect(umbrellaMapping?.to).toBe('@zenithjs/zenith');
  });

  it('documents live npm registry findings in docs/release/NPM-SCOPE-AUDIT.md and manual steps', () => {
    const docPath = join(process.cwd(), 'docs/release/NPM-SCOPE-AUDIT.md');
    expect(existsSync(docPath)).toBe(true);
    const content = readFileSync(docPath, 'utf8');
    expect(content).toContain('@zenith/*');
    expect(content).toContain('create-zenith');
    expect(content).toContain('unplugin-zenith');
  });
});
