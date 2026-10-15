// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createResource, clearResources } from '@zenith/resource';
import { CrudEngine } from '../src/index';

describe('@zenith/crud bounded fetch retry loop (#15)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    clearResources();
  });

  it('caps fetchWithRetry attempts at maxRetries + 1 and never loops infinitely', async () => {
    const resource = createResource('orders', { url: '/api/orders' });
    let listCalls = 0;
    resource.list = async () => {
      listCalls += 1;
      throw new Error('503 Service Unavailable');
    };

    const host = document.createElement('div');
    document.body.appendChild(host);

    const engine = new CrudEngine(
      {
        resource: 'orders',
        columns: [{ field: 'id', label: 'ID' }],
        maxRetries: 2,
      },
      host,
    );

    const ok = await engine.fetchWithRetry(true);
    expect(ok).toBe(false);
    // 1 initial attempt + 2 retries = 3 total calls (strictly bounded)
    expect(listCalls).toBe(3);
    expect(engine.getRetryCount()).toBe(3);

    engine.dispose();
  });
});
