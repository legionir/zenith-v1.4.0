import { build } from 'esbuild';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync, lstatSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { zipFiles } from './lib/zip.mjs';
import { binScript } from './lib/proc.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

// #57 — like scripts/build-all.mjs: shipped tools are production builds
// (`__ZENITH_DEV__` stripped) unless NODE_ENV=development is explicit.
process.env.NODE_ENV ??= 'production';

export function validateExtension(manifest, files) {
  if (manifest.manifest_version !== 3 || !/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error('Invalid extension manifest/version');
  const required = [manifest.devtools_page, manifest.action?.default_popup, manifest.background?.service_worker, ...(manifest.background?.scripts ?? [])].filter(Boolean);
  for (const name of required) if (!files.has(name)) throw new Error(`Missing extension entry: ${name}`);
  if (!manifest.content_security_policy?.extension_pages?.includes("script-src 'self'")) throw new Error('Extension requires a self-only script CSP');
  for (const [name, bytes] of files) {
    if (!name.endsWith('.html')) continue;
    const html = bytes.toString();
    for (const match of html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/gi)) {
      if (/^(?:https?:|\/\/|data:)/i.test(match[1])) throw new Error(`Remote executable/style asset in ${name}`);
      if (!files.has(match[1])) throw new Error(`Missing ${match[1]} referenced by ${name}`);
    }
  }
}

export async function buildBrowserExtension({ root = ROOT, pack = false } = {}) {
  const source = join(root, 'tools/devtools-extension');
  const original = JSON.parse(readFileSync(join(source, 'manifest.json'), 'utf8'));
  const manifestVersion = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8')).version;
  if (manifestVersion !== original.version) throw new Error('Extension manifest/package version drift');
  const files = new Map();
  for (const name of readdirSync(source).sort()) {
    const path = join(source, name);
    if (lstatSync(path).isSymbolicLink()) throw new Error(`Symlink in extension source: ${name}`);
    if (!lstatSync(path).isFile() || !/\.(?:js|html|css|json|png|svg)$/.test(name) || ['package.json', 'package-lock.json'].includes(name)) continue;
    files.set(name, readFileSync(path));
  }
  for (const [name, bytes] of [...files]) {
    if (!name.endsWith('.js')) continue;
    const result = await build({ stdin: { contents: bytes.toString(), sourcefile: name, loader: 'js' }, write: false, platform: 'browser', target: ['chrome109', 'firefox115'], format: 'iife', logLevel: 'silent' });
    files.set(name, Buffer.from(result.outputFiles[0].contents));
  }
  files.set('LICENSE', readFileSync(join(root, 'LICENSE')));
  if (existsSync(join(source, 'README.md'))) files.set('README.md', readFileSync(join(source, 'README.md')));
  // #97 — the public privacy policy ships inside the installable package so
  // the store page can link the exact text users install.
  if (existsSync(join(source, 'PRIVACY.md'))) files.set('PRIVACY.md', readFileSync(join(source, 'PRIVACY.md')));
  const output = [];
  for (const browser of ['chrome', 'firefox']) {
    const manifest = structuredClone(original);
    if (browser === 'firefox') {
      manifest.background = { scripts: [original.background.service_worker] };
      manifest.browser_specific_settings = { gecko: { id: 'zenith-devtools@legionir.github.io', strict_min_version: '115.0', data_collection_permissions: { required: ['none'] } } };
    }
    const payload = new Map(files);
    payload.set('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
    validateExtension(manifest, payload);
    const destination = join(source, 'dist', browser);
    rmSync(destination, { recursive: true, force: true });
    mkdirSync(destination, { recursive: true });
    for (const [name, bytes] of payload) writeFileSync(join(destination, name), bytes);
    if (pack) {
      const artifact = join(root, 'artifacts/tools', `zenith-devtools-${browser}-${original.version}.zip`);
      mkdirSync(dirname(artifact), { recursive: true });
      writeFileSync(artifact, zipFiles([...payload].map(([name, data]) => ({ name, data }))));
      output.push(artifact);
    }
  }
  return output;
}

export function compileVsCode({ root = ROOT, run = spawnSync } = {}) {
  const result = run(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', join(root, 'tools/vscode-extension/tsconfig.json')], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`VS Code compilation failed (${result.status ?? 'spawn error'})`);
}

export async function buildTools({ root = ROOT, only, pack = false, run = spawnSync } = {}) {
  if (only && !['devtools-extension', 'vscode-extension'].includes(only)) throw new Error(`Unknown tool ${only}`);
  const artifacts = [];
  if (!only || only === 'devtools-extension') artifacts.push(...await buildBrowserExtension({ root, pack }));
  if (!only || only === 'vscode-extension') {
    compileVsCode({ root, run });
    if (pack) {
      const version = JSON.parse(readFileSync(join(root, 'tools/vscode-extension/package.json'), 'utf8')).version;
      const destination = join(root, 'artifacts/tools', `zenith-vscode-${version}.vsix`);
      mkdirSync(dirname(destination), { recursive: true });
      const result = run(process.execPath, [binScript(root, '@vscode/vsce', 'vsce'), 'package', '--no-dependencies', '--out', destination], { cwd: join(root, 'tools/vscode-extension'), stdio: 'inherit' });
      if (result.status !== 0 || !existsSync(destination)) throw new Error('VSIX packaging failed');
      artifacts.push(destination);
    }
  }
  return artifacts;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const artifacts = await buildTools({ only: process.argv.find(a => a.startsWith('--only='))?.slice(7), pack: process.argv.includes('--package') });
    process.stdout.write(`Tools built. ${artifacts.join('\n')}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
