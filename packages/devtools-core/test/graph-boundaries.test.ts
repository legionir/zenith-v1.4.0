import { afterEach, expect, it, vi } from 'vitest';
import { createRoot, effect, signal } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { setEffectContextStore, type EffectContext } from '@zenith/state/internal';
import {
  RuntimeGraph, runtimeGraph, graph, getRuntimeGraph, clearDevtoolsRegistryInternal,
  recordRead, recordWrite, recordDomUpdate,
} from '../src';

afterEach(() => { setEffectContextStore(null); clearDevtoolsRegistryInternal(); vi.unstubAllGlobals(); });
function seed(target: RuntimeGraph) {
  target.addSignal('signal', { name: 'actual', value: { private: 'outside' } });
  target.addEffect('effect', ['signal']);
  target.addDirective('directive', { directiveType: 'zen-text', elementSelector: '#actual', expression: '$actual' });
  target.addDom('dom', 'SPAN');
}

it('preserves graph aliases, deduplication and actual opaque value identity', () => {
  expect(graph).toBe(runtimeGraph); const local = new RuntimeGraph(); seed(local);
  local.recordRead('signal', 'effect'); local.recordRead('signal', 'effect');
  local.recordWrite('effect', 'directive'); local.recordDomUpdate('directive', 'dom');
  expect(local.getGraph().counts).toEqual({ signals: 1, effects: 1, directives: 1, dom: 1, edges: 3 });
  const value = { actual: Symbol('identity') }; local.addSignal('signal', { value });
  expect(local.getGraph().nodes.find(node => node.id === 'signal')?.value).toBe(value);
});
it('separates copied metadata/dependencies/edges without pretending arbitrary values are cloned', () => {
  const local = new RuntimeGraph(), dependencies = ['s']; local.addSignal('s', { value: 1 }); local.addEffect('e', dependencies); local.recordRead('s', 'e');
  dependencies.push('external'); const snapshot = local.getGraph();
  snapshot.nodes[0]!.type = 'dom'; snapshot.nodes[1]!.deps?.push('mutated'); snapshot.edges[0]!.to = 'invalid'; snapshot.nodes.pop();
  const current = local.getGraph(); expect(current.nodes).toHaveLength(2);
  expect(current.nodes.find(node => node.id === 'e')?.deps).toEqual(['s']); expect(current.edges).toEqual([{ from: 's', to: 'e', type: 'read-by' }]);
});
it('removes edges and old discriminator data when an ID changes node kind', () => {
  const local = new RuntimeGraph(); local.addSignal('same', { value: 'retire' }); local.addEffect('e'); local.recordRead('same', 'e');
  local.addDirective('same', { directiveType: 'zen-if', elementSelector: '#next' });
  expect(local.getGraph().counts).toMatchObject({ signals: 0, directives: 1, edges: 0 });
  expect(local.getGraph().nodes.find(node => node.id === 'same')).not.toHaveProperty('value');
});
it('does not collide delimiter-bearing edge identities and can remove/reinsert them', () => {
  const local = new RuntimeGraph(); local.addSignal('a|b', {}); local.addSignal('a', {}); local.addEffect('c'); local.addEffect('b|c');
  local.recordRead('a|b', 'c'); local.recordRead('a', 'b|c'); expect(local.getGraph().edges).toHaveLength(2);
  local.removeNode('a|b'); expect(local.getGraph().edges).toHaveLength(1);
  local.addSignal('a|b', {}); local.recordRead('a|b', 'c'); expect(local.getGraph().edges).toHaveLength(2);
});
it('keeps each node kind bounded and unlinks evicted edges', () => {
  const local = new RuntimeGraph(); local.addEffect('effect');
  for (let index = 0; index <= 500; index++) { local.addSignal(`s${index}`, { value: index }); local.recordRead(`s${index}`, 'effect'); }
  const snapshot = local.getGraph(); expect(snapshot.counts.signals).toBe(500); expect(snapshot.edges).toHaveLength(500);
  expect(snapshot.nodes.some(node => node.id === 's0')).toBe(false); expect(snapshot.edges.some(edge => edge.from === 's0')).toBe(false);
});
it('protects only the realm graph in a muted scope, leaving explicit local graphs caller-owned', () => {
  seed(runtimeGraph); const before = getRuntimeGraph();
  const host: EffectContext = { owner: null, activeEffect: null, activeCleanupRegistration: null, globalObservation: false };
  setEffectContextStore(() => host);
  runtimeGraph.clear(); runtimeGraph.removeNode('signal'); runtimeGraph.addSignal('private', { value: 'secret' });
  expect(getRuntimeGraph().nodes).toEqual([]); const local = new RuntimeGraph(); local.addSignal('local', { value: 'caller-owned' }); expect(local.getGraph().nodes).toHaveLength(1);
  setEffectContextStore(null); expect(getRuntimeGraph().nodes).toEqual(before.nodes);
});
it('does not reopen a graph reset by an actual dependency-array getter', () => {
  const local = new RuntimeGraph(), dependencies = ['value'];
  Object.defineProperty(dependencies, '0', { get() { local.clear(); return 'retired'; } });
  local.addEffect('stale', dependencies); expect(local.getGraph().nodes).toEqual([]);
});
it('does not retain a signal registration invalidated by an options getter', () => {
  const local = new RuntimeGraph();
  local.addSignal('stale', { get value() { local.clear(); return 'private'; } }); expect(local.getGraph().nodes).toEqual([]);
});
it('forwards foreign native hooks with their real receiver, untracked and bounded on reentry', () => {
  seed(runtimeGraph); const dependency = signal(1); let calls = 0;
  const hook = { recordRead(from: string, to: string) { expect(this).toBe(hook); calls++; dependency.get(); recordRead(from, to); } };
  vi.stubGlobal('__ZENITH__', hook);
  createRoot(dispose => {
    let runs = 0; effect(() => { runs++; recordRead('signal', 'effect'); });
    try { expect(calls).toBe(1); expect(dependency.subscriberCount).toBe(0); dependency.set(2); flushSync(); expect(runs).toBe(1); expect(getRuntimeGraph().edges).toHaveLength(1); }
    finally { dispose(); dependency.dispose(); }
  });
});
it('contains unknown/throwing/global getter capabilities and still falls back to local edges', () => {
  seed(runtimeGraph);
  for (const hook of [null, 1, 'not a hook', { recordRead: 1 }, { get recordRead() { throw new Error('getter'); } }, { recordRead() { throw new Error('method'); } }]) {
    vi.stubGlobal('__ZENITH__', hook); expect(() => recordRead('signal', 'effect')).not.toThrow();
  }
  recordWrite('effect', 'directive'); recordDomUpdate('directive', 'dom'); expect(getRuntimeGraph().edges).toHaveLength(3);
});
it('invalidates forwarding after a native getter reset and clears the singleton on process reset', () => {
  seed(runtimeGraph);
  let calls = 0; vi.stubGlobal('__ZENITH__', { get recordRead() { clearDevtoolsRegistryInternal(); return () => { calls++; }; } });
  expect(() => recordRead('signal', 'effect')).not.toThrow(); expect(calls).toBe(0); expect(getRuntimeGraph().nodes).toEqual([]);
});

it('keeps explicit flag disabling authoritative without revoking caller-owned local graphs', () => {
  seed(runtimeGraph); const before = getRuntimeGraph().nodes; vi.stubGlobal('__ZENITH_DEVTOOLS__', false);
  runtimeGraph.addSignal('disabled', { value: 'ignored' }); recordRead('signal', 'effect'); expect(getRuntimeGraph().nodes).toEqual([]);
  const local = new RuntimeGraph(); local.addSignal('local', { value: 1 }); expect(local.getGraph().nodes).toHaveLength(1);
  vi.stubGlobal('__ZENITH_DEVTOOLS__', true); expect(getRuntimeGraph().nodes).toEqual(before);
});
