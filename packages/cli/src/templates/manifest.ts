import { indexHtmlTemplate, mainTsTemplate, viteConfigTemplate, tsConfigTemplate, readmeTemplate, gitignoreTemplate } from './application';
import { pwaManifestTemplate, pwaMainTsTemplate, pwaViteConfigTemplate, pwaReadmeTemplate } from './pwa';
import { pwaServiceWorkerTemplate } from './pwa-worker';
import { packageJsonTemplate } from './package';
import { dependencyVersion } from './versions';
export type ZenithTemplateKind = 'spa' | 'ssr' | 'pwa' | 'dashboard' | 'minimal';
export function getTemplateManifest(projectName: string, template: ZenithTemplateKind = 'spa'): Record<string, string> {
  if (!['spa', 'ssr', 'pwa', 'dashboard', 'minimal'].includes(template)) throw new RangeError('Unknown template. Choose spa, ssr, pwa, dashboard or minimal.');
  const files: Record<string, string> = {
    'package.json': packageJsonTemplate(projectName), 'tsconfig.json': tsConfigTemplate(), '.gitignore': gitignoreTemplate(),
    'test/state.test.ts': `import { expect, it } from 'vitest';\nimport { signal } from '@zenith/state';\nit('updates and disposes application state', () => { const count = signal(0); try { count.set(1); expect(count.get()).toBe(1); } finally { count.dispose(); } });\n`,
    'index.html': indexHtmlTemplate(projectName), 'src/main.ts': mainTsTemplate(), 'vite.config.ts': viteConfigTemplate(), 'README.md': readmeTemplate(projectName),
  };
  const pkg = JSON.parse(files['package.json']!) as { scripts: Record<string, string>; dependencies: Record<string, string>; devDependencies: Record<string, string> };
  if (template === 'minimal') {
    files['index.html'] = '<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Zenith</title></head><body><main id="app"><h1 zen-text="$message"></h1></main><script type="module" src="/src/main.ts"></script></body></html>\n';
    files['src/main.ts'] = "import { Zen } from '@zenith/runtime';\nZen.start(document.getElementById('app')!, { message: 'Hello Zenith' });\n";
    delete pkg.dependencies['@zenith/logger'];
  }
  if (template === 'pwa') {
    files['index.html'] = files['index.html']!.replace('</head>', '<link rel="manifest" href="/manifest.json"><meta name="theme-color" content="#3b82f6"></head>');
    files['src/main.ts'] = pwaMainTsTemplate(); files['vite.config.ts'] = pwaViteConfigTemplate(); files['README.md'] = pwaReadmeTemplate(projectName);
    files['public/manifest.json'] = pwaManifestTemplate(projectName); files['public/sw.js'] = pwaServiceWorkerTemplate();
    const manifest = JSON.parse(files['public/manifest.json']) as { icons: { src: string; sizes: string; type: string }[]; shortcuts: unknown[] };
    manifest.icons = [{ src: '/icons/app.svg', sizes: 'any', type: 'image/svg+xml' }]; manifest.shortcuts = []; files['public/manifest.json'] = JSON.stringify(manifest, null, 2);
    files['public/icons/app.svg'] = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#1d4ed8"/><path d="M128 144h256L128 368h256" fill="none" stroke="white" stroke-width="40"/></svg>\n';
    pkg.devDependencies['vite-plugin-pwa'] = '^0.21.2'; pkg.devDependencies['workbox-window'] = '^7.3.0';
  }
  if (template === 'dashboard') {
    files['index.html'] = files['index.html']!.replace('<div id="app">', '<div id="app"><nav aria-label="Dashboard"><a href="#summary">Summary</a></nav><section id="summary" aria-label="Summary"><h2>Dashboard</h2><p>Total: <span zen-text="$count"></span></p></section>');
    files['README.md'] += '\nDashboard uses the same reactive counter as a summary metric; edit src/main.ts to connect your data.\n';
  }
  if (template === 'ssr') {
    files['index.html'] = files['index.html']!.replace('<div id="app">', '<div id="app"><!--zen-outlet-->');
    pkg.dependencies['@zenith/adapter-node'] = dependencyVersion('@zenith/adapter-node'); pkg.dependencies.jsdom = '^24.0.0';
    pkg.devDependencies.tsx = '^4.23.0'; pkg.devDependencies['@types/node'] = '^22.0.0';
    pkg.scripts.dev = 'tsx server/index.ts'; pkg.scripts.build = 'tsc --noEmit && vite build'; pkg.scripts.start = 'tsx server/index.ts --production';
    files['server/index.ts'] = `import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const production = process.argv.includes('--production') || process.env.NODE_ENV === 'production';
const template = await readFile(new URL(production ? '../dist/index.html' : '../index.html', import.meta.url), 'utf8');
const vite = production ? undefined : await import('vite').then(v => v.createServer({ server: { middlewareMode: true }, appType: 'custom' }));
const { createServer } = await import('node:http');
const { createNodeHandler } = await import('@zenith/adapter-node');
const { createApp } = await import('@zenith/runtime');
const staticOptions = production ? { root: fileURLToPath(new URL('../dist', import.meta.url)) } : undefined;
const server = createServer((req, res) => {
  const render = () => { void (async () => {
    const html = vite ? await vite.transformIndexHtml(req.url ?? '/', template) : template;
    await createNodeHandler({ template: html, app: () => createApp(), state: () => ({ count: 0 }), static: staticOptions })(req, res);
  })().catch(() => { if (!res.headersSent) { res.statusCode = 500; res.end('Internal Server Error'); } else res.destroy(); }); };
  if (vite) vite.middlewares(req, res, render); else render();
});
server.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
const stop = () => { server.close(); void vite?.close(); };
process.once('SIGINT', stop); process.once('SIGTERM', stop);
`;
    files['src/vite-env.d.ts'] = '/// <reference types="vite/client" />\n';
    files['src/main.ts'] = `import { signal } from '@zenith/state';
import { createApp } from '@zenith/runtime';
const transferred = (window as Window & { __ZENITH_STATE__?: { count?: number } }).__ZENITH_STATE__;
const count = signal(import.meta.hot?.data.count ?? transferred?.count ?? 0);
const app = createApp();
app.action('increment', () => { count.set(count.get() + 1); });
app.action('decrement', () => { count.set(Math.max(0, count.get() - 1)); });
const stop = app.mount(document.getElementById('app')!, { count });
if (import.meta.hot) import.meta.hot.dispose(data => { data.count = count.get(); stop(); app.dispose(); count.dispose(); });
`;
    files['README.md'] += '\nSSR: npm run dev for Vite middleware; npm run build && npm start for the production server. Set PORT as needed. Each HTTP request creates its own renderer state.\n';
  }
  files['package.json'] = JSON.stringify(pkg, null, 2) + '\n';
  return files;
}
