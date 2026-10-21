import { describe, it, expect } from 'vitest';
import { checkTraceability, collectSourceClaims } from '../check-traceability.mjs';

describe('BUG/IMP/SEC traceability gate (#12)', () => {
  it('verifies every BUG-*, IMP-*, and SEC-* claim in packages/*/src is mapped to existing tests in docs/TRACEABILITY.md', () => {
    const claims = collectSourceClaims(process.cwd());
    expect(claims.size).toBeGreaterThanOrEqual(130);

    const result = checkTraceability(process.cwd());
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });
});
