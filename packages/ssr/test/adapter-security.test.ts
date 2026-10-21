// @vitest-environment node
import { EventEmitter } from 'node:events';
import { createServer, request as httpRequest } from 'node:http';
import { once } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '@zenith/runtime-core';
import { createFetchHandler, createNodeHandler, renderToString } from '../src/index';

const TEMPLATE = '<main><h1>Adapter security regression</h1></main>';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function nodeResponse() {
  return Object.assign(new EventEmitter(), {
    statusCode: 200,
    writableEnded: false,
    setHeader: vi.fn(),
    end: vi.fn(),
  });
}

function extractNonce(html: string, csp: string) {
  const htmlNonce = /<script nonce="([^"]+)"/.exec(html)?.[1];
  expect(htmlNonce).toMatch(/^[A-Za-z0-9+/]{22}==$/); // 16 random bytes, base64
  expect(csp).toContain(`'nonce-${htmlNonce}'`);
  return htmlNonce;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SSR adapter per-response CSP nonces (#156, #157)', () => {
  it('generates independent CSPRNG nonces for concurrent Node responses', async () => {
    const handler = createNodeHandler({ template: TEMPLATE, csp: { nonce: true } });
    const responses = await Promise.all(
      Array.from({ length: 16 }, async () => {
        const res = nodeResponse();
        await handler({ url: '/' }, res);
        expect(res.statusCode).toBe(200);
        const csp = res.setHeader.mock.calls.find(
          ([name]) => name === 'Content-Security-Policy',
        )?.[1];
        return extractNonce(res.end.mock.calls[0]?.[0], csp);
      }),
    );
    expect(new Set(responses).size).toBe(16);
  });

  it('generates independent CSPRNG nonces for Fetch responses', async () => {
    const handler = createFetchHandler({ template: TEMPLATE, csp: { nonce: true } });
    const nonces = await Promise.all(
      Array.from({ length: 8 }, async () => {
        const res = await handler(new Request('https://example.test/'));
        expect(res.status).toBe(200);
        return extractNonce(await res.text(), res.headers.get('Content-Security-Policy')!);
      }),
    );
    expect(new Set(nonces).size).toBe(8);
  });

  it.each(['node', 'fetch'] as const)(
    'substitutes {{nonce}} consistently in a custom %s policy',
    async (kind) => {
      const options = {
        template: TEMPLATE,
        csp: {
          nonce: true,
          policy: "default-src 'none'; script-src 'nonce-{{nonce}}'; style-src 'nonce-{{nonce}}'",
        },
      };
      let html: string;
      let csp: string;
      if (kind === 'node') {
        const res = nodeResponse();
        await createNodeHandler(options)({ url: '/' }, res);
        html = res.end.mock.calls[0][0];
        csp = res.setHeader.mock.calls.find(([name]) => name === 'Content-Security-Policy')![1];
      } else {
        const res = await createFetchHandler(options)(new Request('https://example.test/'));
        html = await res.text();
        csp = res.headers.get('Content-Security-Policy')!;
      }
      const nonce = extractNonce(html, csp);
      expect(csp).not.toContain('{{nonce}}');
      expect(csp.match(new RegExp(`nonce-${nonce!.replace(/[+]/g, '\\+')}`, 'g'))).toHaveLength(2);
    },
  );

  it('does not add a nonce or CSP header when nonce mode is disabled', async () => {
    const res = await createFetchHandler({ template: TEMPLATE })(
      new Request('https://example.test/'),
    );
    expect(res.headers.has('Content-Security-Policy')).toBe(false);
    expect(await res.text()).not.toContain('nonce=');
  });
});

describe('SSR rendering cancellation (#156, #157)', () => {
  it('rejects an already-aborted string render before allocating/mounting an App', async () => {
    const controller = new AbortController();
    controller.abort();
    const app = vi.fn(() => createApp());
    await expect(
      renderToString(TEMPLATE, {}, { signal: controller.signal, app }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(app).not.toHaveBeenCalled();
  });

  it('checks cancellation again after async DOM implementation loading', async () => {
    const controller = new AbortController();
    const component = vi.fn(() => '<p>Must not start</p>');
    const app = vi.fn(() => createApp());
    const rendering = renderToString(
      '<main><zen-server-component name="slow"></zen-server-component></main>',
      {},
      { signal: controller.signal, app, serverComponents: { slow: component } },
    );
    // The call is suspended in its dynamic import; cancellation must be
    // rechecked before starting the component prepass when it resumes.
    controller.abort();
    await expect(rendering).rejects.toMatchObject({ name: 'AbortError' });
    expect(component).not.toHaveBeenCalled();
    expect(app).not.toHaveBeenCalled();
  });

  it('aborts a pending server-component prepass without late DOM/App work', async () => {
    const entered = deferred<void>();
    const release = deferred<string>();
    const controller = new AbortController();
    const app = vi.fn(() => createApp());
    const createDOM = vi.fn();
    const rendering = renderToString(
      '<main><zen-server-component name="slow"></zen-server-component></main>',
      {},
      {
        signal: controller.signal,
        app,
        createDOM,
        serverComponents: {
          slow: () => {
            entered.resolve();
            return release.promise;
          },
        },
      },
    );
    await entered.promise;
    controller.abort();
    await expect(rendering).rejects.toMatchObject({ name: 'AbortError' });
    release.resolve('<p>Too late</p>');
    await release.promise;
    await new Promise<void>((r) => setImmediate(r));
    expect(createDOM).not.toHaveBeenCalled();
    expect(app).not.toHaveBeenCalled();
  });

  it('does not render or write to an already aborted Node request, and removes listeners', async () => {
    const req = Object.assign(new EventEmitter(), { url: '/', aborted: true });
    const res = nodeResponse();
    const state = vi.fn(() => ({}));
    await createNodeHandler({ template: TEMPLATE, state })(req, res);
    expect(state).not.toHaveBeenCalled();
    expect(res.end).not.toHaveBeenCalled();
    expect(req.listenerCount('aborted')).toBe(0);
    expect(res.listenerCount('close')).toBe(0);
  });

  it('cancels waiting for Node state when the response connection closes', async () => {
    const entered = deferred<void>();
    const state = deferred<Record<string, unknown>>();
    const req = Object.assign(new EventEmitter(), { url: '/' });
    const res = nodeResponse();
    const app = vi.fn(() => createApp());
    const handling = createNodeHandler({
      template: TEMPLATE,
      app,
      state: () => {
        entered.resolve();
        return state.promise;
      },
    })(req, res);
    await entered.promise;
    res.emit('close');
    await handling;
    state.resolve({});
    await state.promise;
    expect(app).not.toHaveBeenCalled();
    expect(res.end).not.toHaveBeenCalled();
    expect(req.listenerCount('aborted')).toBe(0);
    expect(res.listenerCount('close')).toBe(0);
  });

  it('removes Node event listeners on success and failure', async () => {
    for (const fail of [false, true]) {
      const req = Object.assign(new EventEmitter(), { url: '/' });
      const res = nodeResponse();
      await createNodeHandler({
        template: TEMPLATE,
        state: () => {
          if (fail) throw new Error('state failed');
          return {};
        },
      })(req, res);
      expect(res.statusCode).toBe(fail ? 500 : 200);
      expect(res.end).toHaveBeenCalledTimes(1);
      expect(req.listenerCount('aborted')).toBe(0);
      expect(res.listenerCount('close')).toBe(0);
    }
  });

  it('does not treat a normally completed IncomingMessage as a client disconnect', async () => {
    const entered = deferred<void>();
    const state = deferred<Record<string, unknown>>();
    const done = deferred<void>();
    const handler = createNodeHandler({
      template: TEMPLATE,
      state: () => {
        entered.resolve();
        return state.promise;
      },
    });
    const server = createServer((req, res) => {
      req.resume();
      void handler(req, res).finally(() => done.resolve());
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No test port');
    try {
      const response = new Promise<string>((resolve, reject) => {
        const req = httpRequest({ hostname: '127.0.0.1', port: address.port, path: '/' }, (res) => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk: string) => {
            body += chunk;
          });
          res.on('end', () => resolve(body));
        });
        req.on('error', reject);
        req.end();
      });
      await entered.promise;
      state.resolve({});
      expect(await response).toContain('Adapter security regression');
      await done.promise;
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    }
  });

  it('cancels a real Node client disconnect before late state can mount or write', async () => {
    const entered = deferred<void>();
    const state = deferred<Record<string, unknown>>();
    const done = deferred<void>();
    const app = vi.fn(() => createApp());
    const handler = createNodeHandler({
      template: TEMPLATE,
      app,
      state: () => {
        entered.resolve();
        return state.promise;
      },
    });
    const end = vi.fn();
    const server = createServer((req, res) => {
      const originalEnd = res.end.bind(res);
      res.end = ((...args: Parameters<typeof res.end>) => {
        end();
        return originalEnd(...args);
      }) as typeof res.end;
      req.resume();
      void handler(req, res).finally(() => done.resolve());
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No test port');
    const req = httpRequest({ hostname: '127.0.0.1', port: address.port, path: '/' });
    req.on('error', () => {}); // intentional client disconnect / ECONNRESET
    try {
      req.end();
      await entered.promise;
      req.destroy();
      await done.promise;
      state.resolve({});
      await state.promise;
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(app).not.toHaveBeenCalled();
      expect(end).not.toHaveBeenCalled();
    } finally {
      state.resolve({});
      req.destroy();
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it.each(['node', 'fetch'] as const)(
    'handles a state promise that synchronously aborts %s before rejecting',
    async (kind) => {
      const controller = new AbortController();
      const req = Object.assign(new EventEmitter(), { url: '/' });
      const res = nodeResponse();
      const state = () => {
        if (kind === 'node') req.emit('aborted');
        else controller.abort();
        return Promise.reject(new Error('cancelled state failure'));
      };
      const unhandled = vi.fn();
      process.on('unhandledRejection', unhandled);
      try {
        if (kind === 'node') {
          await createNodeHandler({ template: TEMPLATE, state })(req, res);
          expect(res.end).not.toHaveBeenCalled();
        } else {
          await expect(
            createFetchHandler({ template: TEMPLATE, state })(
              new Request('https://example.test/', { signal: controller.signal }),
            ),
          ).rejects.toMatchObject({ name: 'AbortError' });
        }
        await new Promise<void>((resolve) => setImmediate(resolve));
        expect(unhandled).not.toHaveBeenCalled();
      } finally {
        process.off('unhandledRejection', unhandled);
      }
    },
  );

  it('propagates Fetch request cancellation during state loading', async () => {
    const controller = new AbortController();
    const entered = deferred<void>();
    const state = deferred<Record<string, unknown>>();
    const app = vi.fn(() => createApp());
    const handler = createFetchHandler({
      template: TEMPLATE,
      app,
      state: () => {
        entered.resolve();
        return state.promise;
      },
    });
    const response = handler(new Request('https://example.test/', { signal: controller.signal }));
    await entered.promise;
    controller.abort();
    await expect(response).rejects.toMatchObject({ name: 'AbortError' });
    state.resolve({});
    await state.promise;
    expect(app).not.toHaveBeenCalled();
  });
});
