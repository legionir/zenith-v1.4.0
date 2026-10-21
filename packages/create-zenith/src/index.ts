#!/usr/bin/env node
/**
 * `@zenith/create-zenith` executable entry and programmatic API (#158).
 *
 * Importing this module runs the CLI with `process.argv` (exactly like
 * `@zenith/cli`); library integrations import `./program` instead, whose
 * parsing is side-effect-free. The executable never exits mid-flush.
 */
import { runCreate } from './program';

export { CreateCLIError, DEFAULTS, getCreateVersion, parseCreateArgs, runCreate } from './program';
export type { CreateHost, CreatePlan, CreateResult } from './program';
export {
  CREATE_PACKAGE_MANAGERS,
  buildInstallArgs,
  detectPackageManager,
  runGitInit,
  runInstall,
} from './install';
export type { CreatePackageManager, SpawnHost } from './install';

void ((): void => {
  try {
    process.exitCode = runCreate(process.argv.slice(2));
  } catch {
    process.exitCode = 2;
  }
})();
