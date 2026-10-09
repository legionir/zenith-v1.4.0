import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const securityPath = join(ROOT, 'SECURITY.md');
const security = existsSync(securityPath) ? readFileSync(securityPath, 'utf8') : '';

describe('SECURITY.md (issue #59)', () => {
  it('exists at repository root', () => {
    expect(existsSync(securityPath)).toBe(true);
  });

  it('declares supported versions table', () => {
    expect(security).toMatch(/## Supported versions/);
    expect(security).toMatch(/\| 1\.4\.x\b/);
    expect(security).toMatch(/EOL/);
  });

  it('offers private reporting channels: GitHub advisories + email fallback', () => {
    expect(security).toMatch(/Private vulnerability reporting/);
    expect(security).toMatch(/Security\b.*tab|tab.*Security/is);
    expect(security).toMatch(/ZENITH-SEC/);
    expect(security).toMatch(/Do \*\*not\*\* open a public issue/);
  });

  it('states explicit response/disclosure times (48h ack, 90d disclosure)', () => {
    expect(security).toMatch(/48 hours/);
    expect(security).toMatch(/7 days/);
    expect(security).toMatch(/90 days/);
  });

  it('defines in-scope and out-of-scope', () => {
    expect(security).toMatch(/\*\*In scope\*\*/);
    expect(security).toMatch(/\*\*Out of scope\*\*/);
    // expression engine documented as a security boundary
    expect(security).toMatch(/security boundary/);
  });

  it('references the Node floor decision', () => {
    expect(security).toMatch(/Node ≥ 18\.19/);
    expect(security).toMatch(/DEC-007/);
  });

  it('is linked from docs/README.md (root README link tracked by #69)', () => {
    const docsReadme = readFileSync(join(ROOT, 'docs', 'README.md'), 'utf8');
    expect(docsReadme).toMatch(/\[`SECURITY\.md`\]\(\.\.\/SECURITY\.md\)/);
  });

  it('remaining manual step is recorded in docs/MANUAL-STEPS.md', () => {
    const manual = readFileSync(join(ROOT, 'docs', 'MANUAL-STEPS.md'), 'utf8');
    expect(manual).toMatch(/#59/);
    expect(manual).toMatch(/Private vulnerability reporting/);
  });
});
