// scripts/test/edge-independence.test.mjs
// #157 — the `ssr/edge` entry stays runnable on edge runtimes: its whole
// workspace import closure must be free of Node builtins (no `node:*`,
// no async_hooks/AsyncLocalStorage), free of DOM implementations, and must
// not touch the Node SSR barrel (index/render/dom-context). The edge entry
// documents this contract in its own header; this test locks it so a future
// import cannot silently re-couple edge to Node.
//
// Scope note: only STATIC import/export statements are followed. Dynamic
// `await import()` branches (hydrate-time router/runtime, the jsdom fallback
// in render-ssr) execute solely on explicit opt-in paths, live outside the
// bundled static closure, and each carries its own guarded fallback (see the
// lazy `node:async_hooks` acquisition in router/als-holder.ts). Following
// them here would drag half the monorepo (runtime/index) into the gate and
// produce false failures for modules edge never executes.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const ROOT = process.cwd();

function resolveLocal(fromFile, spec) {
  const base = resolve(dirname(fromFile), spec);
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (existsSync(cand)) return cand;
  }
  return null;
}

function resolveWorkspace(spec) {
  // '@zenith/pkg' -> packages/pkg/src/index.ts, '@zenith/pkg/sub' -> packages/pkg/src/sub.ts
  const m = /^@zenith\/([^/]+)(?:\/(.+))?$/.exec(spec);
  if (!m) return null;
  const file = m[2]
    ? join(ROOT, 'packages', m[1], 'src', `${m[2]}.ts`)
    : join(ROOT, 'packages', m[1], 'src', 'index.ts');
  return existsSync(file) ? file : null;
}

function workspaceClosure(entryFile) {
  const seen = new Set();
  const stack = [entryFile];
  while (stack.length > 0) {
    const file = stack.pop();
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    const src = readFileSync(file, 'utf8');
    for (const match of src.matchAll(/(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]/g)) {
      const spec = match[1];
      if (spec.startsWith('.')) {
        const local = resolveLocal(file, spec);
        if (local) stack.push(local);
      } else if (spec.startsWith('@zenith/')) {
        const other = resolveWorkspace(spec);
        if (other) stack.push(other);
      }
    }
  }
  return [...seen].sort();
}

const EDGE_ENTRY = join(ROOT, 'packages', 'ssr', 'src', 'edge.ts');

describe('#157 — ssr/edge import closure is edge-safe', () => {
  it('resolves the edge entry and its workspace closure', () => {
    expect(existsSync(EDGE_ENTRY), EDGE_ENTRY).toBe(true);
    const closure = workspaceClosure(EDGE_ENTRY);
    // Sanity: the closure is non-trivial (engine + head + state + …).
    expect(closure.length).toBeGreaterThan(10);
    expect(closure).toContain(join(ROOT, 'packages', 'ssr', 'src', 'request-state.ts'));
  });

  it('has no Node builtins anywhere in the closure (no node:, async_hooks, AsyncLocalStorage)', () => {
    const problems = [];
    for (const file of workspaceClosure(EDGE_ENTRY)) {
      const src = readFileSync(file, 'utf8');
      for (const pat of [
        /from\s*['"]node:/,
        /require\s*\(\s*['"]node:/,
        /node:async_hooks/,
        /AsyncLocalStorage/,
      ]) {
        if (pat.test(src)) problems.push(`${file}: ${pat}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('never touches the Node SSR barrel (only edge.ts + request-state.ts from ssr/)', () => {
    const ssrFiles = workspaceClosure(EDGE_ENTRY).filter((f) =>
      f.startsWith(join(ROOT, 'packages', 'ssr', 'src') + '/'),
    );
    expect(ssrFiles).toEqual([EDGE_ENTRY, join(ROOT, 'packages', 'ssr', 'src', 'request-state.ts')].sort());
  });

  it('pulls no DOM implementation into the closure (caller provides Document)', () => {
    const problems = [];
    for (const file of workspaceClosure(EDGE_ENTRY)) {
      const src = readFileSync(file, 'utf8');
      for (const pat of [/from\s*['"]linkedom['"]/, /from\s*['"]jsdom['"]/, /from\s*['"]happy-dom['"]/]) {
        if (pat.test(src)) problems.push(`${file}: ${pat}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
