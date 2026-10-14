import { describe, it, expect } from 'vitest';
import { checkSecurityAuditReadiness } from '../security-audit-check.mjs';

describe('Security audit package & readiness gate (#61)', () => {
  it('verifies security audit documentation, test suites, and absence of eval/new Function in critical packages', () => {
    const res = checkSecurityAuditReadiness(process.cwd());
    expect(res.errors).toEqual([]);
    expect(res.ok).toBe(true);
    expect(res.checkedDocs).toBe(3);
    expect(res.checkedTests).toBe(6);
  });
});
