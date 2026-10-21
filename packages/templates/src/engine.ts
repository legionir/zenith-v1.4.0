/**
 * Data-driven scaffold engine (#158).
 *
 * Template content lives in real files under `templates/shared/` (base) plus
 * one optional overlay directory per kind (`templates/<kind>/`, absent when
 * the kind needs no file overrides — e.g. `dashboard`). Nothing is a nested
 * escaped literal except `.gitignore`, which cannot live under `src/` as a
 * real file (dotfiles are rejected by the workspace store) and has no tokens.
 *
 * @packageDocumentation
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dependencyVersion } from './versions';
import { validateProjectName } from './validate-project-name';

/** @public Project template kinds. */
export type ZenithTemplateKind = 'spa' | 'ssr' | 'pwa' | 'dashboard' | 'minimal';

/** @public All template kinds in manifest order. */
export const TEMPLATE_KINDS: readonly ZenithTemplateKind[] = ['spa', 'ssr', 'pwa', 'dashboard', 'minimal'];

/** @public Frozen default scaffold options. */
export const DEFAULTS: Readonly<{ kind: ZenithTemplateKind; force: boolean; dryRun: boolean }> =
  Object.freeze({ kind: 'spa', force: false, dryRun: false });

/** @public Options for {@link scaffoldProject}. */
export interface ScaffoldOptions {
  /** Project directory name (validated with {@link validateProjectName}). */
  readonly name: string;
  /** Template kind. @default 'spa' */
  readonly kind?: ZenithTemplateKind;
  /** Reference directory the project is created inside. @default process.cwd() */
  readonly cwd?: string;
  /** Allow writing into an existing non-empty directory (files are overwritten). @default false */
  readonly force?: boolean;
  /** Compute the manifest without writing anything. @default false */
  readonly dryRun?: boolean;
}

/** @public Result of {@link scaffoldProject}. */
export interface ScaffoldResult {
  /** Absolute destination directory. */
  readonly destination: string;
  /** Manifest that was (or, for dry-run, would be) written, relative path → content. */
  readonly files: Readonly<Record<string, string>>;
  /** Absolute paths actually written (empty for dry-run). */
  readonly written: readonly string[];
}

/** @public Minimal filesystem surface {@link scaffoldProject} needs (injectable for tests). */
export interface ScaffoldHost {
  existsSync(path: string): boolean;
  mkdirSync(path: string): void;
  writeFileSync(path: string, content: string, flag: 'w' | 'wx'): void;
}

const nodeHost: ScaffoldHost = {
  existsSync,
  mkdirSync: (path) => {
    mkdirSync(path, { recursive: true });
  },
  writeFileSync: (path, content, flag) => {
    writeFileSync(path, content, { encoding: 'utf8', flag });
  },
};

/**
 * Scaffold failure with a stable machine-readable code and CLI exit code.
 *
 * @public
 */
export class ScaffoldError extends Error {
  /** @public */
  readonly code: 'INVALID_NAME' | 'DEST_EXISTS' | 'PATH_ESCAPE' | 'WRITE_FAILED';
  /** @public CLI exit code: 1 = usage/validation, 2 = operational failure. */
  readonly exitCode: 1 | 2;
  /** @public */
  constructor(
    code: ScaffoldError['code'],
    message: string,
    exitCode: ScaffoldError['exitCode'],
  ) {
    super(message);
    this.name = 'ScaffoldError';
    this.code = code;
    this.exitCode = exitCode;
  }
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string,
  );
}

/** Directory holding `shared/` plus per-kind overlays, next to `src/` or `dist/`. */
function templatesRoot(): string {
  // Dual build: the CJS bundle defines `import.meta` away, so prefer the
  // native CJS `__dirname` there and `import.meta.url` everywhere else.
  const here = typeof __dirname === 'string' ? __dirname : dirname(fileURLToPath(import.meta.url));
  return join(here, '..', 'templates');
}

function readDiskFile(root: string, relative: string): string | undefined {
  const file = join(root, relative);
  if (!existsSync(file) || !statSync(file).isFile()) return undefined;
  return readFileSync(file, 'utf8');
}

function listDiskFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, prefix: string): void => {
    if (!existsSync(dir) || !statSync(dir).isDirectory()) return;
    for (const entry of readdirSync(dir).sort()) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full, `${prefix}${entry}/`);
      else out.push(`${prefix}${entry}`);
    }
  };
  walk(root, '');
  return out;
}

interface TemplateVars {
  readonly projectName: string;
}

/** Render one template file with all token substitutions applied. */
function renderContent(content: string, vars: TemplateVars): string {
  const shortName =
    vars.projectName.length > 12 ? vars.projectName.substring(0, 12) : vars.projectName;
  return content
    .replaceAll('__PROJECT_NAME_ESCAPED__', escapeHtml(vars.projectName))
    .replaceAll('__PROJECT_NAME_LOWER__', vars.projectName.toLowerCase())
    .replaceAll('__PROJECT_NAME__', vars.projectName)
    .replaceAll('__SHORT_NAME__', shortName)
    .replaceAll('__ZENITH_STATE__', dependencyVersion('@zenith/state'))
    .replaceAll('__ZENITH_RUNTIME__', dependencyVersion('@zenith/runtime'))
    .replaceAll('__ZENITH_LOGGER__', dependencyVersion('@zenith/logger'))
    .replaceAll('__ZENITH_VITE_PLUGIN__', dependencyVersion('@zenith/vite-plugin'))
    .replaceAll('__ZENITH_ESLINT_PLUGIN__', dependencyVersion('@zenith/eslint-plugin'));
}

/**
 * List the relative paths of one kind's manifest as stored on disk
 * (`shared/` overlaid by `templates/<kind>/`; `.gitignore` is code-static).
 *
 * @public
 */
export function listTemplateFiles(kind: ZenithTemplateKind): string[] {
  assertKind(kind);
  const root = templatesRoot();
  const merged = new Map<string, null>();
  for (const relative of listDiskFiles(join(root, 'shared'))) merged.set(relative, null);
  for (const relative of listDiskFiles(join(root, kind))) merged.set(relative, null);
  merged.set('.gitignore', null);
  return [...merged.keys()].sort();
}

/**
 * Render one template file (`shared/` overlaid by the kind directory).
 *
 * @public
 */
export function renderTemplateFile(
  kind: ZenithTemplateKind,
  relative: string,
  vars: TemplateVars,
): string {
  assertKind(kind);
  if (relative.includes('..') || relative.startsWith('/')) {
    throw new ScaffoldError('PATH_ESCAPE', `Template path escapes the template root: ${relative}`, 2);
  }
  const root = templatesRoot();
  const overlay = readDiskFile(join(root, kind), relative);
  const base = overlay ?? readDiskFile(join(root, 'shared'), relative);
  if (base === undefined) throw new RangeError(`Unknown template file: ${kind}/${relative}`);
  return renderContent(base, vars);
}

/** The only dotfile template; kept inline because dotfiles cannot live under `src/`. */
const GITIGNORE_TEMPLATE = 'node_modules/\ndist/\n.env\n.env.local\n*.log\n.DS_Store\n.vite/\n';

function assertKind(kind: string): asserts kind is ZenithTemplateKind {
  if (!(TEMPLATE_KINDS as readonly string[]).includes(kind)) {
    throw new RangeError('Unknown template. Choose spa, ssr, pwa, dashboard or minimal.');
  }
}

/** Base manifest key order (historic literal order, with `eslint.config.mjs` appended by #159). */
const BASE_FILE_ORDER = [
  'package.json',
  'tsconfig.json',
  '.gitignore',
  'test/state.test.ts',
  'index.html',
  'src/main.ts',
  'vite.config.ts',
  'README.md',
  'eslint.config.mjs',
];

function baseManifest(projectName: string, kind: ZenithTemplateKind): Record<string, string> {
  const vars: TemplateVars = { projectName };
  const root = templatesRoot();
  const files: Record<string, string> = {};
  const shared = listDiskFiles(join(root, 'shared'));
  const extra = listDiskFiles(join(root, kind)).filter((relative) => !shared.includes(relative));
  for (const relative of [...BASE_FILE_ORDER, ...extra]) {
    if (relative === '.gitignore') {
      files[relative] = GITIGNORE_TEMPLATE;
      continue;
    }
    const overlay = readDiskFile(join(root, kind), relative);
    const base = overlay ?? readDiskFile(join(root, 'shared'), relative);
    if (base !== undefined) files[relative] = renderContent(base, vars);
  }
  return files;
}

/**
 * Full file manifest for a project (relative path → content) with the same
 * per-file content as the historic `getTemplateManifest` from `@zenith/cli`
 * (same keys, same escaping, same kind mutations).
 *
 * @public
 */
export function getTemplateManifest(
  projectName: string,
  kind: ZenithTemplateKind = 'spa',
): Record<string, string> {
  assertKind(kind);
  const files = baseManifest(projectName, kind);
  const pkg = JSON.parse(files['package.json'] as string) as {
    scripts: Record<string, string>;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  if (kind === 'minimal') {
    delete pkg.dependencies['@zenith/logger'];
  }
  if (kind === 'pwa') {
    files['index.html'] = (files['index.html'] as string).replace(
      '</head>',
      '<link rel="manifest" href="/manifest.json"><meta name="theme-color" content="#3b82f6"></head>',
    );
    pkg.devDependencies['vite-plugin-pwa'] = '^0.21.2';
    pkg.devDependencies['workbox-window'] = '^7.3.0';
  }
  if (kind === 'dashboard') {
    files['index.html'] = (files['index.html'] as string).replace(
      '<div id="app">',
      '<div id="app"><nav aria-label="Dashboard"><a href="#summary">Summary</a></nav><section id="summary" aria-label="Summary"><h2>Dashboard</h2><p>Total: <span zen-text="$count"></span></p></section>',
    );
    files['README.md'] +=
      '\nDashboard uses the same reactive counter as a summary metric; edit src/main.ts to connect your data.\n';
  }
  if (kind === 'ssr') {
    files['index.html'] = (files['index.html'] as string).replace(
      '<div id="app">',
      '<div id="app"><!--zen-outlet-->',
    );
    pkg.dependencies['@zenith/adapter-node'] = dependencyVersion('@zenith/adapter-node');
    pkg.dependencies['jsdom'] = '^24.0.0';
    pkg.devDependencies['tsx'] = '^4.23.0';
    pkg.devDependencies['@types/node'] = '^22.0.0';
    pkg.scripts['dev'] = 'tsx server/index.ts';
    pkg.scripts['build'] = 'tsc --noEmit && vite build';
    pkg.scripts['start'] = 'tsx server/index.ts --production';
    files['README.md'] +=
      '\nSSR: npm run dev for Vite middleware; npm run build && npm start for the production server. Set PORT as needed. Each HTTP request creates its own renderer state.\n';
  }
  files['package.json'] = JSON.stringify(pkg, null, 2) + '\n';
  return files;
}

// ── Legacy per-file builders (compatibility facades for `@zenith/cli` tests;
// identical output to the historic literal templates). ──

/** @public */
export function indexHtmlTemplate(projectName: string): string {
  return renderTemplateFile('spa', 'index.html', { projectName });
}

/** @public */
export function mainTsTemplate(): string {
  return renderTemplateFile('spa', 'src/main.ts', { projectName: 'app' });
}

/** @public */
export function viteConfigTemplate(): string {
  return renderTemplateFile('spa', 'vite.config.ts', { projectName: 'app' });
}

/** @public */
export function tsConfigTemplate(): string {
  return renderTemplateFile('spa', 'tsconfig.json', { projectName: 'app' });
}

/** @public */
export function readmeTemplate(projectName: string): string {
  return renderTemplateFile('spa', 'README.md', { projectName });
}

/** @public */
export function gitignoreTemplate(): string {
  return GITIGNORE_TEMPLATE;
}

/** @public */
export function pwaManifestTemplate(projectName: string): string {
  return renderTemplateFile('pwa', 'public/manifest.json', { projectName }).replace(/\n$/, '');
}

/** @public */
export function pwaMainTsTemplate(): string {
  return renderTemplateFile('pwa', 'src/main.ts', { projectName: 'app' });
}

/** @public */
export function pwaViteConfigTemplate(): string {
  return renderTemplateFile('pwa', 'vite.config.ts', { projectName: 'app' });
}

/** @public */
export function pwaReadmeTemplate(projectName: string): string {
  return renderTemplateFile('pwa', 'README.md', { projectName });
}

/** @public */
export function pwaServiceWorkerTemplate(): string {
  return renderTemplateFile('pwa', 'public/sw.js', { projectName: 'app' });
}

/** @public */
export function packageJsonTemplate(projectName: string): string {
  return getTemplateManifest(projectName, 'spa')['package.json'] as string;
}

/**
 * Write a project to disk (or compute it for `--dry-run`).
 *
 * @public
 */
export function scaffoldProject(
  options: ScaffoldOptions,
  host: ScaffoldHost = nodeHost,
): ScaffoldResult {
  const kind = options.kind ?? DEFAULTS.kind;
  assertKind(kind);
  const cwd = options.cwd ?? process.cwd();
  const name = options.name.normalize('NFC');
  const invalid = validateProjectName(options.name, cwd);
  if (invalid) throw new ScaffoldError('INVALID_NAME', `Invalid project name: ${invalid}`, 1);
  const destination = resolve(cwd, name);
  const root = resolve(cwd);
  if (destination !== root && !destination.startsWith(root + sep)) {
    throw new ScaffoldError('PATH_ESCAPE', 'Resolved project path escapes the current directory.', 1);
  }
  const force = options.force ?? DEFAULTS.force;
  const dryRun = options.dryRun ?? DEFAULTS.dryRun;
  if (!dryRun && host.existsSync(destination) && !force) {
    throw new ScaffoldError('DEST_EXISTS', `Directory "${name}" already exists!`, 1);
  }
  const files = getTemplateManifest(name, kind);
  if (dryRun) return { destination, files, written: [] };
  const written: string[] = [];
  const ensureDirectory = (directory: string): void => {
    const missing: string[] = [];
    let cursor = directory;
    while (!host.existsSync(cursor)) {
      missing.push(cursor);
      cursor = dirname(cursor);
    }
    for (const item of missing.reverse()) {
      try {
        host.mkdirSync(item);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      }
    }
  };
  try {
    ensureDirectory(destination);
    for (const [relative, content] of Object.entries(files)) {
      const file = resolve(destination, relative);
      if (file !== destination && !file.startsWith(destination + sep)) {
        throw new ScaffoldError('PATH_ESCAPE', 'Scaffold path escapes project.', 2);
      }
      ensureDirectory(dirname(file));
      try {
        host.writeFileSync(file, content, force ? 'w' : 'wx');
      } catch (error) {
        if (!force || (error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        host.writeFileSync(file, content, 'w');
      }
      written.push(file);
    }
    ensureDirectory(join(destination, 'src/components'));
    ensureDirectory(join(destination, 'pages'));
  } catch (error) {
    if (error instanceof ScaffoldError) throw error;
    throw new ScaffoldError(
      'WRITE_FAILED',
      error instanceof Error ? error.message : 'Project creation failed.',
      2,
    );
  }
  return { destination, files, written };
}
