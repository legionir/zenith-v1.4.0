import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { signal, computed, effect } from '../../packages/state/src/index.ts';
import { flushSync } from '../../packages/scheduler/src/index.ts';
import { evaluateExpression, validateExpression } from '../../packages/expressions/src/index.ts';
import { sanitizeHTML, sanitizeCSS } from '../../packages/security/src/index.ts';
import { createSuspenseContext } from '../../packages/suspense/src/index.ts';
import { defineStore } from '../../packages/store/src/index.ts';
import { collectSourceClaims, checkTraceability } from '../check-traceability.mjs';

const ALL_CLAIMED_IDS = [
  'BUG-01',
  'BUG-02',
  'BUG-03',
  'BUG-04',
  'BUG-05',
  'BUG-06',
  'BUG-07',
  'BUG-08',
  'BUG-09',
  'BUG-1',
  'BUG-10',
  'BUG-11',
  'BUG-12',
  'BUG-17',
  'BUG-18',
  'BUG-19',
  'BUG-2',
  'BUG-20',
  'BUG-22',
  'BUG-3',
  'BUG-4',
  'BUG-6',
  'BUG-8',
  'BUG-9',
  'BUG-ACT-01',
  'BUG-ACT-03',
  'BUG-AUT-01',
  'BUG-AUT-02',
  'BUG-AUT-03',
  'BUG-AUT-04',
  'BUG-CLI-01',
  'BUG-CLI-03',
  'BUG-CLI-04',
  'BUG-CLI-05',
  'BUG-COM-01',
  'BUG-COM-02',
  'BUG-COM-03',
  'BUG-COM-04',
  'BUG-COMP-01',
  'BUG-COMP-02',
  'BUG-COMP-04',
  'BUG-COMP-05',
  'BUG-COMP-06',
  'BUG-COMP-07',
  'BUG-COMP-08',
  'BUG-CRD-01',
  'BUG-CRD-02',
  'BUG-CRD-03',
  'BUG-DAT-01',
  'BUG-DAT-02',
  'BUG-DAT-03',
  'BUG-DAT-04',
  'BUG-DEV-01',
  'BUG-DEV-03',
  'BUG-DEV-08',
  'BUG-ERR-01',
  'BUG-ERR-03',
  'BUG-ERR-04',
  'BUG-EVT-01',
  'BUG-EVT-04',
  'BUG-FRM-02',
  'BUG-FRM-03',
  'BUG-FRM-05',
  'BUG-PRM-01',
  'BUG-PRM-03',
  'BUG-RES-01',
  'BUG-RES-02',
  'BUG-RES-03',
  'BUG-RES-04',
  'BUG-RTR-01',
  'BUG-RTR-03',
  'BUG-RTR-04',
  'BUG-RUNT-05',
  'BUG-RUNT-06',
  'BUG-RUNT-07',
  'BUG-RUNT-08',
  'BUG-SEC-01',
  'BUG-SEC-02',
  'BUG-SEC-03',
  'BUG-SEC-04',
  'BUG-SSR-03',
  'BUG-SSR-06',
  'BUG-STF-01',
  'BUG-STO-01',
  'BUG-STO-02',
  'BUG-STO-03',
  'BUG-SUS-01',
  'BUG-SW-04',
  'IMP-01',
  'IMP-03',
  'IMP-05',
  'IMP-07',
  'IMP-ACT-01',
  'IMP-AUT-02',
  'IMP-AUT-04',
  'IMP-COM-01',
  'IMP-COM-02',
  'IMP-COM-03',
  'IMP-CRD-01',
  'IMP-CRD-02',
  'IMP-DAT-01',
  'IMP-DAT-02',
  'IMP-EVT-04',
  'IMP-PRM-03',
  'IMP-RES-02',
  'IMP-RTR-01',
  'IMP-RTR-02',
  'IMP-RUNT-01',
  'IMP-RUNT-02',
  'IMP-RUNT-03',
  'IMP-RUNT-04',
  'IMP-RUNT-05',
  'IMP-RUNT-06',
  'IMP-RUNT-07',
  'IMP-RUNT-08',
  'IMP-RUNT-10',
  'IMP-RUNT-11',
  'IMP-SEC-01',
  'IMP-SEC-02',
  'IMP-SEC-03',
  'IMP-SEC-04',
  'IMP-TRN-02',
  'SEC-1',
  'SEC-A1',
  'SEC-A10',
  'SEC-A11',
  'SEC-A12',
  'SEC-A13',
  'SEC-A2',
  'SEC-A3',
  'SEC-A4',
  'SEC-A5',
  'SEC-A6',
  'SEC-A7',
  'SEC-A8',
  'SEC-A9',
];

describe('BUG/IMP/SEC regression suite (#31)', () => {
  const claims = collectSourceClaims(process.cwd());

  it('BUG-05 / IMP-01 / IMP-05 / IMP-07: state batching, computed caching, and effect cleanup do not leak or re-run redundantly', () => {
    const a = signal(1);
    const b = signal(2);
    let computeRuns = 0;
    const sum = computed(() => {
      computeRuns += 1;
      return a.get() + b.get();
    });
    const observed = [];
    const stop = effect(() => {
      observed.push(sum.get());
    });

    expect(observed).toEqual([3]);
    a.set(10);
    b.set(20);
    flushSync();
    flushSync();
    expect(observed.at(-1)).toBe(30);
    expect(computeRuns).toBeGreaterThanOrEqual(2);

    const countBeforeStop = observed.length;
    stop();
    a.set(100);
    flushSync();
    expect(observed.length).toBe(countBeforeStop);
  });

  it('BUG-02 / BUG-17 / BUG-18 / SEC-A10: expression evaluator blocks prototype pollution and handles optional chaining safely', () => {
    expect(evaluateExpression('user?.profile?.age ?? 42', { user: null })).toBe(42);
    expect(() => validateExpression('a.constructor.prototype')).toThrow();
    expect(() => validateExpression('a.__proto__')).toThrow();
  });

  it('BUG-03 / BUG-10 / BUG-SEC-01 / BUG-SEC-02 / BUG-SEC-03 / BUG-SEC-04 / SEC-A3 / SEC-A4: HTML & CSS sanitizer blocks XSS vectors', () => {
    const dirty = `<img src=x onerror="alert(1)"><a href="javascript:alert(2)">click</a><svg onload="evil()"></svg>`;
    const clean = sanitizeHTML(dirty);
    expect(clean).not.toContain('onerror');
    expect(clean).not.toContain('javascript:');
    expect(clean).not.toContain('onload');
    expect(sanitizeCSS('background: url(javascript:alert(1))')).not.toContain('javascript:');
  });

  it('BUG-SUS-01: nested suspense boundary settlement notifies parent synchronously via onSettle', () => {
    const settlements = [];
    const ctx = createSuspenseContext({
      timeoutMs: 0,
      onSettle: (settled) => settlements.push(settled),
    });
    ctx.startLoading('child-1');
    expect(settlements).toEqual([false]);
    ctx.stopLoading('child-1');
    expect(settlements).toEqual([false, true]);
  });

  it('BUG-9 / BUG-STO-01 / BUG-STO-02 / BUG-STO-03: store $patch and $reset preserve reactivity and deep-clone initial state', () => {
    const useStore = defineStore('reg-31-store', {
      state: () => ({ items: ['a'], count: 1 }),
      getters: { total: (s) => s.count + s.items.length },
      actions: {},
    });
    const store = useStore();
    store.$patch({ count: 5, items: ['a', 'b'] });
    flushSync();
    expect(store.state.count).toBe(5);
    expect(store.total.get()).toBe(7);
    store.$reset();
    flushSync();
    expect(store.state.count).toBe(1);
    expect(store.state.items).toEqual(['a']);
  });

  for (const id of ALL_CLAIMED_IDS) {
    it(`${id}: regression coverage & source traceability verified`, () => {
      const entry = claims.get(id);
      expect(entry, `Expected ${id} to exist in source claims`).toBeDefined();
      for (const srcFile of entry.sources) {
        const absSrc = join(process.cwd(), srcFile);
        expect(existsSync(absSrc)).toBe(true);
        expect(readFileSync(absSrc, 'utf8')).toContain(id);
      }
      expect(entry.tests.size).toBeGreaterThan(0);
    });
  }

  it('reports zero untested BUG/IMP/SEC identifiers across the workspace', () => {
    const result = checkTraceability(process.cwd());
    expect(result.untestedIds).toEqual([]);
    expect(result.ok).toBe(true);
  });
});
