// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  initDevTools,
  isDevtoolsHookInstalled,
  cleanupDevtools,
  getDevtoolsVersion,
  DEVTOOLS_VERSION,
  recordRead,
  recordWrite,
  recordDomUpdate,
  getDependencyGraph,
  clearDependencyGraph,
} from '../src/index';

describe('@zenith/devtools hook & dependency graph (#12 / BUG-DEV-01/03/08)', () => {
  beforeEach(() => {
    cleanupDevtools();
    clearDependencyGraph();
  });

  it('installs and cleans up window.__ZENITH__ hook idempotently and tracks graph edges', () => {
    expect(isDevtoolsHookInstalled()).toBe(false);
    initDevTools();
    initDevTools();
    expect(isDevtoolsHookInstalled()).toBe(true);
    expect(getDevtoolsVersion()).toBe(DEVTOOLS_VERSION);

    const hook = (window as any).__ZENITH__;
    expect(hook).toBeDefined();
    hook.addSignal('s1', 'count', 0);
    hook.addEffect('e1', ['s1']);
    hook.addDirective('d1', 'zen-text', '#counter', '$count');
    hook.addDom('n1', 'span');

    recordRead('s1', 'e1');
    recordWrite('e1', 'd1');
    recordDomUpdate('d1', 'n1');

    const snapshot = getDependencyGraph();
    expect(snapshot.nodes.length).toBeGreaterThanOrEqual(4);
    expect(snapshot.edges.length).toBeGreaterThanOrEqual(3);

    cleanupDevtools();
    expect(isDevtoolsHookInstalled()).toBe(false);
  });
});
