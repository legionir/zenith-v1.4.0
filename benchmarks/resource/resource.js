// benchmarks/resource/resource.js
//
// FEATURE (v0.6.3): Resource Benchmarks
//
// سنجش عملکرد Resource layer:
//   - 1000 concurrent requests (dedupe)
//   - cache hit vs cache miss
//   - background refresh (SWR)
//   - optimistic update + rollback

import { pathToFileURL } from 'url';

const pkgBase = '/home/z/my-project/public/packages';
const stateUrl = pathToFileURL(`${pkgBase}/state/dist/index.js`).href;
const resourceUrl = pathToFileURL(`${pkgBase}/resource/dist/index.js`).href;

async function main() {
  const { signal } = await import(stateUrl);
  const { createResource } = await import(resourceUrl);

  function fmt(n) { return n.toLocaleString('en-US'); }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Zenith Resource Benchmarks (v0.6.3) — Node.js v' + process.version);
  console.log('═══════════════════════════════════════════════════════════\n');

  // ── Mock fetch ──
  let fetchCount = 0;
  let fetchDelay = 10; // ms
  g.fetch = async (url, opts) => {
    fetchCount++;
    await new Promise(r => setTimeout(r, fetchDelay));
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: fetchCount, data: 'response-' + fetchCount }),
    };
  };

  // ═══════════════════════════════════════════════════════════
  // 1. Dedupe: 1000 concurrent identical requests
  // ═══════════════════════════════════════════════════════════
  {
    fetchCount = 0;
    fetchDelay = 50;
    const res = createResource('test1', { url: '/api/test', staleTime: 999999, retryCount: 0 });

    const t0 = performance.now();
    // Fire 1000 concurrent list() calls
    const promises = Array.from({ length: 1000 }, () => res.list());
    await Promise.all(promises);
    const ms = performance.now() - t0;

    console.log('━━━ 1. Dedupe (1000 concurrent identical requests) ━━━');
    console.log('  Time: ' + ms.toFixed(2) + 'ms');
    console.log('  Actual fetch calls: ' + fetchCount + ' (should be 1 with dedupe)');
    console.log('  Dedupe ratio: ' + (1000 / fetchCount).toFixed(0) + ':1\n');
  }

  // ═══════════════════════════════════════════════════════════
  // 2. Cache hit vs miss
  // ═══════════════════════════════════════════════════════════
  {
    fetchCount = 0;
    fetchDelay = 10;
    const res = createResource('test2', { url: '/api/cached', staleTime: 999999, retryCount: 0 });

    // First call: cache miss
    fetchCount = 0;
    const t0 = performance.now();
    await res.list();
    const missMs = performance.now() - t0;
    const missFetches = fetchCount;

    // Second call: cache hit
    fetchCount = 0;
    const t1 = performance.now();
    await res.list();
    const hitMs = performance.now() - t1;
    const hitFetches = fetchCount;

    // 1000 cache hits
    fetchCount = 0;
    const t2 = performance.now();
    for (let i = 0; i < 1000; i++) await res.list();
    const batchHitMs = performance.now() - t2;

    console.log('━━━ 2. Cache hit vs miss ━━━');
    console.log('  Cache miss (1st call): ' + missMs.toFixed(2) + 'ms (' + missFetches + ' fetches)');
    console.log('  Cache hit (2nd call):  ' + hitMs.toFixed(2) + 'ms (' + hitFetches + ' fetches)');
    console.log('  1000 cache hits:       ' + batchHitMs.toFixed(2) + 'ms (' + fmt(Math.round(1000 / (batchHitMs / 1000))) + ' hits/sec)');
    console.log('  Speedup: ' + (missMs / (hitMs || 0.01)).toFixed(0) + 'x\n');
  }

  // ═══════════════════════════════════════════════════════════
  // 3. Optimistic update + rollback
  // ═══════════════════════════════════════════════════════════
  {
    fetchCount = 0;
    fetchDelay = 10;
    const res = createResource('test2', { url: '/api/items', staleTime: 999999, retryCount: 0, optimistic: true });

    // Pre-populate
    res.setData(() => [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }]);

    // Optimistic delete
    fetchCount = 0;
    const t0 = performance.now();
    const result = await res.delete(2);
    const deleteMs = performance.now() - t0;

    console.log('━━━ 3. Optimistic delete + rollback ━━━');
    console.log('  Delete time: ' + deleteMs.toFixed(2) + 'ms');
    console.log('  Fetch calls: ' + fetchCount);
    console.log('  Result success: ' + result.success + '\n');
  }

  // ═══════════════════════════════════════════════════════════
  // 4. SWR (Stale-While-Revalidate)
  // ═══════════════════════════════════════════════════════════
  {
    fetchCount = 0;
    fetchDelay = 5;
    const res = createResource('test2', { url: '/api/swr', staleTime: 50, retryCount: 0 });

    // Initial fetch
    await res.list();
    fetchCount = 0;

    // Wait for stale
    await new Promise(r => setTimeout(r, 100));

    // SWR: returns cached immediately, fetches in background
    const t0 = performance.now();
    await res.list();
    const swrMs = performance.now() - t0;
    await new Promise(r => setTimeout(r, 20)); // wait for bg fetch

    console.log('━━━ 4. SWR (Stale-While-Revalidate) ━━━');
    console.log('  SWR response time: ' + swrMs.toFixed(2) + 'ms (returns cached immediately)');
    console.log('  Background fetches: ' + fetchCount + '\n');
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Resource benchmarks complete.');
  console.log('═══════════════════════════════════════════════════════════');
}

const g = globalThis;
g.fetch = async () => ({ ok: true, status: 200, json: async () => ({}) });
main().catch(err => { console.error('Crash:', err); process.exit(1); });
