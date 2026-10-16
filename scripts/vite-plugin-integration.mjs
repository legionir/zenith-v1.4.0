#!/usr/bin/env node
// Real Vite 6/7 build + development-server fixture (#13). Requires npm run build.
// `node scripts/vite-plugin-integration.mjs [6|7]`; no version argument runs both.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { zenithPlugin } from '../packages/vite-plugin/dist/index.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const targets = {
  6: createRequire(join(root, 'packages/vite-plugin/package.json')),
  7: createRequire(join(root, 'package.json')),
};
const majors = process.argv[2] ? [Number(process.argv[2])] : [6, 7];
for (const major of majors) {
  assert.ok(targets[major], 'Expected Vite major 6 or 7');
  const manifest = targets[major].resolve('vite/package.json');
  const { version } = JSON.parse(await readFile(manifest, 'utf8'));
  assert.equal(Number(version.split('.')[0]), major, `Wrong Vite resolved: ${version}`);
  const { build, createServer } = await import(
    pathToFileURL(join(dirname(manifest), 'dist/node/index.js')).href
  );
  // Inside the checkout so compiled runtime imports resolve to this workspace,
  // not old registry packages. Always remove the fixture even when Vite fails.
  const tempBase = join(root, 'node_modules/.cache/zenith-vite-integration');
  await mkdir(tempBase, { recursive: true });
  const fixture = await mkdtemp(join(tempBase, `vite-${major}-`));
  let server;
  try {
    const html =
      '<!doctype html><html><head><title>Vite fixture</title></head><body><p zen-text="$title"></p></body></html>';
    await writeFile(join(fixture, 'index.html'), html);
    const output = await build({
      root: fixture,
      configFile: false,
      logLevel: 'error',
      plugins: [zenithPlugin({ compile: { enabled: true, strict: true } })],
      build: { write: false, minify: false },
    });
    assert.ok(!Array.isArray(output) && 'output' in output, 'Expected Rollup output');
    const builtHtml = output.output.find((entry) => entry.fileName === 'index.html');
    assert.ok(builtHtml && 'source' in builtHtml);
    assert.doesNotMatch(String(builtHtml.source), /zen-text=/);
    assert.match(String(builtHtml.source), /<script type="module"/);
    const chunks = output.output.filter((entry) => entry.type === 'chunk');
    assert.ok(
      chunks.some((chunk) => chunk.code.includes('Compiled template executed:')),
      'Virtual compiled module must be bundled',
    );
    assert.ok(
      chunks.every((chunk) => !/from\s+['"]@zenith\//.test(chunk.code)),
      'No unresolved runtime imports',
    );

    server = await createServer({
      root: fixture,
      configFile: false,
      logLevel: 'error',
      plugins: [zenithPlugin({ autoInjectDevtools: false })],
      server: { host: '127.0.0.1', port: 0 },
    });
    await server.listen();
    const address = server.httpServer.address();
    assert.ok(address && typeof address !== 'string');
    const response = await fetch(`http://127.0.0.1:${address.port}/`);
    assert.equal(response.status, 200);
    const devHtml = await response.text();
    assert.match(devHtml, /zen-text="\$title"/);
    // Pre-order inline module tags become Vite HTML-proxy modules. Fetch the
    // generated module as a browser would instead of invoking the hook directly.
    const hmrProxy = [...devHtml.matchAll(/src="([^"]+html-proxy[^"]+)"/g)][0]?.[1];
    assert.ok(hmrProxy, 'Expected a Vite HTML-proxy module for the HMR client');
    const hmrResponse = await fetch(`http://127.0.0.1:${address.port}${hmrProxy}`);
    assert.equal(hmrResponse.status, 200);
    assert.match(await hmrResponse.text(), /zenith:html-update/);
    assert.match(devHtml, /\/@vite\/client/);
    console.log(
      `Vite ${version}: production compile/bundle and real dev-server HTTP response passed`,
    );
  } finally {
    await server?.close();
    await rm(fixture, { recursive: true, force: true });
  }
}
