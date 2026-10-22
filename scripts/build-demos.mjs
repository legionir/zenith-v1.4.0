// scripts/build-demos.mjs — #114: build, validate, stage and smoke all shippable demos.
//
// The demos (`demos/*`, `ecommerce-demo/`, `dashboard/`) are plain HTML+JS
// running from workspace `packages/*/dist` via importmap — there is no
// per-demo bundler step. "Building" them therefore means:
//   1. audit (source-only): manifest↔filesystem sync, card sync, importmap
//      targets resolve to real workspace packages (never npm versions or
//      remote URLs), router `src` targets exist, and no stray absolute
//      asset path sneaks in;
//   2. dist check: every referenced `packages/<slug>/dist/<file>` exists
//      (fail-closed: run `npm run build` first);
//   3. stage: copy the site subset into one directory and relativize every
//      root-absolute asset reference so the SAME output works at a domain
//      root AND under a project Pages base-path (`/<repo>/`).
//      Untouched by design: `/api/*` fetches (fetch-patched in-page mocks,
//      origin-relative by contract — see packages/mock `installFetchMock`),
//      `zen-link`/`path` (router semantics, not URLs), and `&lt;`-escaped
//      documentation samples.
//   4. smoke: serve the staged directory over loopback and GET every
//      manifest path (+ home, index, version stamp).
//
// CLI: `node scripts/build-demos.mjs` (audit only)
//      `node scripts/build-demos.mjs --with-dist`
//      `node scripts/build-demos.mjs --stage <dir>`
//      `node scripts/build-demos.mjs --smoke [--stage <dir>] [--port N]`
// Exit 0 on success; exit 1 prints every failure (any demo failure breaks).
// Only node builtins are used.
import { existsSync, readFileSync, writeFileSync, cpSync, mkdirSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

/** Loopback and RFC 2606 example hosts are sample data, never fetched or imported. */
function isSampleDataUrl(url) {
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === 'example.com' || host.endsWith('.example.com');
  } catch {
    return false;
  }
}

const MANIFEST_REL = join('demos', 'manifest.json');
const FONT_CDN_ALLOW = 'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css';

/** @internal */
export function loadManifest(rootDir) {
  const raw = readFileSync(join(rootDir, MANIFEST_REL), 'utf8');
  const manifest = JSON.parse(raw);
  if (manifest.version !== 1) throw new Error(`demos/manifest.json: unsupported version ${manifest.version}`);
  if (!Array.isArray(manifest.demos) || manifest.demos.length === 0) {
    throw new Error('demos/manifest.json: `demos` must be a non-empty array');
  }
  const slugs = new Set();
  for (const entry of manifest.demos) {
    for (const field of ['slug', 'path', 'title', 'build']) {
      if (typeof entry[field] !== 'string' || entry[field].length === 0) {
        throw new Error(`demos/manifest.json: entry is missing string field \`${field}\``);
      }
    }
    if (slugs.has(entry.slug)) throw new Error(`demos/manifest.json: duplicate slug \`${entry.slug}\``);
    slugs.add(entry.slug);
  }
  return manifest;
}

function listFilesRecursive(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...listFilesRecursive(full, base));
    else if (stat.isFile()) out.push(relative(base, full).split(sep).join('/'));
  }
  return out;
}

function readText(rootDir, rel) {
  return readFileSync(join(rootDir, rel), 'utf8');
}

/** Strip `&lt;zen-…&gt;` documentation samples so their fake paths never audit. @internal */
export function stripEscapedSamples(text) {
  return text.replace(/&lt;zen-[\s\S]*?&gt;/g, '');
}

/**
 * Source-only audit (#114 step 1). Returns `{ failures, references }` where
 * `references` are repo-relative `packages/<slug>/dist/<file>` paths every
 * demo resolves at runtime. `failures` empty means pass.
 */
export function auditDemos(rootDir) {
  const failures = [];
  const references = new Set();
  let manifest;
  try {
    manifest = loadManifest(rootDir);
  } catch (error) {
    return { failures: [`manifest: ${(error instanceof Error ? error.message : String(error))}`], references: [] };
  }

  // 1. manifest ↔ filesystem sync.
  const demoDirs = readdirSync(join(rootDir, 'demos'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  const manifestSlugs = new Set(manifest.demos.filter((d) => d.path.startsWith('demos/')).map((d) => d.slug));
  for (const dir of demoDirs) {
    if (!manifestSlugs.has(dir)) failures.push(`orphan demo directory \`demos/${dir}/\` (not in manifest)`);
    if (!existsSync(join(rootDir, 'demos', dir, 'index.html'))) {
      failures.push(`demo \`demos/${dir}/\` has no index.html`);
    }
  }
  for (const entry of manifest.demos) {
    if (!existsSync(join(rootDir, entry.path))) failures.push(`manifest path missing on disk: \`${entry.path}\``);
  }
  for (const hub of [manifest.home, manifest.index]) {
    if (typeof hub !== 'string' || !existsSync(join(rootDir, hub))) failures.push(`manifest hub missing on disk: \`${hub}\``);
  }

  // 2. demos/index.html cards ↔ manifest slugs.
  try {
    const cardsHtml = readText(rootDir, manifest.index);
    const cards = [...cardsHtml.matchAll(/href="([a-z0-9-]+)\/index\.html"/g)].map((m) => m[1]);
    const cardSet = new Set(cards);
    for (const slug of manifestSlugs) {
      if (!cardSet.has(slug)) failures.push(`manifest slug \`${slug}\` has no card in \`${manifest.index}\``);
    }
    for (const slug of cardSet) {
      if (!manifestSlugs.has(slug)) failures.push(`card \`${slug}/index.html\` in \`${manifest.index}\` is not in the manifest`);
    }
  } catch (error) {
    failures.push(`cannot read index cards: ${(error instanceof Error ? error.message : String(error))}`);
  }

  // 3. per-file import/link audit over every demo/app source file.
  const scanRoots = ['demos', 'dashboard', 'ecommerce-demo'];
  const scanFiles = [];
  for (const scanRoot of scanRoots) {
    const abs = join(rootDir, scanRoot);
    if (!existsSync(abs)) {
      failures.push(`missing source root \`${scanRoot}/\``);
      continue;
    }
    for (const file of listFilesRecursive(abs)) {
      if (/\.(html|js|mjs|cjs|css)$/.test(file)) scanFiles.push(`${scanRoot}/${file}`);
    }
  }
  for (const rel of scanFiles) {
    const raw = readText(rootDir, rel);
    const text = stripEscapedSamples(raw);
    // 3a. importmap values must resolve to workspace dist (never npm/CDN).
    // Subpath keys (`@zenith/schema/attr`) map into their root package.
    for (const match of text.matchAll(/"@zenith\/([^"]+)"\s*:\s*"([^"]+)"/g)) {
      const [, slug, target] = match;
      const root = slug.split('/')[0];
      const distMatch = /^\/packages\/([^/]+)\/dist\/(.+)$/.exec(target);
      if (!distMatch || distMatch[1] !== root) {
        failures.push(`${rel}: importmap \`@zenith/${slug}\` must map to \`/packages/${root}/dist/…\`, got \`${target}\``);
        continue;
      }
      if (!existsSync(join(rootDir, 'packages', root, 'package.json'))) {
        failures.push(`${rel}: importmap slug \`@zenith/${slug}\` has no workspace package`);
        continue;
      }
      references.add(`packages/${root}/dist/${distMatch[2]}`);
    }
    // 3b. direct absolute package imports (no importmap).
    for (const match of text.matchAll(/['"]\/packages\/([^'"]+)['"]/g)) {
      references.add(`packages/${match[1]}`);
    }
    // 3c. remote imports other than the font allowlist.
    for (const match of text.matchAll(/["'](https?:\/\/[^"']+)["']/g)) {
      if (match[1] !== FONT_CDN_ALLOW && !isSampleDataUrl(match[1])) {
        failures.push(`${rel}: remote URL not allowlisted: \`${match[1]}\``);
      }
    }
    // 3d. absolute asset refs outside the known root-absolute set.
    // NOTE: the `[^\w-]` guard keeps `zen-link=`/`data-src=`-style names out
    // (a bare `\b` still matches after `-`).
    for (const match of text.matchAll(/(?:^|[^\w-])(?:src|href)=["'](\/[^"']*)["']/g)) {
      const url = match[1];
      const known =
        url === '/index.html' ||
        url === '/demos/' ||
        url.startsWith('/packages/') ||
        url.startsWith('/dashboard/') ||
        url.startsWith('/ecommerce-demo/') ||
        url.startsWith('/demos/router/pages/');
      if (!known) failures.push(`${rel}: absolute asset ref outside the staged set: \`${url}\``);
    }
    // 3e. absolute fetches other than the mocked /api/* contract.
    for (const match of text.matchAll(/fetch\(\s*["'](\/[^"']*)["']/g)) {
      if (!match[1].startsWith('/api/')) failures.push(`${rel}: absolute fetch outside /api/*: \`${match[1]}\``);
    }
    if (/url\(\s*\//.test(text)) failures.push(`${rel}: root-absolute url() reference`);
  }

  // 4. router `src` targets exist on disk.
  for (const rel of scanFiles) {
    if (!rel.endsWith('.html')) continue;
    const text = stripEscapedSamples(readText(rootDir, rel));
    for (const match of text.matchAll(/(?:^|[^\w-])src="(\/[^"]+)"/g)) {
      const target = match[1].slice(1);
      if (!existsSync(join(rootDir, target))) failures.push(`${rel}: router src target missing: \`${match[1]}\``);
    }
  }

  return { failures, references: [...references].sort() };
}

/** Assert every referenced dist artifact exists (run after `npm run build`). */
export function checkDistFiles(rootDir, references) {
  const missing = [];
  for (const rel of references) {
    if (!existsSync(join(rootDir, rel))) missing.push(rel);
  }
  return missing;
}

/** Relative prefix from a staged file back to the stage root (`''`, `../`, …). @internal */
export function relToRoot(stagedRel) {
  const depth = stagedRel.split('/').length - 1;
  return depth === 0 ? '' : '../'.repeat(depth);
}

/** Relativize every root-absolute asset reference for base-path-safe hosting. @internal */
export function rewriteForStage(text, stagedRel) {
  const rel = relToRoot(stagedRel);
  return (
    text
      // importmap values + direct `/packages/*` imports (both quote styles).
      .replace(/(["'])\/packages\//g, `$1${rel}packages/`)
      // absolute module scripts and router page sources.
      // (`$1` re-emits the guard char consumed by the boundary match.)
      .replace(/((?:^|[^\w-]))src=(["'])\/(dashboard|ecommerce-demo|demos)\//g, `$1src=$2${rel}$3/`)
      // absolute nav links.
      .replace(/((?:^|[^\w-]))href=(["'])\/(index\.html|demos\/)/g, `$1href=$2${rel}$3`)
  );
}

function zenithVersion(rootDir) {
  return JSON.parse(readFileSync(join(rootDir, 'packages', 'zenith', 'package.json'), 'utf8')).version;
}

/**
 * Copy the site subset and relativize it. Returns `{ staged, rewrites }`.
 * Throws listing missing dist files (fail-closed).
 */
export function stageDemos(rootDir, outDir, references) {
  const missing = checkDistFiles(rootDir, references);
  if (missing.length > 0) {
    throw new Error(
      `missing ${missing.length} built artifact(s) — run \`npm run build\` first:\n  ${missing.join('\n  ')}`,
    );
  }
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const manifest = loadManifest(rootDir);
  const neededSlugs = new Set(references.map((ref) => ref.split('/')[1]));
  const staged = [];
  const copyInto = (srcRel, destRel = srcRel) => {
    const src = join(rootDir, srcRel);
    const dest = join(outDir, destRel);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(src, dest, { recursive: true });
  };
  copyInto(manifest.home);
  staged.push(manifest.home);
  for (const dir of ['demos', 'dashboard', 'ecommerce-demo']) {
    for (const file of listFilesRecursive(join(rootDir, dir))) {
      const rel = `${dir}/${file}`;
      copyInto(rel);
      staged.push(rel);
    }
  }
  for (const slug of [...neededSlugs].sort()) {
    copyInto(join('packages', slug, 'dist'), join('packages', slug, 'dist'));
    for (const file of listFilesRecursive(join(rootDir, 'packages', slug, 'dist'))) {
      staged.push(`packages/${slug}/dist/${file}`);
    }
  }
  // Direct references outside `dist/` (none today — integration imports dist)
  // travel as individual files so staged links never dangle.
  for (const ref of references) {
    if (ref.startsWith('packages/') && !ref.includes('/dist/') && !staged.includes(ref)) {
      copyInto(ref);
      staged.push(ref);
    }
  }
  copyInto(MANIFEST_REL);
  staged.push(MANIFEST_REL);
  // Rewrite + version stamp.
  let rewrites = 0;
  for (const rel of staged) {
    if (!/\.(html|js|mjs|cjs|css)$/.test(rel)) continue;
    const abs = join(outDir, rel);
    const before = readFileSync(abs, 'utf8');
    const after = rewriteForStage(before, rel);
    if (after !== before) {
      rewrites++;
      writeFileSync(abs, after);
    }
  }
  const version = zenithVersion(rootDir);
  writeFileSync(
    join(outDir, 'demo-version.json'),
    JSON.stringify({ version, builtAt: new Date().toISOString(), demos: manifest.demos.length }, null, 2) + '\n',
  );
  staged.push('demo-version.json');
  // Post-stage proof: no root-absolute asset reference may remain (except
  // the /api/* mock contract, zen-link/path router semantics).
  const leftovers = [];
  for (const rel of staged) {
    if (!/\.(html|js|mjs|cjs|css)$/.test(rel)) continue;
    const text = stripEscapedSamples(readFileSync(join(outDir, rel), 'utf8'));
    if (
      /["']\/packages\//.test(text) ||
      /(?:^|[^\w-])src=["']\//.test(text) ||
      /(?:^|[^\w-])href=["']\//.test(text) ||
      /fetch\(\s*["']\/(?!api\/)/.test(text) ||
      /url\(\s*\//.test(text)
    ) {
      leftovers.push(rel);
    }
  }
  if (leftovers.length > 0) {
    throw new Error(`staged output still has root-absolute refs in:\n  ${leftovers.join('\n  ')}`);
  }
  return { staged: staged.sort(), rewrites };
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.cjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

/** Serve a directory over loopback. Returns `{ url, close }`. @internal */
export function serveDirectory(dir, port = 0) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const rel = path === '/' ? 'index.html' : path.replace(/^\//, '').replace(/\/$/, '/index.html');
    const file = join(dir, rel);
    if (!file.startsWith(dir) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }
    const ext = rel.slice(rel.lastIndexOf('.'));
    res.writeHead(200, { 'content-type': MIME[ext] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      const actual = typeof address === 'object' && address !== null ? address.port : port;
      resolve({ url: `http://127.0.0.1:${actual}`, close: () => server.close() });
    });
  });
}

/** Smoke the staged site: every manifest path must answer 200. */
export async function smokeStage(rootDir, stageDir, { port = 0 } = {}) {
  const manifest = loadManifest(rootDir);
  const failures = [];
  const checked = [];
  const { url, close } = await serveDirectory(stageDir, port);
  try {
    const paths = ['/', `/${manifest.index}`, ...manifest.demos.map((d) => `/${d.path}`), '/demo-version.json'];
    for (const path of paths) {
      checked.push(path);
      let res;
      try {
        res = await fetch(`${url}${path}`);
      } catch (error) {
        failures.push(`${path}: fetch failed (${error instanceof Error ? error.message : String(error)})`);
        continue;
      }
      if (res.status !== 200) {
        failures.push(`${path}: HTTP ${res.status}`);
        continue;
      }
      const body = await res.text();
      if (body.length === 0) failures.push(`${path}: empty body`);
      if (path.endsWith('.html') && !body.includes('<title')) failures.push(`${path}: no <title> marker`);
      if (body.includes('"/packages/') || body.includes("'/packages/")) {
        failures.push(`${path}: unrewritten root-absolute /packages/ reference`);
      }
    }
  } finally {
    close();
  }
  return { failures, checked };
}

function parseArgs(argv) {
  const args = { withDist: false, smoke: false, stage: undefined, port: 0 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--with-dist') args.withDist = true;
    else if (arg === '--smoke') args.smoke = true;
    else if (arg === '--stage') args.stage = argv[++i];
    else if (arg === '--port') args.port = Number(argv[++i]);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (args.stage !== undefined && (args.stage.length === 0 || args.stage.startsWith('--'))) {
    throw new Error('--stage requires a directory');
  }
  if (!Number.isInteger(args.port) || args.port < 0) throw new Error('--port requires a non-negative integer');
  return args;
}

function fail(failures) {
  console.error(`❌ ${failures.length} demo failure(s):`);
  for (const failure of failures) console.error(`   • ${failure}`);
  process.exit(1);
}

async function main() {
  const rootDir = process.cwd();
  const args = parseArgs(process.argv.slice(2));
  const { failures, references } = auditDemos(rootDir);
  if (failures.length > 0) fail(failures);
  console.log(`✅ audit: ${references.length} workspace artifact reference(s), all demo sources consistent.`);

  const wantsStage = args.smoke || args.stage !== undefined;
  if (args.withDist || wantsStage) {
    const missing = checkDistFiles(rootDir, references);
    if (missing.length > 0) {
      fail([`missing ${missing.length} built artifact(s) — run \`npm run build\` first:`, ...missing.map((m) => `  ${m}`)]);
    }
    console.log('✅ dist: every referenced artifact exists.');
  }
  if (!wantsStage) return;

  const stageDir = args.stage ?? join(tmpdir(), `zenith-demos-${process.pid}`);
  const { staged, rewrites } = stageDemos(rootDir, stageDir, references);
  console.log(`✅ stage: ${staged.length} file(s) in ${stageDir} (${rewrites} rewritten).`);

  if (args.smoke) {
    const result = await smokeStage(rootDir, stageDir, { port: args.port });
    if (args.stage === undefined) rmSync(stageDir, { recursive: true, force: true });
    if (result.failures.length > 0) fail(result.failures);
    console.log(`✅ smoke: ${result.checked.length} path(s) answered 200.`);
  }
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
