import { format } from 'node:util';
import { AsyncLocalStorage } from 'node:async_hooks';
import { CliFailure, CliDataError, exitCode } from './failure';

interface Session {
  command: string; json: boolean; messages: string[]; errors: string[];
  data: unknown; code: 0 | 1 | 2; retained: number; truncated: boolean;
}
const sessions = new AsyncLocalStorage<Session>();
const MAX_CAPTURE = 256 * 1024;
function write(kind: 'messages' | 'errors', text: string): void {
  const session = sessions.getStore();
  if (session?.json) {
    const available = MAX_CAPTURE - session.retained;
    if (available > 0) { session[kind].push(text.slice(0, available)); session.retained += Math.min(text.length, available); }
    if (text.length > available) session.truncated = true;
  } else (kind === 'messages' ? process.stdout : process.stderr).write(text + '\n');
}
/** CLI data is independent of logger level; JSON mode emits exactly one envelope. */
export const output = {
  line(...values: unknown[]): void { write('messages', format(...values)); },
  error(...values: unknown[]): void { write('errors', format(...values)); },
  json(value: unknown): void {
    const text = JSON.stringify(value);
    if (text === undefined) throw new CliDataError('CLI data must be JSON-serializable.');
    if (sessions.getStore()) output.result(value); else process.stdout.write(text + '\n');
  },
  result(value: unknown): void { const session = sessions.getStore(); if (session) session.data = value; },
  status(code: number): void { const session = sessions.getStore(); if (session) session.code = exitCode(code); else process.exitCode = exitCode(code); },
  command(name: string): void { const session = sessions.getStore(); if (session) session.command = name; },
  isJson(): boolean { return sessions.getStore()?.json ?? false; },
};
/** Each invocation has isolated capture; library callers do not mutate process.exitCode. */
export async function withOutputSession(command: string, json: boolean, action: () => Promise<void>): Promise<0 | 1 | 2> {
  const session: Session = { command, json, messages: [], errors: [], data: null, code: 0, retained: 0, truncated: false };
  return sessions.run(session, async () => {
    try { await action(); }
    catch (error) { session.code = error instanceof CliFailure ? error.exitCode : 2; output.error(error instanceof Error ? error.message : 'CLI infrastructure failed.'); }
    if (json) {
      try {
        process.stdout.write(JSON.stringify({ schemaVersion: 1, command: session.command, ok: session.code === 0, exitCode: session.code, data: session.data, messages: session.messages, errors: session.errors, truncated: session.truncated }) + '\n');
      } catch {
        session.code = 2;
        process.stdout.write(JSON.stringify({ schemaVersion: 1, command: session.command, ok: false, exitCode: 2, data: null, messages: [], errors: ['CLI result serialization failed.'], truncated: false }) + '\n');
      }
    }
    return session.code;
  });
}
