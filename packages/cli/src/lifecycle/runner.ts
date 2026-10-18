import { spawn } from 'node:child_process';
import { existsSync, realpathSync, readFileSync } from 'node:fs';
import { join, dirname, delimiter, resolve, relative, isAbsolute } from 'node:path';
import { CliFailure } from '../failure';
import { output } from '../output';
import { projectAt, resolvePackage, object } from './project';

export interface RunnerOptions { cwd?: string; config?: string; host?: string; port?: string; watch?: boolean; timeout?: string; args?: string[]; }
function npmEntry(): string {
  const configured = process.env.npm_execpath;
  if (configured && /(?:^|[\\/])npm-cli\.js$/.test(configured) && existsSync(configured)) return configured;
  for (const directory of (process.env.PATH ?? '').split(delimiter)) {
    if (!directory) continue;
    for (const candidate of [join(directory, 'npm'), join(directory, 'node_modules/npm/bin/npm-cli.js'), join(directory, '../lib/node_modules/npm/bin/npm-cli.js')]) {
      if (!existsSync(candidate)) continue;
      const file = realpathSync(candidate); if (file.endsWith('npm-cli.js')) return file;
    }
  }
  throw new CliFailure('npm is not available. Install npm or invoke Zenith from npm exec.', 2);
}
function toolEntry(root: string, name: 'vite' | 'vitest'): string {
  const file = resolvePackage(root, name); if (!file) throw new CliFailure(`Install ${name} in this project, or provide a package script.`);
  const pkg: unknown = JSON.parse(readFileSync(file, 'utf8'));
  const bin = object(pkg) ? pkg.bin : undefined; const entry = typeof bin === 'string' ? bin : object(bin) ? bin[name] : undefined;
  if (typeof entry !== 'string') throw new CliFailure(`Invalid ${name} executable.`, 2);
  const target = resolve(dirname(file), entry); const path = relative(dirname(file), target);
  if (path.startsWith('..') || isAbsolute(path) || !existsSync(target)) throw new CliFailure(`Missing ${name} executable. Reinstall dependencies.`, 2);
  return target;
}
/** No shell interpolation; npm executes only the project's explicitly trusted script. */
export function runnerInvocation(command: 'dev' | 'build' | 'test', options: RunnerOptions): { cwd: string; executable: string; args: string[] } {
  const { root, manifest } = projectAt(options.cwd); const script = manifest.scripts?.[command]; const extra = [...(options.args ?? [])];
  if (options.config) { if (!existsSync(resolve(root, options.config))) throw new CliFailure(`Config does not exist: ${options.config}`); extra.push('--config', options.config); }
  if (command === 'dev') {
    if (options.host) extra.push('--host', options.host); else if (!script) extra.push('--host', '0.0.0.0');
    if (options.port !== undefined) { if (!/^\d+$/.test(options.port) || Number(options.port) > 65535) throw new CliFailure('Port must be an integer from 0 to 65535.'); extra.push('--port', options.port); }
  }
  if (command === 'test' && options.watch && script && /\bvitest\s+run\b/.test(script)) throw new CliFailure('The test script explicitly uses vitest run. Use a watch-capable script before --watch.');
  if (command === 'test' && (options.watch || !script || /\bvitest\b/.test(script))) extra.push(options.watch ? '--watch' : '--run');
  if (script) {
    if (/\bzenith\s+(?:dev|build|test)\b/.test(script)) throw new CliFailure(`Recursive ${command} script. Use a concrete tool (vite, vitest, or your server).`);
    return { cwd: root, executable: process.execPath, args: [npmEntry(), 'run', command, '--', ...extra] };
  }
  return { cwd: root, executable: process.execPath, args: [toolEntry(root, command === 'test' ? 'vitest' : 'vite'), ...(command === 'build' ? ['build'] : []), ...extra] };
}
/** Forward interruption to the whole POSIX process group, then force-kill at a deadline. */
export async function runLifecycle(command: 'dev' | 'build' | 'test', options: RunnerOptions): Promise<void> {
  const timeout = options.timeout === undefined ? 0 : Number(options.timeout);
  if ((options.timeout !== undefined && !/^\d+$/.test(options.timeout)) || !Number.isSafeInteger(timeout) || timeout < 0 || timeout > 2147483647) throw new CliFailure('Timeout must be an integer in 0..2147483647 milliseconds.');
  const invocation = runnerInvocation(command, options);
  await new Promise<void>((done, reject) => {
    const child = spawn(invocation.executable, invocation.args, { cwd: invocation.cwd, shell: false, detached: process.platform !== 'win32', stdio: ['inherit', 'pipe', 'pipe'] });
    let interrupted = false, expired = false, spawnFailed: Error | undefined; let force: ReturnType<typeof setTimeout> | undefined;
    const kill = (signal: NodeJS.Signals) => {
      if (!child.pid) return;
      try {
        if (process.platform !== 'win32') process.kill(-child.pid, signal);
        else { const terminator = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { shell: false, stdio: 'ignore' }); terminator.on('error', () => { child.kill(signal); }); }
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') output.error('Unable to signal child process.'); }
    };
    const stop = (signal: NodeJS.Signals) => { interrupted = true; kill(signal); if (!force) force = setTimeout(() => kill('SIGKILL'), 2000); };
    const interrupt = () => stop('SIGINT'), terminate = () => stop('SIGTERM');
    process.on('SIGINT', interrupt); process.on('SIGTERM', terminate);
    const deadline = timeout ? setTimeout(() => { expired = true; stop('SIGTERM'); }, timeout) : undefined;
    child.stdout?.setEncoding('utf8'); child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (text: string) => { if (output.isJson()) output.line(text); else process.stdout.write(text); });
    child.stderr?.on('data', (text: string) => { if (output.isJson()) output.error(text); else process.stderr.write(text); });
    child.once('error', error => { spawnFailed = error; });
    child.once('close', (code, signal) => {
      if (interrupted && process.platform !== 'win32') kill('SIGKILL');
      clearTimeout(deadline); clearTimeout(force); process.off('SIGINT', interrupt); process.off('SIGTERM', terminate);
      output.result({ command, cwd: invocation.cwd, childExitCode: code, signal, interrupted, timedOut: expired });
      if (spawnFailed) reject(new CliFailure(`Unable to start ${command}: ${spawnFailed.message}`, 2));
      else if (expired) reject(new CliFailure(`${command} exceeded its timeout.`, 2));
      else if (interrupted || signal) reject(new CliFailure(`${command} interrupted.`, 1));
      else if (code !== 0) reject(new CliFailure(`${command} failed with exit code ${String(code)}.`, 1));
      else done();
    });
  });
}
