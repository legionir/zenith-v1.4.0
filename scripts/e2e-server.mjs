// Minimal static file server for the Playwright browser smoke e2e (#79).
// Serves the repository working directory over http://127.0.0.1:8089 so the
// e2e fixture can load real built ESM bundles (packages/*/dist) from disk.
// No third-party deps: it only ever reads files inside the repo and rejects
// path traversal outright.
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const PORT = 8089;
const ROOT = resolve(process.cwd());

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
    res.writeHead(405).end();
    return;
  }
  const requestPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (requestPath === '/e2e/realtime-events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    res.write('data: {"value":42}\n\n');
    const keepAlive = setInterval(() => res.write(': heartbeat\n\n'), 1000);
    res.on('close', () => clearInterval(keepAlive));
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
