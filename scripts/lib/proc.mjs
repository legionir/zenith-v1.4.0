// scripts/lib/proc.mjs — cross-platform process helpers (the Windows CI job runs the same scripts).
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const isWin = process.platform === 'win32';

/** `npm` needs a shell on Windows (npm.cmd cannot be spawned directly since the 2024 Node fix). */
export function spawnNpm(args, options = {}) {
  return spawnSync('npm', args, { ...options, shell: isWin });
}

/** Absolute path of a package's JS `bin` entry, runnable as `node <path>` on every OS. */
export function binScript(root, pkgName, binName = pkgName) {
  const pkgDir = join(root, 'node_modules', pkgName);
  const manifest = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
  const rel = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.[binName];
  if (!rel) throw new Error(`${pkgName} has no bin "${binName}"`);
  return join(pkgDir, rel);
}

/** Run `node <script> …args`. */
export function spawnNode(script, args = [], options = {}) {
  return spawnSync(process.execPath, [script, ...args], options);
}

/**
 * Async `npm`: same result shape as spawnSync ({ status, stdout, stderr }) but it does not block
 * the event loop. Required inside vitest, where a long synchronous spawn (e.g. 49 × `npm pack`
 * on Windows, ~70 s) starves the worker's RPC heartbeat → "Timeout calling onTaskUpdate".
 */
export function spawnNpmAsync(args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn('npm', args, { ...options, shell: isWin });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => (stdout += d));
    child.stderr?.on('data', (d) => (stderr += d));
    child.on('error', (err) => resolve({ status: null, stdout, stderr: stderr + String(err) }));
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}
