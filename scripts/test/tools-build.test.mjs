import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { buildBrowserExtension, compileVsCode, validateExtension } from '../build-tools.mjs';
import { zipFiles } from '../lib/zip.mjs';

const roots = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const manifest = { manifest_version: 3, version: '1.2.3', devtools_page: 'devtools.html', action: { default_popup: 'popup.html' }, background: { service_worker: 'background.js' }, content_security_policy: { extension_pages: "default-src 'self'; script-src 'self'; object-src 'none'" } };
function fixture(extra = {}) {
  const root = mkdtempSync(join(tmpdir(), 'zenith-tools-'));
  roots.push(root);
  writeFileSync(join(root, 'LICENSE'), 'MIT test license');
  const dir = join(root, 'tools/devtools-extension');
  mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries({
    'package.json': '{"version":"1.2.3"}',
    'README.md': 'Test extension installation guide',
    'PRIVACY.md': 'Test privacy policy: collects nothing',
    'manifest.json': JSON.stringify(manifest),
    'background.js': 'self.addEventListener("message", () => {});',
    'popup.html': '<script src="background.js"></script>',
    'devtools.html': '<script src="background.js"></script>',
    ...extra,
  })) writeFileSync(join(dir, name), body);
  return root;
}

describe('explicit tools build/package (#51/#97)', () => {
  it('fails on a VS Code compiler error instead of skipping the tool', () => {
    let command;
    expect(() => compileVsCode({ root: '/fixture', run: (...args) => { command = args; return { status: 2 }; } })).toThrow('compilation failed');
    expect(command[1].at(-1).replaceAll('\\', '/')).toBe('/fixture/tools/vscode-extension/tsconfig.json');
  });
  it('fails on a missing compiler process', () => {
    expect(() => compileVsCode({ run: () => ({ status: null }) })).toThrow('spawn error');
  });
  it('builds two actual browser packages with matching versions and Firefox background compatibility', async () => {
    const root = fixture();
    const artifacts = await buildBrowserExtension({ root, pack: true });
    expect(artifacts).toHaveLength(2);
    const source = join(root, 'tools/devtools-extension/dist');
    expect(JSON.parse(readFileSync(join(source, 'chrome/manifest.json'), 'utf8')).background.service_worker).toBe('background.js');
    expect(readFileSync(join(source, 'chrome/LICENSE'), 'utf8')).toBe('MIT test license');
    expect(readFileSync(join(source, 'firefox/README.md'), 'utf8')).toContain('installation guide');
    expect(readFileSync(join(source, 'chrome/PRIVACY.md'), 'utf8')).toContain('collects nothing');
    const firefox = JSON.parse(readFileSync(join(source, 'firefox/manifest.json'), 'utf8'));
    expect(firefox.background.scripts).toEqual(['background.js']);
    expect(firefox.browser_specific_settings.gecko.id).toBeTruthy();
    for (const artifact of artifacts) expect(readFileSync(artifact).readUInt32LE(0)).toBe(0x04034b50);
    const first = artifacts.map(path => readFileSync(path));
    await buildBrowserExtension({ root, pack: true });
    artifacts.forEach((path, i) => expect(readFileSync(path)).toEqual(first[i]));
  });
  it('fails when JavaScript cannot be compiled', async () => {
    await expect(buildBrowserExtension({ root: fixture({ 'background.js': 'function {' }) })).rejects.toThrow();
  });
  it('fails on manifest drift or a missing declared entry', async () => {
    await expect(buildBrowserExtension({ root: fixture({ 'package.json': '{"version":"9.0.0"}' }) })).rejects.toThrow('version drift');
    expect(() => validateExtension(manifest, new Map())).toThrow('Missing extension entry');
  });
  it('rejects remote executable assets and dangling local HTML assets', () => {
    const files = new Map(['background.js', 'devtools.html', 'popup.html'].map(name => [name, Buffer.from('')]));
    files.set('popup.html', Buffer.from('<script src="https://example.invalid/remote.js"></script>'));
    expect(() => validateExtension(manifest, files)).toThrow('Remote');
    files.set('popup.html', Buffer.from('<script src="missing.js"></script>'));
    expect(() => validateExtension(manifest, files)).toThrow('Missing missing.js');
  });
  it('normal discovery and test config keep tools separate without omitting tool tests', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.workspaces).toContain('tools/*');
    expect(pkg.scripts.build).toContain('build:tools');
    expect(readFileSync('vitest.config.ts', 'utf8')).toContain('tools/*/test/**/*.test.ts');
    expect(readFileSync('.github/workflows/main.yml', 'utf8')).toContain('npm run package:tools');
  });
  it('no live file references the pre-#51 packages/ extension paths', () => {
    // The two extensions used to live under packages/; since the #51 move the
    // only legitimate mentions of the old paths are dated history snapshots
    // (docs/progress/*, immutable per R01) — everything else is live config,
    // code or docs and must use tools/.
    const OLD = new RegExp(
      'packages/(?:devtools-extension|vscode-extension|zenith-vscode)(?![\\w-])',
    );
    const SKIP_DIRS = new Set([
      'node_modules', 'dist', 'out', 'coverage', 'artifacts', '.git',
      '.vscode-test', 'tmp-scaffold-verify',
    ]);
    const HISTORY_PREFIXES = ['docs/progress/'];
    const SELF = join('scripts', 'test', 'tools-build.test.mjs');
    const TEXT_EXT =
      /\.(mjs|cjs|js|jsx|ts|tsx|mts|cts|json|md|mdx|yml|yaml|html|css|txt)$/;
    const TEXT_BASENAMES = new Set(['CODEOWNERS', 'f-vscodeignore']);
    const offenders = [];
    function scanFile(rel) {
      if (rel === SELF) return;
      if (HISTORY_PREFIXES.some((p) => rel.startsWith(p))) return;
      const base = rel.split(/[\\/]/).pop();
      if (!TEXT_EXT.test(base) && !TEXT_BASENAMES.has(base)) return;
      let text;
      try {
        const buf = readFileSync(rel);
        if (buf.length > 1024 * 1024 || buf.includes(0)) return;
        text = buf.toString('utf8');
      } catch {
        return;
      }
      if (OLD.test(text)) offenders.push(rel);
    }
    function walk(dir) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const rel = join(dir, entry.name);
        if (entry.isDirectory()) walk(rel);
        else scanFile(rel);
      }
    }
    for (const dir of ['scripts', 'tools', '.github', 'docs']) walk(dir);
    for (const file of [
      'package.json', 'tsconfig.json', 'vitest.config.ts', 'eslint.config.mjs',
      'index.html', 'README.md', 'ARCHITECTURE.md', 'f-size-limit.json',
      'STANDARDIZATION-PLAN.md', 'NEW-PACKAGES-SPEC.md', 'PRODUCTION-READINESS.md',
      'CODEOWNERS',
    ]) {
      if (existsSync(file)) scanFile(file);
    }
    for (const dir of readdirSync('packages', { withFileTypes: true })) {
      if (!dir.isDirectory() || SKIP_DIRS.has(dir.name)) continue;
      for (const file of ['package.json', 'tsconfig.json']) {
        const rel = join('packages', dir.name, file);
        if (existsSync(rel)) scanFile(rel);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('reproducible ZIP writer', () => {
  it('round-trips compressed file contents and uses stable central-directory offsets', () => {
    const archive = zipFiles([{ name: 'nested/file.txt', data: Buffer.from('hello world') }]);
    const length = archive.readUInt16LE(26);
    const size = archive.readUInt32LE(18);
    expect(archive.subarray(30, 30 + length).toString()).toBe('nested/file.txt');
    expect(inflateRawSync(archive.subarray(30 + length, 30 + length + size)).toString()).toBe('hello world');
    const central = 30 + length + size;
    expect(archive.readUInt32LE(central)).toBe(0x02014b50);
    expect(archive.readUInt32LE(central + 42)).toBe(0);
    expect(archive.readUInt32LE(archive.length - 22)).toBe(0x06054b50);
  });
  it('sorts names independently of input order and rejects path escapes/duplicates', () => {
    const a = { name: 'a.txt', data: 'a' }, b = { name: 'b.txt', data: 'b' };
    expect(zipFiles([b, a])).toEqual(zipFiles([a, b]));
    for (const name of ['../file', '/file', 'a\\b', 'a/../file']) expect(() => zipFiles([{ name, data: '' }])).toThrow();
    expect(() => zipFiles([a, a])).toThrow('duplicate');
  });
});
