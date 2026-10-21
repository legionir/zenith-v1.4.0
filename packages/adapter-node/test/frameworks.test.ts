import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '@zenith/runtime-core';
import {
  createExpressMiddleware,
  createFastifyHandler,
  createNodeHandler,
  toExpressMiddleware,
  toFastifyHandler,
  type NodeHandlerOptions,
} from '../src';

const template = '<main id="app"><!--zen-outlet--><h1 zen-text="title"></h1></main>';
const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())))));
});

function baseOptions(extra: Partial<NodeHandlerOptions> = {}): NodeHandlerOptions {
  return { template, app: () => createApp(), state: { title: 'Framework' }, ...extra };
}

function listen(handler: (req: IncomingMessage, res: ServerResponse) => void): Promise<string> {
  const server = createServer(handler);
  servers.push(server);
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') return reject(new Error('expected a TCP address'));
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

describe('Express middleware adapter', () => {
  it('renders through an Express-style (req, res, next) chain', async () => {
    const middleware = createExpressMiddleware(baseOptions());
    const base = await listen((req, res) => middleware(req, res, () => {
      res.statusCode = 404;
      res.end('miss');
    }));
    const response = await fetch(base);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('Framework');
    expect(html).not.toContain('zen-outlet');
    expect(response.headers.get('content-security-policy')).toContain('nonce-');
  });

  it('forwards route misses to next() without ending the response', async () => {
    const middleware = toExpressMiddleware(createNodeHandler(baseOptions({ routes: ['/allowed'] })));
    const next = vi.fn((..._args: unknown[]) => {});
    const base = await listen((req, res) => middleware(req, res, (...args: unknown[]) => {
      next(...args);
      res.statusCode = 404;
      res.end('miss');
    }));
    const response = await fetch(`${base}/elsewhere`);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('miss');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('forwards unexpected wrapper rejections to next(error)', async () => {
    const failing = toExpressMiddleware(() => Promise.reject(new Error('boom')) as never);
    const seen: unknown[] = [];
    await new Promise<void>(resolve => {
      failing({}, {}, (error?: unknown) => {
        seen.push(error);
        resolve();
      });
    });
    expect(seen).toHaveLength(1);
    expect(String((seen[0] as Error)?.message ?? seen[0])).toContain('boom');
  });
});

describe('Fastify route adapter', () => {
  it('renders through Fastify-style { raw } shells with hijack', async () => {
    const handler = createFastifyHandler(baseOptions());
    const base = await listen((req, res) => {
      const hijack = vi.fn();
      handler({ raw: req }, { raw: res, hijack });
      expect(hijack).toHaveBeenCalledTimes(1);
    });
    const response = await fetch(base);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Framework');
  });

  it('translates a route miss to reply.callNotFound()', async () => {
    const handler = toFastifyHandler(createNodeHandler(baseOptions({ routes: ['/allowed'] })));
    const base = await listen((req, res) => {
      handler({ raw: req }, {
        raw: res,
        callNotFound: () => {
          res.statusCode = 404;
          res.end('miss');
        },
      });
    });
    const response = await fetch(`${base}/elsewhere`);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('miss');
  });

  it('leaves the reply untouched on a miss when callNotFound is absent', async () => {
    const handler = toFastifyHandler(createNodeHandler(baseOptions({ routes: ['/allowed'] })));
    let finished = false;
    const base = await listen((req, res) => {
      handler({ raw: req }, { raw: res });
      setTimeout(() => {
        if (!res.writableEnded && !res.destroyed) {
          finished = true;
          res.statusCode = 404;
          res.end('owner-404');
        }
      }, 50);
    });
    const response = await fetch(`${base}/elsewhere`);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('owner-404');
    expect(finished).toBe(true);
  });
});
