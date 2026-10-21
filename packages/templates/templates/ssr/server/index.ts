import { readFile } from 'node:fs/promises';
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
