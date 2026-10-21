/**
 * `create-zenith` command layer (#158): argv parsing with the 0/1/2 exit
 * contract, orchestration of `@zenith/templates` + install/git, and
 * stdout-data / stderr-diagnostic separation.
 *
 * @packageDocumentation
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ScaffoldError,
  TEMPLATE_KINDS,
  scaffoldProject,
  validateProjectName,
  type ZenithTemplateKind,
} from '@zenith/templates';
import {
  detectPackageManager,
  runGitInit,
  runInstall,
  type CreatePackageManager,
  type SpawnHost,
} from './install';

/** Resolve the installed scaffolder version (mirrors `@zenith/cli` versioning). @public */
export function getCreateVersion(): string {
  const candidates: string[] = [];
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    candidates.push(path.join(here, '..', 'package.json'));
  } catch {
    // CJS build defines import.meta away; fall through to workspace lookup.
  }
  candidates.push(path.join(process.cwd(), 'packages', 'create-zenith', 'package.json'));
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8')) as {
          name?: string;
          version?: string;
        };
        if (parsed.version && (!parsed.name || parsed.name === '@zenith/create-zenith')) {
          return parsed.version;
        }
      }
    } catch {
      // Unreadable candidate — try the next one.
    }
  }
  return '1.5.0';
}

/** @public Frozen default CLI flags. */
export const DEFAULTS: Readonly<{
  template: ZenithTemplateKind;
  install: boolean;
  git: boolean;
  force: boolean;
  dryRun: boolean;
  yes: boolean;
  json: boolean;
}> = Object.freeze({
  template: 'spa',
  install: true,
  git: true,
  force: false,
  dryRun: false,
  yes: false,
  json: false,
});

/**
 * CLI usage/operational failure. `exitCode` follows the contract:
 * 1 = usage/validation, 2 = operational.
 *
 * @public
 */
export class CreateCLIError extends Error {
  /** @public */
  readonly exitCode: 1 | 2;
  /** @public */
  constructor(message: string, exitCode: 1 | 2 = 1) {
    super(message);
    this.name = 'CreateCLIError';
    this.exitCode = exitCode;
  }
}

/** @public Parsed `create-zenith` invocation. */
export interface CreatePlan {
  readonly name: string;
  readonly kind: ZenithTemplateKind;
  readonly pm: CreatePackageManager;
  readonly pmExplicit: boolean;
  readonly install: boolean;
  readonly git: boolean;
  readonly force: boolean;
  readonly dryRun: boolean;
  readonly yes: boolean;
  readonly json: boolean;
  readonly cwd: string;
}

/** @public Machine-readable result printed by `--json` and returned by {@link runCreate}. */
export interface CreateResult {
  readonly name: string;
  readonly template: ZenithTemplateKind;
  readonly destination: string;
  readonly files: readonly string[];
  readonly pm: CreatePackageManager;
  readonly installed: boolean;
  readonly git: boolean;
  readonly dryRun: boolean;
}

const USAGE = `Usage: create-zenith <name> [options]

Options:
  -t, --template <kind>   spa|ssr|pwa|dashboard|minimal (default: spa)
  --pwa                    Alias for --template pwa
  --pm <npm|pnpm|yarn|bun> Package manager for --install (default: auto-detect)
  --install / --no-install Run <pm> install after scaffolding (default: install)
  --git / --no-git         Run git init after scaffolding (default: init)
  --force                  Write into an existing non-empty directory
  --dry-run                Plan only; write, install and init nothing
  --yes                    Accept all defaults
  --json                   Machine-readable result on stdout
  --ts                     TypeScript templates (the only variant)
  -V, --version            Print version   -h, --help  Print this help`;

/** Type guard for `--pm` values (keeps narrowing exact under `noUncheckedIndexedAccess`). */
function isPackageManager(value: string | undefined): value is CreatePackageManager {
  return value === 'npm' || value === 'pnpm' || value === 'yarn' || value === 'bun';
}

/**
 * Parse raw argv (without node/bin) into a {@link CreatePlan}.
 * Throws {@link CreateCLIError} (exit 1) on usage errors. Note: `-h`/`--help`
 * and `-V`/`--version` also throw carrying the text; {@link runCreate}
 * intercepts them first and prints to stdout with exit 0.
 *
 * @public
 */
export function parseCreateArgs(argv: readonly string[], cwd: string = process.cwd()): CreatePlan {
  let name: string | undefined;
  let template: string = DEFAULTS.template;
  let pwa = false;
  let pm: CreatePackageManager | undefined;
  let install = DEFAULTS.install;
  let git = DEFAULTS.git;
  let force = DEFAULTS.force;
  let dryRun = DEFAULTS.dryRun;
  let yes = DEFAULTS.yes;
  let json = DEFAULTS.json;

  const fail = (message: string): never => {
    throw new CreateCLIError(`${message}\n\n${USAGE}`, 1);
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === '-t' || arg === '--template') {
      const value = argv[++i];
      if (value === undefined) fail('Missing value for --template.');
      template = value as string;
    } else if (arg.startsWith('--template=')) {
      template = arg.slice('--template='.length);
    } else if (arg === '--pwa') {
      pwa = true;
    } else if (arg === '--pm') {
      const value = argv[++i];
      if (!isPackageManager(value)) {
        fail(`Unknown --pm "${value ?? ''}". Choose npm|pnpm|yarn|bun.`);
      }
      pm = value;
    } else if (arg.startsWith('--pm=')) {
      const value = arg.slice('--pm='.length);
      if (!isPackageManager(value)) {
        fail(`Unknown --pm "${value}". Choose npm|pnpm|yarn|bun.`);
      }
      pm = value;
    } else if (arg === '--install') {
      install = true;
    } else if (arg === '--no-install') {
      install = false;
    } else if (arg === '--git') {
      git = true;
    } else if (arg === '--no-git') {
      git = false;
    } else if (arg === '--force') {
      force = true;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--yes' || arg === '-y') {
      yes = true;
    } else if (arg === '--json') {
      json = true;
    } else if (arg === '--ts') {
      continue;
    } else if (arg === '--js') {
      fail('JavaScript templates are not available; only TypeScript (--ts).');
    } else if (arg === '-h' || arg === '--help') {
      throw new CreateCLIError(USAGE, 1);
    } else if (arg === '-V' || arg === '--version') {
      throw new CreateCLIError(getCreateVersion(), 1);
    } else if (arg.startsWith('-')) {
      fail(`Unknown option "${arg}".`);
    } else if (name === undefined) {
      name = arg;
    } else {
      fail(`Unexpected argument "${arg}".`);
    }
  }

  if (name === undefined) fail('Missing <name>.');
  if (pwa && template !== 'spa' && template !== 'pwa') {
    fail('--pwa conflicts with --template.');
  }
  const kind = (pwa ? 'pwa' : template) as ZenithTemplateKind;
  if (!(TEMPLATE_KINDS as readonly string[]).includes(kind)) {
    fail(`Unknown template "${template}". Choose spa|ssr|pwa|dashboard|minimal.`);
  }
  const trimmed = (name as string).trim().normalize('NFC');
  const invalid = validateProjectName(trimmed, cwd);
  if (invalid) throw new CreateCLIError(`Invalid project name: ${invalid}`, 1);
  return {
    name: trimmed,
    kind,
    pm: pm ?? detectPackageManager({ cwd }),
    pmExplicit: pm !== undefined,
    install,
    git,
    force,
    dryRun,
    yes,
    json,
    cwd,
  };
}

/** @public Host surface {@link runCreate} needs (injectable for tests). */
export interface CreateHost {
  readonly spawn: SpawnHost;
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
}

/**
 * Execute a parsed (or raw) invocation. Returns the process exit code
 * (0/1/2); all diagnostics go to `err`, data to `out`.
 *
 * @public
 */
export function runCreate(
  argv: readonly string[],
  host?: Partial<CreateHost> & { cwd?: string },
): number {
  const out = host?.out ?? ((line: string): void => process.stdout.write(line + '\n'));
  const err = host?.err ?? ((line: string): void => process.stderr.write(line + '\n'));
  const spawn = host?.spawn;
  const cwd = host?.cwd ?? process.cwd();

  // `--help` / `--version` are data on stdout with exit 0 (not diagnostics).
  if (argv.includes('-h') || argv.includes('--help')) {
    out(USAGE);
    return 0;
  }
  if (argv.includes('-V') || argv.includes('--version')) {
    out(getCreateVersion());
    return 0;
  }

  let plan: CreatePlan;
  try {
    plan = parseCreateArgs(argv, cwd);
  } catch (error) {
    err(error instanceof Error ? error.message : String(error));
    return error instanceof CreateCLIError ? error.exitCode : 1;
  }

  let scaffolded;
  try {
    scaffolded = scaffoldProject(
      { name: plan.name, kind: plan.kind, cwd: plan.cwd, force: plan.force, dryRun: plan.dryRun },
    );
  } catch (error) {
    err(error instanceof Error ? error.message : String(error));
    return error instanceof ScaffoldError ? error.exitCode : 2;
  }

  let gitDone = false;
  let installed = false;
  if (!plan.dryRun) {
    if (plan.git) {
      gitDone = runGitInit(scaffolded.destination, spawn);
      if (!gitDone) err('Git initialization unavailable; project files were created.');
    }
    if (plan.install) {
      const status = runInstall(plan.pm, scaffolded.destination, spawn);
      installed = status === 0;
      if (!installed) {
        err(
          `Install failed (${plan.pm} install in ${scaffolded.destination}); project files were kept.`,
        );
        return 2;
      }
    }
  }

  const result: CreateResult = {
    name: plan.name,
    template: plan.kind,
    destination: scaffolded.destination,
    files: Object.keys(scaffolded.files),
    pm: plan.pm,
    installed,
    git: gitDone,
    dryRun: plan.dryRun,
  };
  if (plan.json) {
    out(JSON.stringify(result, null, 2));
  } else if (!plan.dryRun) {
    out(`[DONE] Project "${plan.name}" created successfully!`);
    out(`  cd ${plan.name}`);
    if (!installed) out(`  ${(plan.pm === 'npm' ? 'npm install' : `${plan.pm} install`)}`);
    out(`  ${plan.pm === 'npm' ? 'npm run' : plan.pm} dev`);
  } else {
    out(`[DRY-RUN] Would create "${plan.name}" (${plan.kind}) with ${result.files.length} files.`);
  }
  return 0;
}
