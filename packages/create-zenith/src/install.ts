/**
 * Safe subprocess helpers for `create-zenith` (#158): package-manager
 * detection, argv-array installs (never a shell string) and git init.
 *
 * @packageDocumentation
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** @public Package managers the scaffolder can install with. */
export type CreatePackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

/** @public */
export const CREATE_PACKAGE_MANAGERS: readonly CreatePackageManager[] = [
  'npm',
  'pnpm',
  'yarn',
  'bun',
];

/** @public Spawn surface (injectable for tests; production uses `execFile`). */
export interface SpawnHost {
  run(cmd: string, args: readonly string[], cwd: string): { status: number };
}

const nodeSpawn: SpawnHost = {
  run: (cmd, args, cwd) => {
    try {
      execFileSync(cmd, [...args], { cwd, stdio: 'ignore', timeout: 300_000 });
      return { status: 0 };
    } catch (error) {
      const code =
        typeof (error as { status?: unknown }).status === 'number'
          ? ((error as { status: number }).status as number)
          : 1;
      return { status: code };
    }
  },
};

/**
 * Detect the package manager: explicit `--pm` wins, then the npm user-agent,
 * then lockfiles next to `cwd` (`bun` included).
 *
 * @public
 */
export function detectPackageManager(options: {
  readonly pm?: CreatePackageManager;
  readonly cwd?: string;
  readonly userAgent?: string;
}): CreatePackageManager {
  if (options.pm) return options.pm;
  const cwd = options.cwd ?? process.cwd();
  const userAgent = options.userAgent ?? process.env['npm_config_user_agent'] ?? '';
  if (userAgent.includes('pnpm')) return 'pnpm';
  if (userAgent.includes('yarn')) return 'yarn';
  if (userAgent.includes('bun')) return 'bun';
  if (existsSync(join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(cwd, 'yarn.lock'))) return 'yarn';
  if (existsSync(join(cwd, 'bun.lockb')) || existsSync(join(cwd, 'bun.lock'))) return 'bun';
  return 'npm';
}

/**
 * Argv for installing dependencies with `pm` (always an array — no shell).
 *
 * @public
 */
export function buildInstallArgs(pm: CreatePackageManager): readonly string[] {
  return ['install'];
}

/**
 * Run `<pm> install` in `cwd`. Returns the exit status (0 = installed).
 *
 * @public
 */
export function runInstall(
  pm: CreatePackageManager,
  cwd: string,
  spawn: SpawnHost = nodeSpawn,
): number {
  return spawn.run(pm, buildInstallArgs(pm), cwd).status;
}

/**
 * Run `git init --quiet` in `cwd`. Returns false (never throws) when git is
 * unavailable — callers warn and keep the written files.
 *
 * @public
 */
export function runGitInit(cwd: string, spawn: SpawnHost = nodeSpawn): boolean {
  try {
    return spawn.run('git', ['init', '--quiet'], cwd).status === 0;
  } catch {
    return false;
  }
}
