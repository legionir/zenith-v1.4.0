import { expect, it } from 'vitest';
import { getTemplateManifest, indexHtmlTemplate, type ZenithTemplateKind } from '../src/templates';
const kinds: ZenithTemplateKind[] = ['spa', 'ssr', 'pwa', 'dashboard', 'minimal'];
it.each(kinds)('generates a self-contained %s layout without workspace protocols or missing entry points', kind => {
  const files = getTemplateManifest('consumer-app', kind); const pkg = JSON.parse(files['package.json']!);
  expect(files['index.html']).toContain('src="/src/main.ts"'); expect(files['src/main.ts']).toBeTruthy(); expect(files['main.ts']).toBeUndefined();
  expect(JSON.stringify(pkg)).not.toContain('workspace:'); expect(Object.keys(pkg.scripts)).toContain('build');
  if (kind === 'ssr') { expect(files['server/index.ts']).toContain('createNodeHandler'); expect(pkg.dependencies.jsdom).toBeTruthy(); }
  if (kind === 'pwa') { expect(pkg.devDependencies['vite-plugin-pwa']).toBeTruthy(); expect(files['public/sw.js']).toBeTruthy(); const manifest = JSON.parse(files['public/manifest.json']!); for (const icon of manifest.icons) expect(files['public' + icon.src]).toBeTruthy(); }
});
it('does not disguise unsupported template names as spa', () => { expect(() => getTemplateManifest('app', 'not-real' as ZenithTemplateKind)).toThrow(); });
it('escapes titles without emitting executable project-name markup', () => { const html = indexHtmlTemplate('<script>alert(1)</script>'); expect(html).not.toContain('<script>alert(1)</script>'); expect(html).toContain('&lt;script&gt;'); });
it('emits genuinely distinct dashboard and minimal entries', () => { expect(getTemplateManifest('app', 'dashboard')['index.html']).toContain('Dashboard'); expect(getTemplateManifest('app', 'minimal')['src/main.ts']).not.toContain('increment'); });
it.each(kinds)('includes a real runnable test and explicit build-tool engines in %s', kind => {
  const files = getTemplateManifest('consumer-app', kind); const pkg = JSON.parse(files['package.json']!);
  expect(pkg.scripts.test).toBe('vitest run'); expect(pkg.devDependencies.vitest).toBeTruthy(); expect(pkg.engines.node).toContain('20.19');
  expect(pkg.dependencies['@zenith/state']).toBeTruthy(); expect(files['test/state.test.ts']).toContain('count.set(1)');
});

it('wires the SSR shell to a fresh server App and transfers state into the disposable HMR client', () => {
  const files = getTemplateManifest('ssr-owner', 'ssr');
  expect(files['index.html']).toContain('<!--zen-outlet-->');
  expect(files['server/index.ts']).toContain('app: () => createApp()');
  expect(files['src/main.ts']).toContain('__ZENITH_STATE__'); expect(files['src/main.ts']).toContain('import.meta.hot?.data.count');
  expect(files['src/main.ts']).toContain('stop(); app.dispose(); count.dispose()'); expect(files['src/vite-env.d.ts']).toContain('vite/client');
});
