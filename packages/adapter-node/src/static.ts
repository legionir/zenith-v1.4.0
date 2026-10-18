import type { IncomingMessage, ServerResponse } from 'node:http';
import { realpath, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { resolve, relative, extname, isAbsolute } from 'node:path';
import { createGzip, createBrotliCompress } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { createReservedError } from '@zenith/errors';
import { encodingFor, type Compression } from './compression';
/** Static middleware options. maxAge is seconds; default zero. @public */
export interface StaticOptions { prefix?: string; maxAge?: number; immutable?: boolean; compression?: Compression; etag?: boolean; }
/** @public */
export type StaticHandler = (req: IncomingMessage, res: ServerResponse, next?: () => void) => Promise<boolean>;
const contentTypes: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
function within(root: string, file: string): boolean { const path = relative(root, file); return path !== '..' && !path.startsWith('../') && !path.startsWith('..\\') && !isAbsolute(path); }
/** Traversal/symlink-safe streaming middleware; false means a clean miss. @public */
export function serveStatic(directory: string, options?: StaticOptions): StaticHandler;
/** @deprecated Use serveStatic(directory, options). */
export function serveStatic(options: StaticOptions & { root: string }): StaticHandler;
export function serveStatic(input: string | (StaticOptions & { root: string }), settings: StaticOptions = {}): StaticHandler {
  const options = typeof input === 'string' ? settings : input;
  const root = typeof input === 'string' ? input : input.root;
  if (typeof root !== 'string' || !root.trim()) throw createReservedError('ZEN-1001', { details: { expected: 'a nonempty static directory' } });
  const configuredRoot = resolve(root); const prefix = (options.prefix ?? '/').replace(/\/+$/, '') || '/';
  if (!prefix.startsWith('/') || prefix.includes('?') || prefix.includes('#') || !Number.isFinite(options.maxAge ?? 0) || (options.maxAge ?? 0) < 0 || ![undefined, true, false, 'gzip', 'br'].includes(options.compression)) throw createReservedError('ZEN-1001', { details: { expected: 'valid static options' } });
  return async (req, res, next): Promise<boolean> => {
    const miss = () => { next?.(); return false; };
    if (req.method !== 'GET' && req.method !== 'HEAD') return miss();
    const raw = (req.url ?? '/').split('?')[0]!; let pathname: string;
    try { pathname = decodeURIComponent(raw); } catch { res.writeHead(400).end(); return true; }
    if (pathname.includes('\0') || pathname.includes('\\') || pathname.split('/').some(segment => segment === '..')) { res.writeHead(403).end(); return true; }
    if (prefix !== '/' && pathname !== prefix && !pathname.startsWith(prefix + '/')) return miss();
    const local = pathname.slice(prefix === '/' ? 1 : prefix.length).replace(/^\/+/, '');
    if (local.split('/').some(segment => segment.startsWith('.'))) { res.writeHead(403).end(); return true; }
    try {
      const actualRoot = await realpath(configuredRoot); const file = await realpath(resolve(actualRoot, local));
      if (!within(actualRoot, file)) { res.writeHead(403).end(); return true; }
      const info = await stat(file); if (!info.isFile()) return miss();
      const etag = `W/"${info.size.toString(16)}-${info.mtimeMs.toString(16)}"`;
      if (options.etag !== false) res.setHeader('ETag', etag);
      res.setHeader('Last-Modified', info.mtime.toUTCString());
      res.setHeader('Cache-Control', `public, max-age=${Math.floor(options.maxAge ?? 0)}${options.immutable ? ', immutable' : ''}`);
      const contentType = contentTypes[extname(file).toLowerCase()] ?? 'application/octet-stream';
      res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Content-Type', contentType);
      res.setHeader('Vary', 'Accept-Encoding');
      const noneMatch = req.headers['if-none-match'];
      if (options.etag !== false && (noneMatch === '*' || noneMatch?.split(',').some(value => value.trim().replace(/^W\//, '') === etag.replace(/^W\//, '')))) { res.writeHead(304).end(); return true; }
      const compressible = /^(?:text\/|application\/(?:json|wasm|javascript|xml)|image\/svg\+xml)/.test(contentType);
      const encoding = encodingFor(req.headers['accept-encoding'], compressible ? options.compression ?? true : false);
      if (encoding === false) { res.statusCode = 406; res.end(); return true; }
      if (encoding) res.setHeader('Content-Encoding', encoding); else res.setHeader('Content-Length', info.size);
      res.statusCode = 200; if (req.method === 'HEAD') { res.end(); return true; }
      const source = createReadStream(file);
      try { if (encoding) await pipeline(source, encoding === 'br' ? createBrotliCompress() : createGzip(), res); else await pipeline(source, res); }
      catch (error) { if (!res.destroyed) res.destroy(error instanceof Error ? error : undefined); }
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT' || (error as NodeJS.ErrnoException).code === 'ENOTDIR') return miss();
      throw error;
    }
  };
}
