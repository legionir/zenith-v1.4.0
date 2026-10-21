/**
 * @zenith/language-server — stdio transport with LSP framing (#160).
 *
 * `Content-Length` framing over byte counts (multibyte-safe via
 * `TextEncoder`), so Persian template text survives the pipe. The framing
 * core is pure (`encodeLspMessage`, `decodeLspMessages`,
 * `createLspMessageBuffer`) and tested over memory streams; `node:stream`
 * appears only as `import type`, mirroring the other node-target tooling
 * packages. A malformed or hostile byte stream can never crash the server:
 * unparseable payloads go to `onProtocolError` and the buffer keeps its
 * unconsumed tail.
 */
import type { Readable, Writable } from 'node:stream';
import type { ZenithLanguageServer } from './server.js';

const HEADER_SEPARATOR = '\r\n\r\n';

/**
 * Frame a payload as an LSP message (`Content-Length` counts UTF-8 bytes).
 *
 * @public
 */
export function encodeLspMessage(payload: unknown): string {
  const body = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(body).length;
  return `Content-Length: ${bytes}${HEADER_SEPARATOR}${body}`;
}

/**
 * Split complete message bodies off a buffer tail. Incomplete or
 * header-less tails return untouched as `rest`.
 *
 * @public
 */
export function decodeLspMessages(buffer: string): { messages: string[]; rest: string } {
  const bytes = new TextEncoder().encode(buffer);
  const decoder = new TextDecoder();
  const messages: string[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    let headerEnd = -1;
    for (let i = offset; i + 3 < bytes.length; i++) {
      const a = bytes[i] ?? 0;
      if (a === 13 && (bytes[i + 1] ?? 0) === 10 && (bytes[i + 2] ?? 0) === 13 && (bytes[i + 3] ?? 0) === 10) {
        headerEnd = i;
        break;
      }
    }
    if (headerEnd === -1) break;
    const header = decoder.decode(bytes.slice(offset, headerEnd));
    const lengthMatch = /content-length:\s*(\d+)/i.exec(header);
    if (lengthMatch === null) break;
    const length = Number(lengthMatch[1]);
    if (!Number.isSafeInteger(length)) break;
    const bodyStart = headerEnd + 4;
    if (bytes.length < bodyStart + length) break;
    messages.push(decoder.decode(bytes.slice(bodyStart, bodyStart + length)));
    offset = bodyStart + length;
  }
  return { messages, rest: decoder.decode(bytes.slice(offset)) };
}

/** Incremental framing buffer. @public */
export interface LspMessageBuffer {
  push(chunk: string): string[];
}

/**
 * Create an incremental buffer: feed arbitrary pipe chunks, receive whole
 * message bodies.
 *
 * @public
 */
export function createLspMessageBuffer(): LspMessageBuffer {
  let tail = '';
  return {
    push(chunk: string): string[] {
      tail += chunk;
      const { messages, rest } = decodeLspMessages(tail);
      tail = rest;
      return messages;
    },
  };
}

/** stdio transport options. @public */
export interface ZenithStdioTransportOptions {
  /** Malformed-payload sink (never the host console). */
  onProtocolError?: (message: string) => void;
}

/** An attached stdio transport. @public */
export interface LspStdioTransport {
  dispose(): void;
}

/**
 * Attach a language server to stdio streams. JSON-RPC responses are framed
 * and written back; notifications return nothing. Every failure mode —
 * unparseable JSON, a throwing writer, a disposed server — is contained.
 *
 * @public
 */
export function attachStdioTransport(
  server: ZenithLanguageServer,
  stdin: Readable,
  stdout: Writable,
  options?: ZenithStdioTransportOptions,
): LspStdioTransport {
  const buffer = createLspMessageBuffer();
  const onProtocolError = options?.onProtocolError;
  const report = (message: string): void => {
    try {
      onProtocolError?.(message);
    } catch {
      // A reporting sink must never break the transport.
    }
  };
  const onData = (chunk: unknown): void => {
    const text = typeof chunk === 'string' ? chunk : String(chunk);
    let bodies: string[];
    try {
      bodies = buffer.push(text);
    } catch (error) {
      report(`framing failed: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    for (const body of bodies) {
      let message: unknown;
      try {
        message = JSON.parse(body);
      } catch (error) {
        report(`unparseable payload: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
      let response;
      try {
        response = server.handleMessage(message);
      } catch (error) {
        report(`handler threw: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
      if (response === null) continue;
      try {
        stdout.write(encodeLspMessage(response));
      } catch (error) {
        report(`write failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  };
  stdin.on('data', onData);
  return {
    dispose() {
      stdin.off('data', onData);
    },
  };
}
