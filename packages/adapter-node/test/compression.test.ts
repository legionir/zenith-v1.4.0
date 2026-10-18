import { expect, it } from 'vitest';
import { encodingFor } from '../src/compression';
import { createServer, type Server } from 'node:http';
import { request } from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { serveStatic } from '../src';

it.each([
  ['br, gzip', true, 'br'], ['br;q=0.2,gzip;q=0.9', true, 'gzip'],
  ['br;q=0, gzip;q=0', true, undefined], ['*;q=0', true, false],
  ['gzip;q=0.2, identity;q=0.8', true, undefined], ['br', 'gzip', undefined],
  ['gzip', false, undefined], ['br;q=garbage, gzip', true, 'gzip'],
] as const)('negotiates %s with %s', (header, option, expected) => { expect(encodingFor(header, option)).toBe(expected); });

function close(server: Server) { return new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); }); }
it('streams canonical static middleware as Brotli and gzip with HEAD and Vary parity', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'zenith-encoding-')); const content = 'hello compression '.repeat(1000); await writeFile(join(dir, 'asset.js'), content);
  const handler = serveStatic(dir, { maxAge: 60 });
  const server = createServer((req, res) => { void handler(req, res, () => { res.statusCode = 404; res.end(); }).catch(() => { res.destroy(); }); });
  try {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); const address = server.address(); if (!address || typeof address === 'string') throw new Error('No test address');
    for (const encoding of ['br', 'gzip'] as const) {
      const response = await new Promise<{ bytes: Buffer; encoding: string | undefined; vary: string | undefined }>((resolve, reject) => {
        const req = request(`http://127.0.0.1:${address.port}/asset.js`, { headers: { 'accept-encoding': encoding } }, res => {
          const chunks: Buffer[] = []; res.on('data', chunk => chunks.push(Buffer.from(chunk))); res.on('end', () => resolve({ bytes: Buffer.concat(chunks), encoding: res.headers['content-encoding'], vary: res.headers.vary })); res.on('error', reject);
        }); req.on('error', reject); req.end();
      });
      expect(response.encoding).toBe(encoding); expect(response.vary).toContain('Accept-Encoding'); expect((encoding === 'br' ? brotliDecompressSync : gunzipSync)(response.bytes).toString()).toBe(content);
    }
    const unacceptable = await fetch(`http://127.0.0.1:${address.port}/asset.js`, { headers: { 'accept-encoding': '*;q=0' } }); expect(unacceptable.status).toBe(406);
    const head = await fetch(`http://127.0.0.1:${address.port}/asset.js`, { method: 'HEAD', headers: { 'accept-encoding': 'br' } }); expect(head.headers.get('content-encoding')).toBe('br'); expect(await head.text()).toBe('');
  } finally { await close(server); await rm(dir, { recursive: true, force: true }); }
});
