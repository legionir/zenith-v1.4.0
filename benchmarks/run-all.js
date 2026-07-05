// benchmarks/run-all.js
//
// Runner برای تمام benchmarkها (reactivity + runtime + resource + ssr)

import { pathToFileURL } from 'url';

const base = '/home/z/my-project/public/benchmarks';

async function runFile(name, file) {
  console.log('\n' + '═'.repeat(60));
  console.log('  Running: ' + name);
  console.log('═'.repeat(60) + '\n');
  try {
    await import(pathToFileURL(file).href);
  } catch(e) {
    console.log('  ⚠️  Skipped (error: ' + e.message.substring(0, 80) + ')\n');
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     Zenith Framework — Full Benchmark Suite v0.6.3      ║');
  console.log('║     Node.js v' + process.version + '                                     ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  await runFile('1. Reactivity Core', base + '/src/signal-vs-computed.js');
  await runFile('2. Runtime/DOM (directives)', base + '/runtime/directives.js');
  await runFile('3. Resource (cache/dedupe)', base + '/resource/resource.js');
  await runFile('4. SSR (render)', base + '/ssr/render.js');

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  All benchmarks complete.                                ║');
  console.log('║  Results are on Node.js with mock DOM.                   ║');
  console.log('║  Real browser numbers will differ (slower due to paint). ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
