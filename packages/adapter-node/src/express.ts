import type { IncomingMessage, ServerResponse } from 'node:http';
import { createNodeHandler, type NodeHandler, type NodeHandlerOptions } from './handler';

/** Minimal Express-compatible middleware shape; Express is not a dependency. @public */
export type ExpressMiddleware = (
  req: unknown,
  res: unknown,
  next: (error?: unknown) => void,
) => void;

/**
 * Adapt a canonical Node handler to Express 4/5 middleware.
 *
 * The framework objects are used structurally as `IncomingMessage` /
 * `ServerResponse`; no Express APIs are called, so no Express version is
 * required or imported. Route misses propagate through `next()` exactly as the
 * shared handler does; unexpected wrapper rejections are forwarded to
 * `next(error)` for Express error middleware.
 *
 * @public
 */
export function toExpressMiddleware(handler: NodeHandler): ExpressMiddleware {
  return (req, res, next) => {
    try {
      const done = (handler as unknown as (
        request: IncomingMessage,
        response: ServerResponse,
        proceed?: () => void,
      ) => Promise<void>)(
        req as IncomingMessage,
        res as ServerResponse,
        next,
      );
      void Promise.resolve(done).catch(next);
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Build the shared handler once and expose it as Express middleware.
 * Option validation still throws synchronously at construction. @public
 */
export function createExpressMiddleware(options: NodeHandlerOptions): ExpressMiddleware {
  return toExpressMiddleware(createNodeHandler(options));
}
