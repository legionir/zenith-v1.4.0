// @vitest-environment node
import { expect, it } from 'vitest';
import { Miniflare } from 'miniflare';
import { bundleWorker } from './bundle.mjs';
it('runs 100 isolated requests in an actual Worker with a Node-free deployment bundle', async () => {
  const bundle = await bundleWorker(); const script = bundle.outputFiles[0].text;
  const inputs = Object.keys(bundle.metafile.inputs);
  expect(inputs.some(path => /(?:node:|node_modules\/(?:jsdom|canvas)\/|ssr\/src\/dom-context)/.test(path))).toBe(false);
  expect(Buffer.byteLength(script)).toBeLessThanOrEqual(1024 * 1024);
  const worker = new Miniflare({ modules: true, script, compatibilityDate: '2026-07-01' });
  try {
    const results = await Promise.all(Array.from({ length: 100 }, async (_, index) => {
      const response = await worker.dispatchFetch(`https://worker.example/request-${index}`); return { index, response, html: await response.text() };
    }));
    const nonces = new Set();
    for (const { index, response, html } of results) {
      expect(response.status).toBe(200); expect(html).toContain(`<h1 zen-text="name">/request-${index}</h1>`); expect(html).toContain(`<title data-zen-head="title">/request-${index}</title>`);
      expect(html).not.toContain('<img src="x" onerror='); const nonce = /'nonce-([^']+)'/.exec(response.headers.get('content-security-policy'))?.[1]; expect(nonce).toBeTruthy(); expect(html).toContain(`nonce="${nonce}"`); nonces.add(nonce);
    }
    expect(nonces.size).toBe(100);
    const head = await worker.dispatchFetch('https://worker.example/head', { method: 'HEAD' }); expect(await head.text()).toBe('');
  } finally { await worker.dispose(); }
}, 30_000);
