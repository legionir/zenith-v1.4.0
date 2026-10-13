import { describe, it, expect } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  parseChangesetFile,
  bumpSemver,
  computeLockstepReleasePlan,
  formatKeepAChangelogSection,
} from '../changeset.mjs';

describe('Lockstep versioning strategy & automated CHANGELOG generator (#72)', () => {
  it('configures lockstep fixed group in .changeset/config.json and documents strategy', () => {
    const cfg = JSON.parse(readFileSync(join(process.cwd(), '.changeset/config.json'), 'utf8'));
    expect(cfg.fixed).toEqual([['@zenith/*', 'zenith']]);
    expect(existsSync(join(process.cwd(), 'docs/VERSIONING-STRATEGY.md'))).toBe(true);
    expect(existsSync(join(process.cwd(), '.changeset/README.md'))).toBe(true);
  });

  it('parses changesets, computes lockstep SemVer bumps, and formats Keep a Changelog sections without manual edits', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'zenith-changeset-72-'));
    try {
      writeFileSync(join(tmp, 'package.json'), JSON.stringify({ version: '1.4.0' }));
      mkdirSync(join(tmp, '.changeset'));
      writeFileSync(
        join(tmp, '.changeset', 'feat-router.md'),
        `---\n"@zenith/router": minor\n---\n\nافزودن پشتیبانی از پیش‌بارگذاری مسیرها.\n`,
      );
      writeFileSync(
        join(tmp, '.changeset', 'fix-suspense.md'),
        `---\n"@zenith/suspense": patch\n---\n\nرفع مشکل minDelay در چرخه‌های سریع.\n`,
      );

      const plan = computeLockstepReleasePlan(tmp);
      expect(plan.currentVersion).toBe('1.4.0');
      expect(plan.bumpType).toBe('minor');
      expect(plan.nextVersion).toBe('1.5.0');
      expect(plan.changesets).toHaveLength(2);

      const changelog = formatKeepAChangelogSection(
        plan.nextVersion,
        '2026-10-13',
        plan.changesets,
      );
      expect(changelog).toContain('## [1.5.0] - 2026-10-13');
      expect(changelog).toContain('### Added');
      expect(changelog).toContain('`@zenith/router`: افزودن پشتیبانی از پیش‌بارگذاری مسیرها.');
      expect(changelog).toContain('### Fixed');
      expect(changelog).toContain('`@zenith/suspense`: رفع مشکل minDelay در چرخه‌های سریع.');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('validates semver bumping for patch, minor, and major', () => {
    expect(bumpSemver('1.4.0', 'patch')).toBe('1.4.1');
    expect(bumpSemver('1.4.0', 'minor')).toBe('1.5.0');
    expect(bumpSemver('1.4.0', 'major')).toBe('2.0.0');
    const parsed = parseChangesetFile(`---\n"zenith": major\n---\n\nنسخهٔ ۲.۰\n`);
    expect(parsed.releases).toEqual([{ name: 'zenith', type: 'major' }]);
  });
});
