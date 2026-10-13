import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runReproducibleBenchmarks } from '../bench.mjs';

describe('Reproducible benchmarks & signal comparison suite (#86)', () => {
  it('runs reproducible microbenchmarks and records environment metadata and comparison baselines', async () => {
    const res = await runReproducibleBenchmarks({ iterations: 5_000 });
    expect(res.environment.node).toContain('v');
    expect(res.environment.cpuCores).toBeGreaterThanOrEqual(1);
    expect(res.benchmarks.zenithRead.opsPerSec).toBeGreaterThan(10_000);
    expect(res.benchmarks.zenithWrite.opsPerSec).toBeGreaterThan(10_000);
    expect(res.benchmarks.zenithComputed.opsPerSec).toBeGreaterThan(1_000);
    expect(res.benchmarks.comparison.solidRead.opsPerSec).toBeGreaterThan(10_000);
    expect(res.benchmarks.comparison.preactRead.opsPerSec).toBeGreaterThan(10_000);
  });

  it('wires npm run bench in package.json and links scripts/bench.mjs in docs/BENCHMARKS.md', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
    expect(pkg.scripts.bench).toBe('node scripts/bench.mjs');
    const doc = readFileSync(join(process.cwd(), 'docs/BENCHMARKS.md'), 'utf8');
    expect(doc).toContain('npm run bench');
    expect(doc).toContain('scripts/bench.mjs');
    expect(existsSync(join(process.cwd(), 'benchmarks/run-all.js'))).toBe(true);
  });
});
