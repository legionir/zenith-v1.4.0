import type { IncomingMessage, ServerResponse } from 'node:http';
import { createNodeHandler, type NodeHandler, type NodeHandlerOptions } from './handler';

/** Minimal Fastify request shape; only `raw` is consumed. Fastify is not a dependency. @public */
export interface FastifyRawRequest {
  readonly raw: IncomingMessage;
}

/** Minimal Fastify reply shape; only `raw` plus optional helpers are used. @public */
export interface FastifyRawReply {
  readonly raw: ServerResponse;
  hijack?(): void;
  callNotFound?(): void;
  send?(payload: unknown): unknown;
}

/** Fastify-compatible `(request, reply)` handler shape. @public */
export type FastifyHandler = (request: FastifyRawRequest, reply: FastifyRawReply) => void;

/**
 * Adapt a canonical Node handler to a Fastify route handler.
 *
 * `reply.hijack()` is invoked when available so the shared handler owns the raw
 * response stream (compression, backpressure, error redaction). A route miss —
 * the shared handler calling `next()` — is translated to `reply.callNotFound()`
 * when available, otherwise the reply is left untouched for Fastify's own 404.
 * Unexpected wrapper rejections are forwarded to `reply.send(error)` only when
 * headers are not yet sent.
 *
 * @public
 */
export function toFastifyHandler(handler: NodeHandler): FastifyHandler {
  const invoke = handler as unknown as (
    request: IncomingMessage,
    response: ServerResponse,
    proceed?: () => void,
  ) => Promise<void>;
  return (request, reply) => {
    try {
      reply.hijack?.();
    } catch {
      /* A hijack failure must not prevent the shared handler from running. */
    }
    let missed = false;
    const next = (): void => {
      missed = true;
    };
    let done: Promise<void>;
    try {
      done = invoke(request.raw, reply.raw, next);
    } catch (error) {
      try {
        if (!reply.raw.headersSent && !reply.raw.destroyed) reply.send?.(error);
      } catch {
        /* Fall through; the raw stream is the last resort below. */
      }
      return;
    }
    void Promise.resolve(done).then(
      () => {
        if (missed && !reply.raw.headersSent && !reply.raw.destroyed) {
          try {
            reply.callNotFound?.();
          } catch {
            /* Fastify owns 404 rendering from here. */
          }
        }
      },
      (error: unknown) => {
        try {
          if (!reply.raw.headersSent && !reply.raw.destroyed) reply.send?.(error);
        } catch {
          /* The shared handler already redacts its own failures. */
        }
      },
    );
  };
}

/**
 * Build the shared handler once and expose it as a Fastify route handler.
 * Option validation still throws synchronously at construction. @public
 */
export function createFastifyHandler(options: NodeHandlerOptions): FastifyHandler {
  return toFastifyHandler(createNodeHandler(options));
}
