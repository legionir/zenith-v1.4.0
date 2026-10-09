// sideEffects declarations must be truthful (#70 acceptance item 2).
// A wrong `false` lets bundlers drop code that actually runs on import —
// silent breakage. This scans each package's src for top-level executable
// statements (calls at column 0, globalThis/window/self assignments) and
// asserts:
//  - packages claiming sideEffects:false contain none,
//  - packages that do have them (router installs a popstate listener at
//    import time) declare the explicit glob list instead.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

function srcFiles(dir) {
  const base = join('packages', dir, 'src');
  if (!existsSync(base)) return [];
  const out = [];
  const stack = [base];
  while (stack.length) {
    const cur = stack.pop();
    for (const e of readdirSync(cur, { withFileTypes: true })) {
      const p = join(cur, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p);
    }
  }
  return out;
}

// module-level side-effect shapes: bare call statements, or global writes.
// Template literals are stripped first (scaffold templates contain code
// strings that are NOT module-level effects of the package itself).
const SIDE_EFFECT_RE =
  /^([a-zA-Z_$][\w$]*(\.[a-zA-Z_$][\w$]*)?\([^)]*\);|globalThis\.[\w$]+ *=|window\.[\w$]+ *=|self\.[\w$]+ *=)/;

function stripTemplates(text) {
  // remove `...` literal bodies (no nested-backtick tracking needed: sources
  // escape inner backticks as \` which the regex below skips over)
  return text.replace(/`(?:\\[\s\S]|[^\\`])*`/g, '""');
}

function sideEffectLines(dir) {
  const hits = [];
  for (const file of srcFiles(dir)) {
    const lines = stripTemplates(readFileSync(file, 'utf8')).split('\n');
    lines.forEach((line, i) => {
      if (SIDE_EFFECT_RE.test(line)) hits.push(`${file}:${i + 1} ${line.trim().slice(0, 60)}`);
    });
  }
  return hits;
}

describe('sideEffects truthfulness (#70)', () => {
  const dirs = readdirSync('packages', { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .filter((d) => existsSync(join('packages', d.name, 'package.json')))
    .map((d) => d.name);

  it('packages claiming sideEffects:false have no module-level effects', () => {
    for (const dir of dirs) {
      const pkg = JSON.parse(readFileSync(join('packages', dir, 'package.json'), 'utf8'));
      if (pkg.sideEffects !== false) continue;
      expect(sideEffectLines(dir), `${dir} must be side-effect free`).toEqual([]);
    }
  });

  it('router (popstate listener on import) declares an explicit glob', () => {
    const pkg = JSON.parse(readFileSync('packages/router/package.json', 'utf8'));
    expect(Array.isArray(pkg.sideEffects)).toBe(true);
    expect(pkg.sideEffects).toEqual(['./dist/index.js']);
    // and the scan indeed finds the effect we based that on
    expect(sideEffectLines('router').some((l) => l.includes('installPopstateListener'))).toBe(true);
  });

  it('esbuild tree-shakes an unused export away with sideEffects respected', async () => {
    // acceptance: "bundler test (esbuild) removes unused code with
    // sideEffects:false". Consumer imports one tiny symbol from the built
    // @zenith/scheduler bundle; the rest of the module must not survive.
    const esbuild = await import('esbuild');
    const consumer = join(await import('node:os').then((os) => os.tmpdir()), 'sl-consumer.js');
    const { writeFileSync } = await import('node:fs');
    writeFileSync(
      consumer,
      `import { Priority } from ${JSON.stringify(join(process.cwd(), 'node_modules/@zenith/scheduler/dist/index.js'))};\nconsole.log(Priority);\n`,
    );
    const result = await esbuild.build({
      entryPoints: [consumer],
      bundle: true,
      minify: true,
      treeShaking: true,
      write: false,
      metafile: true,
    });
    const text = result.outputFiles[0].text;
    // scheduler internals that a mere Priority import must not pull in
    expect(text).not.toContain('flushSync');
    expect(text).not.toContain('Infinite loop detected');
  });
});
