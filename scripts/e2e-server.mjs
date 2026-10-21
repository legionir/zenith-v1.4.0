// Minimal static file server for the Playwright browser smoke e2e (#79).
// Serves the repository working directory over http://127.0.0.1:8089 so the
// e2e fixture can load real built ESM bundles (packages/*/dist) from disk.
// No third-party deps: it only ever reads files inside the repo and rejects
// path traversal outright.
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import {
  CSP_FIXTURE_PATH,
  CSP_REPORT_PATH,
  CSP_REPORTS_PATH,
  buildReportingEndpointsHeader,
  buildStrictCspHeader,
  injectFixtureNonce,
} from './csp-fixture-policy.mjs';

const PORT = 8089;
const ROOT = resolve(process.cwd());

// #63 — in-memory store for CSP violation reports (test diagnostics only).
const MAX_CSP_REPORTS = 200;
const cspReports = [];

const CONTENT_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.cjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
]);

// #33 — deterministic products mock (see request handler below).
const ECOMMERCE_PRODUCTS = [
  { id: 1, title: 'کتاب TypeScript', price: 250000 },
  { id: 2, title: 'دوره آنلاین', price: 1500000 },
  { id: 3, title: 'ماوس گیمینگ', price: 850000 },
  { id: 7, title: 'کیبورد مکانیکی', price: 1200000 },
];

const server = createServer(async (req, res) => {
  if (req.method === 'GET' || req.method === 'HEAD') {
    // Browsers automatically request /favicon.ico; it is not a fixture
    // resource, so answer it without letting it surface as a 404 error.
    if (decodeURIComponent((req.url ?? '/').split('?')[0]) === '/favicon.ico') {
      res.writeHead(204).end();
      return;
    }
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    // #63 — CSP violation report collector (report-uri + sendBeacon backup).
    // Reports are kept in memory (capped) for the spec to assert on; they are
    // test diagnostics, never persisted.
    if (req.method === 'POST' && (req.url ?? '').split('?')[0] === CSP_REPORT_PATH) {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 65536) break;
      }
      try {
        const parsed = JSON.parse(body);
        const items = Array.isArray(parsed)
          ? parsed
          : [parsed?.['csp-report'] ?? parsed];
        for (const item of items) {
          if (item && typeof item === 'object' && cspReports.length < MAX_CSP_REPORTS) {
            cspReports.push(item);
          }
        }
      } catch {
        /* malformed report body — ignore, the in-page events are primary */
      }
      res.writeHead(204).end();
      return;
    }
    // #63 — clear collected violation reports between spec cases.
    if (req.method === 'DELETE' && (req.url ?? '').split('?')[0] === CSP_REPORTS_PATH) {
      cspReports.length = 0;
      res.writeHead(204).end();
      return;
    }
    res.writeHead(405).end();
    return;
  }
  const requestPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
  // #63 — strict-CSP fixture: enforced Content-Security-Policy response header
  // (never report-only/meta) with a fresh per-response CSPRNG nonce injected
  // into every {{NONCE}} of e2e/csp-fixture.html. ?violate=1 appends a
  // nonce-less script as the negative control: it must be BLOCKED.
  if (requestPath === CSP_FIXTURE_PATH) {
    const params = new URL(req.url ?? '/', 'http://127.0.0.1').searchParams;
    const nonce = randomBytes(16).toString('base64');
    let html = injectFixtureNonce(
      await readFile(join(ROOT, 'e2e/csp-fixture.html'), 'utf8'),
      nonce,
    );
    if (params.get('violate') === '1') {
      html = html.replace(
        '</body>',
        '<script>window.__ZENITH_CSP_FORCED_VIOLATION__=true;</script>\n</body>',
      );
    }
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': buildStrictCspHeader(nonce),
      'reporting-endpoints': buildReportingEndpointsHeader(),
      'cache-control': 'no-store',
    });
    res.end(req.method === 'HEAD' ? undefined : html);
    return;
  }
  // #63 — list collected violation reports for the spec gate.
  if (requestPath === CSP_REPORTS_PATH) {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(req.method === 'HEAD' ? undefined : JSON.stringify(cspReports));
    return;
  }
  if (requestPath === '/e2e/realtime-events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    res.write('data: {"value":42}\n\n');
    const keepAlive = setInterval(() => res.write(': heartbeat\n\n'), 1000);
    res.on('close', () => clearInterval(keepAlive));
    return;
  }
  // #33 — deterministic products mock for the ecommerce-demo flows. The ids
  // are a subset of the demo store inventory (`ecommerce-demo/src/store.js`:
  // 1:5, 2:3, 3:0, 7:2) so the out-of-stock block (id 3) and checkout
  // decrement are exercised against real stock states, not invented ones.
  // Test-only fixture data, never persisted.
  if (requestPath === '/api/products' || requestPath.startsWith('/api/products/')) {
    const id = requestPath === '/api/products' ? null : requestPath.slice('/api/products/'.length);
    const found = id === null ? ECOMMERCE_PRODUCTS : ECOMMERCE_PRODUCTS.find((p) => String(p.id) === id);
    if (found === undefined) {
      res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ message: 'Not found' }));
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(req.method === 'HEAD' ? undefined : JSON.stringify(found));
    return;
  }
  const fixturePath = requestPath === '/e2e/zenith-mock-sw.js' ? '/packages/mock/dist/worker.js' : requestPath;
  const absPath = join(ROOT, normalize(fixturePath));
  if (!absPath.startsWith(ROOT + '/') && absPath !== ROOT) {
    res.writeHead(403).end('forbidden');
    return;
  }
  try {
    const body = await readFile(absPath);
    res.writeHead(200, {
      'content-type': CONTENT_TYPES.get(extname(absPath)) ?? 'application/octet-stream',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

const sockets = new WebSocketServer({ noServer: true, maxPayload: 1024 });
sockets.on('connection', socket => socket.on('message', frame => socket.send(frame.toString())));
server.on('upgrade', (req, socket, head) => {
  if ((req.url ?? '').split('?')[0] !== '/e2e/realtime-socket') { socket.destroy(); return; }
  sockets.handleUpgrade(req, socket, head, connection => sockets.emit('connection', connection, req));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`e2e static server: http://127.0.0.1:${PORT}`);
});
