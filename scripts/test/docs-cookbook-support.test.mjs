import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Getting Started, Cookbook, Support Lifecycle & Migration Guide (#104, #105)', () => {
  it('provides Quick Start & 30-min tutorial in docs/GETTING-STARTED.md and 10 recipes in docs/COOKBOOK.md (#104)', () => {
    const gettingStartedPath = join(process.cwd(), 'docs/GETTING-STARTED.md');
    const cookbookPath = join(process.cwd(), 'docs/COOKBOOK.md');
    expect(existsSync(gettingStartedPath)).toBe(true);
    expect(existsSync(cookbookPath)).toBe(true);

    const gettingStarted = readFileSync(gettingStartedPath, 'utf8');
    expect(gettingStarted).toContain('createApp');
    expect(gettingStarted).toContain('signal');
    expect(gettingStarted).toContain('computed');

    const cookbook = readFileSync(cookbookPath, 'utf8');
    // Must contain all 10 numbered recipes
    for (const num of ['۱.', '۲.', '۳.', '۴.', '۵.', '۶.', '۷.', '۸.', '۹.', '۱۰.']) {
      expect(cookbook).toContain(`## ${num}`);
    }
  });

  it('documents version support matrix in SUPPORT.md and version-by-version migrations in docs/migration-guide.md (#105)', () => {
    const supportPath = join(process.cwd(), 'SUPPORT.md');
    const migrationPath = join(process.cwd(), 'docs/migration-guide.md');
    const readmePath = join(process.cwd(), 'README.md');
    expect(existsSync(supportPath)).toBe(true);
    expect(existsSync(migrationPath)).toBe(true);

    const support = readFileSync(supportPath, 'utf8');
    expect(support).toContain('Active LTS');
    expect(support).toContain('>= 18.19.0');
    expect(support).toContain('SECURITY.md');

    const migration = readFileSync(migrationPath, 'utf8');
    expect(migration).toContain('ZEN-DEPR-001');
    expect(migration).toContain('createApp');
    expect(migration).toContain('@zenith/jalali');

    const readme = readFileSync(readmePath, 'utf8');
    expect(readme).toContain('SUPPORT.md');
    expect(readme).toContain('docs/GETTING-STARTED.md');
    expect(readme).toContain('docs/COOKBOOK.md');
  });
});
