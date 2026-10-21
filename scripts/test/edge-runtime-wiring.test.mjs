// scripts/test/edge-runtime-wiring.test.mjs
// #57 — the Deno/edge validation probe is wired, not floating: the repro
// exists, fails (rather than skips) without Deno, and is callable as one
// npm command so CI can run it. The probe itself needs Deno + built bundles,
// so execution stays in validation (dedicated CI job — see the #57
// changeset; the .github workflow is not in this snapshot).
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

describe('#57 — Deno/edge probe wiring', () => {
  it('exposes the Deno probe as npm run test:deno', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.scripts['test:deno']).toBe('node scripts/repro/edge-deno.mjs');
    expect(existsSync(join(ROOT, 'scripts/repro/edge-deno.mjs'))).toBe(true);
  });

  it('the probe fails closed without Deno and asserts isolation + CSP', () => {
    const probe = readFileSync(join(ROOT, 'scripts/repro/edge-deno.mjs'), 'utf8');
    // Absence of the `deno` binary rejects the run (no silent skip).
    expect(probe).toContain(`spawn('deno'`);
    expect(probe).toContain('Deno validation failed');
    // 100 isolated requests, per-response CSP nonce, no reuse.
    expect(probe).toContain('request-');
    expect(probe).toContain('nonce-');
    expect(probe).toContain('nonce reuse');
    // Bundled from workspace sources (not a stale dist).
    expect(probe).toContain('bundleWorker');
  });
});
