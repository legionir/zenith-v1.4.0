import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULTS,
  ScaffoldError,
  TEMPLATE_KINDS,
  dependencyVersion,
  getTemplateManifest,
  indexHtmlTemplate,
  listTemplateFiles,
  packageJsonTemplate,
  pwaManifestTemplate,
  renderTemplateFile,
  scaffoldProject,
  validateProjectName,
  type ScaffoldHost,
  type ZenithTemplateKind,
} from '../src/index.js';

const TEMPLATES_ROOT = new URL('../templates/', import.meta.url);

function diskFiles(kind: ZenithTemplateKind): string[] {
  const out = new Set<string>();
  const walk = (dir: string, prefix: string): void => {
    const full = join(TEMPLATES_ROOT.pathname, dir);
    if (!existsSync(full) || !statSync(full).isDirectory()) return;
    for (const entry of readdirSync(full).sort()) {
      const st = statSync(join(full, entry));
      if (st.isDirectory()) walk(`${dir}/${entry}`, `${prefix}${entry}/`);
      else out.add(`${prefix}${entry}`);
    }
  };
  walk('shared', '');
  walk(kind, '');
  out.add('.gitignore');
  return [...out].sort();
}

function memoryHost(): ScaffoldHost & { files: Map<string, string>; dirs: Set<string> } {
  const files = new Map<string, string>();
  const dirs = new Set<string>(['/cwd']);
  return {
    files,
    dirs,
    existsSync: (p) => files.has(p) || dirs.has(p),
    mkdirSync: (p) => {
      dirs.add(p);
    },
    writeFileSync: (p, content, flag) => {
      if (flag === 'wx' && (files.has(p) || dirs.has(p))) {
        const error = new Error('EEXIST') as NodeJS.ErrnoException;
        error.code = 'EEXIST';
        throw error;
      }
      files.set(p, content);
    },
  };
}

describe('@zenith/templates', () => {
  it('every manifest key comes from a real file on disk (no hidden literals)', () => {
    for (const kind of TEMPLATE_KINDS) {
      const manifestKeys = Object.keys(getTemplateManifest('disk-check', kind)).sort();
      expect(manifestKeys, kind).toEqual(diskFiles(kind));
    }
  });

  it('renders the base layout for every kind without workspace protocols', () => {
    for (const kind of TEMPLATE_KINDS) {
      const files = getTemplateManifest('consumer-app', kind);
      const pkg = JSON.parse(files['package.json'] as string);
      expect(files['index.html']).toContain('src="/src/main.ts"');
      expect(files['src/main.ts']).toBeTruthy();
      expect(files['main.ts']).toBeUndefined();
      expect(JSON.stringify(pkg)).not.toContain('workspace:');
      expect(Object.keys(pkg.scripts)).toContain('build');
      expect(pkg.scripts.test).toBe('vitest run');
      expect(pkg.devDependencies.vitest).toBeTruthy();
      expect(pkg.engines.node).toContain('20.19');
      expect(pkg.dependencies['@zenith/state']).toBeTruthy();
      expect(files['test/state.test.ts']).toContain('count.set(1)');
      if (kind === 'ssr') {
        expect(files['server/index.ts']).toContain('createNodeHandler');
        expect(pkg.dependencies['jsdom']).toBeTruthy();
        expect(files['index.html']).toContain('<!--zen-outlet-->');
        expect(files['server/index.ts']).toContain('app: () => createApp()');
        expect(files['src/main.ts']).toContain('__ZENITH_STATE__');
        expect(files['src/main.ts']).toContain('stop(); app.dispose(); count.dispose()');
        expect(files['src/vite-env.d.ts']).toContain('vite/client');
      }
      if (kind === 'pwa') {
        expect(pkg.devDependencies['vite-plugin-pwa']).toBeTruthy();
        expect(files['public/sw.js']).toBeTruthy();
        const manifest = JSON.parse(files['public/manifest.json'] as string);
        for (const icon of manifest.icons) expect(files['public' + icon.src]).toBeTruthy();
      }
    }
  });

  it('does not disguise unsupported template names', () => {
    expect(() => getTemplateManifest('app', 'not-real' as ZenithTemplateKind)).toThrow(RangeError);
    expect(() => listTemplateFiles('not-real' as ZenithTemplateKind)).toThrow(RangeError);
    expect(() => renderTemplateFile('spa', '../package.json', { projectName: 'x' })).toThrow(
      ScaffoldError,
    );
  });

  it('escapes project names in HTML without executable markup', () => {
    const html = indexHtmlTemplate('<script>alert(1)</script>');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('emits genuinely distinct dashboard and minimal entries', () => {
    expect(getTemplateManifest('app', 'dashboard')['index.html']).toContain('Dashboard');
    expect(getTemplateManifest('app', 'minimal')['src/main.ts']).not.toContain('increment');
    expect(getTemplateManifest('app', 'minimal')['package.json']).not.toContain('@zenith/logger');
  });

  it('lowercases package names and pins manifest versions', () => {
    expect(JSON.parse(packageJsonTemplate('My-App')).name).toBe('my-app');
    expect(JSON.parse(pwaManifestTemplate('my-pwa')).display).toBe('standalone');
    expect(JSON.parse(pwaManifestTemplate('averylongprojectname')).short_name).toHaveLength(12);
  });

  it('validates project names like the CLI (traversal, absolute, reserved)', () => {
    expect(validateProjectName('my-app', '/cwd')).toBe(null);
    expect(validateProjectName('../x', '/cwd')).not.toBe(null);
    expect(validateProjectName('/etc/x', '/cwd')).not.toBe(null);
    expect(validateProjectName('a/b', '/cwd')).not.toBe(null);
    expect(validateProjectName('con', '/cwd')).not.toBe(null);
    expect(validateProjectName('', '/cwd')).not.toBe(null);
  });

  it('dry-run computes without writing; write creates layout + empty dirs', () => {
    const host = memoryHost();
    const dry = scaffoldProject({ name: 'demo', kind: 'spa', cwd: '/cwd', dryRun: true }, host);
    expect(dry.written).toEqual([]);
    expect(host.files.size).toBe(0);
    expect(Object.keys(dry.files)).toContain('src/main.ts');

    const real = scaffoldProject({ name: 'demo', kind: 'spa', cwd: '/cwd' }, host);
    expect(real.destination).toBe('/cwd/demo');
    expect(real.written.length).toBeGreaterThan(5);
    expect(host.dirs.has('/cwd/demo/src/components')).toBe(true);
    expect(host.dirs.has('/cwd/demo/pages')).toBe(true);
    expect(host.files.get('/cwd/demo/package.json')).toContain('"demo"');
  });

  it('refuses existing directories without force and overwrites with force', () => {
    const host = memoryHost();
    scaffoldProject({ name: 'taken', cwd: '/cwd' }, host);
    expect(() => scaffoldProject({ name: 'taken', cwd: '/cwd' }, host)).toThrow(ScaffoldError);
    const forced = scaffoldProject({ name: 'taken', cwd: '/cwd', force: true }, host);
    expect(forced.written.length).toBeGreaterThan(0);
    expect(() => scaffoldProject({ name: '../out', cwd: '/cwd' }, host)).toThrow(ScaffoldError);
  });

  it('every template dependency resolves to a pinned range', () => {
    for (const kind of TEMPLATE_KINDS) {
      const pkg = JSON.parse(getTemplateManifest('deps', kind)['package.json'] as string);
      for (const name of [
        ...Object.keys(pkg.dependencies),
        ...Object.keys(pkg.devDependencies),
      ]) {
        if (name.startsWith('@zenith/')) expect(() => dependencyVersion(name)).not.toThrow();
      }
    }
    expect(() => dependencyVersion('@zenith/nope')).toThrow(RangeError);
  });

  it('adopts the eslint-plugin in every kind with no leftover tokens (#159)', () => {
    for (const kind of TEMPLATE_KINDS) {
      const files = getTemplateManifest('linted', kind);
      const pkg = JSON.parse(files['package.json'] as string);
      expect(pkg.scripts.lint).toBe('eslint .');
      expect(pkg.devDependencies['@zenith/eslint-plugin']).toMatch(/^\^\d+\.\d+\.\d+$/);
      expect(pkg.devDependencies.eslint).toBeTruthy();
      expect(pkg.devDependencies['typescript-eslint']).toBeTruthy();
      expect(files['eslint.config.mjs']).toContain('@zenith/eslint-plugin');
      expect(files['eslint.config.mjs']).toContain('configs.library');
      expect(files['eslint.config.mjs']).toContain('configs.template');
      expect(files['package.json'] as string).not.toMatch(/__[A-Z_]+__/);
    }
  });

  it('exposes frozen DEFAULTS', () => {
    expect(Object.isFrozen(DEFAULTS)).toBe(true);
    expect(DEFAULTS.kind).toBe('spa');
    expect(readFileSync(new URL('../templates/shared/tsconfig.json', import.meta.url), 'utf8')).toContain(
      '"strict": true',
    );
  });
});
