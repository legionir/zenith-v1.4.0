#!/usr/bin/env node
// Final-validation probe only. Building/running this file has NOT been performed
// during code-first implementation. Deno is required; absence is a failure.
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { bundleWorker } from '../../packages/adapter-edge/test/bundle.mjs';
const directory = await mkdtemp(join(tmpdir(), 'zenith-edge-deno-'));
try {
  const result = await bundleWorker();
  await writeFile(join(directory, 'worker.mjs'), result.outputFiles[0].text);
  await writeFile(join(directory, 'edge_test.ts'), `
import worker from './worker.mjs';
Deno.test('100 explicit-context Deno requests and safe hydration', async () => {
  const nonces = new Set<string>();
  await Promise.all(Array.from({length:100}, async (_, index) => {
    const response = await worker.fetch(new Request('https://deno.example/request-' + index));
    const html = await response.text();
    if (response.status !== 200 || !html.includes('<h1 zen-text="name">/request-' + index + '</h1>')) throw new Error('Deno request isolation/render failed');
    const nonce = /'nonce-([^']+)'/.exec(response.headers.get('content-security-policy') ?? '')?.[1];
    if (!nonce || !html.includes('nonce="' + nonce + '"')) throw new Error('Deno CSP mismatch');
    nonces.add(nonce);
  }));
  if (nonces.size !== 100) throw new Error('Deno nonce reuse');
});
`);
  await new Promise((resolve, reject) => {
    const child = spawn('deno', ['test', '--no-check', join(directory, 'edge_test.ts')], { stdio: 'inherit' });
    child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Deno validation failed (${code})`)));
  });
} finally { await rm(directory, { recursive: true, force: true }); }
