import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { scanContentForSecrets, scanRepositoryForSecrets } from '../secret-scan.mjs';

const ROOT = process.cwd();

describe('Dependabot, npm audit (prod+dev), and secret scanning (#65)', () => {
  it('configures weekly grouped Dependabot updates for npm and github-actions', () => {
    const p = join(ROOT, '.github/dependabot.yml');
    expect(existsSync(p)).toBe(true);
    const raw = readFileSync(p, 'utf8');
    expect(raw).toContain('package-ecosystem: "npm"');
    expect(raw).toContain('package-ecosystem: "github-actions"');
    expect(raw).toContain('interval: "weekly"');
    expect(raw).toContain('groups:');
  });

  it('configures CI workflow with prod+dev npm audit and gitleaks secret-scan job', () => {
    const wf = readFileSync(join(ROOT, '.github/workflows/main.yml'), 'utf8');
    expect(wf).toContain('npm audit --omit=dev --audit-level=high');
    expect(wf).toContain('npm audit --audit-level=low');
    expect(wf).not.toContain('npm audit --audit-level=high || true');
    expect(wf).toContain('gitleaks/gitleaks-action@v2');
    expect(wf).toContain('node scripts/secret-scan.mjs');
    expect(existsSync(join(ROOT, '.gitleaks.toml'))).toBe(true);
  });

  it('detects synthetic secrets and passes on tracked repository files', () => {
    // Construct synthetic test tokens dynamically so they are not literal in source
    const fakeGhToken = 'ghp_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8';
    const fakeAwsKey = 'AKIA' + 'IOSFODNN7EXAMPLE';
    const fakePem = '-----BEGIN ' + 'RSA PRIVATE KEY-----';

    const findings = scanContentForSecrets(
      `const token = "${fakeGhToken}";\nconst aws = "${fakeAwsKey}";\n${fakePem}`,
      'synthetic.ts',
    );
    expect(findings.map((f) => f.ruleId)).toEqual([
      'github-pat',
      'aws-access-key-id',
      'private-key-pem',
    ]);

    const repoScan = scanRepositoryForSecrets(ROOT);
    expect(repoScan.scannedFiles).toBeGreaterThan(100);
    expect(repoScan.findings).toEqual([]);
  });
});
