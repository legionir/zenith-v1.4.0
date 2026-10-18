import { createServer, type Server } from 'node:http';
import type { Socket } from 'node:net';
import { createReservedError } from '@zenith/errors';
import { logger } from '@zenith/logger';
import type { Disposable } from '@zenith/shared';
import { createNodeHandler, type NodeHandler, type NodeHandlerOptions } from './handler';
/** @public */
export interface NodeServerOptions extends NodeHandlerOptions {
  port?: number; host?: string;
  /** Drain deadline in milliseconds. @default 10000 */
  gracefulShutdownTimeout?: number;
  /** @deprecated Use gracefulShutdownTimeout. */
  shutdownTimeout?: number;
}
/** @public */
export interface NodeAddress { port: number; host: string; }
/** No process signal handlers are installed implicitly. @public */
export interface NodeServer extends Disposable {
  readonly server: Server; readonly handler: NodeHandler;
  /** Configured-address overload retained for compatibility. */
  listen(): Promise<NodeAddress>;
  listen(port: number, host?: string): Promise<void>;
  close(): Promise<void>;
}
function invalid(expected: string) { return createReservedError('ZEN-1001', { details: { expected } }); }
function validatePort(port: number): void { if (!Number.isInteger(port) || port < 0 || port > 65535) throw invalid('a port in 0..65535'); }
/** Drain connections at most once; deadline also destroys upgraded sockets. @public */
export function createNodeServer(options: NodeServerOptions): NodeServer {
  const { port: configuredPort, host: configuredHost, gracefulShutdownTimeout, shutdownTimeout, ...handlerOptions } = options;
  validatePort(configuredPort ?? 3000);
  const timeout = gracefulShutdownTimeout ?? shutdownTimeout ?? 10000;
  if (!Number.isFinite(timeout) || timeout < 0 || timeout > 2147483647) throw invalid('a nonnegative gracefulShutdownTimeout');
  const handler = createNodeHandler(handlerOptions); const sockets = new Set<Socket>();
  const server = createServer((req, res) => { void handler(req, res).catch(() => { if (!res.destroyed) res.destroy(); }); });
  server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
  let disposed = false; let closing: Promise<void> | undefined;
  let starting: { port: number; host: string; promise: Promise<NodeAddress> } | undefined;
  const address = (): NodeAddress => { const value = server.address(); if (!value || typeof value === 'string') throw invalid('a listening TCP server'); return { port: value.port, host: value.address }; };
  function listen(): Promise<NodeAddress>;
  function listen(port: number, host?: string): Promise<void>;
  async function listen(port?: number, host?: string): Promise<NodeAddress | void> {
    if (disposed) throw invalid('a server that has not been disposed');
    const selectedPort = port ?? configuredPort ?? 3000, selectedHost = host ?? configuredHost ?? '0.0.0.0'; validatePort(selectedPort);
    let result: NodeAddress;
    if (server.listening) {
      result = address(); if (port !== undefined && port !== 0 && result.port !== port) throw invalid('the already-listening port');
    } else if (starting) {
      if (starting.port !== selectedPort || starting.host !== selectedHost) throw invalid('one consistent concurrent listen address');
      result = await starting.promise;
    } else {
      const promise = new Promise<NodeAddress>((resolveListen, reject) => {
        const failed = (error: Error) => { server.off('listening', ready); reject(error); };
        const ready = () => { server.off('error', failed); resolveListen(address()); };
        server.once('error', failed); server.once('listening', ready);
        try { server.listen(selectedPort, selectedHost); } catch (error) { server.off('error', failed); server.off('listening', ready); reject(error); }
      });
      starting = { port: selectedPort, host: selectedHost, promise };
      try { result = await promise; } finally { starting = undefined; }
    }
    if (port === undefined) return result;
    return;
  }
  const close = (): Promise<void> => {
    if (closing) return closing; disposed = true;
    closing = (async () => {
      if (starting) { try { await starting.promise; } catch { return; } }
      if (!server.listening) return;
      await new Promise<void>((resolveClose, reject) => {
        const deadline = setTimeout(() => { for (const socket of sockets) socket.destroy(); server.closeAllConnections(); }, timeout); deadline.unref();
        server.close(error => { clearTimeout(deadline); if (error) reject(error); else resolveClose(); }); server.closeIdleConnections();
      });
    })(); return closing;
  };
  return { server, handler, listen, close, dispose() { void close().catch(() => { try { logger.error('Node server shutdown failed.'); } catch {} }); } };
}
