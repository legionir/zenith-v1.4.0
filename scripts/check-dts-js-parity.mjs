#!/usr/bin/env node
/**
 * #140 — Verify parity between TypeScript declaration exports (`.d.ts` / AST surface)
 * and runtime JavaScript exports across all Zenith packages.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SNAPSHOT_PATH = path.join(ROOT, 'docs', 'api', 'api-surface.snapshot.json');

export function checkDtsJsParity() {
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  const mismatches = [];
  let checkedPackages = 0;

  for (const [pkgName, pkgMeta] of Object.entries(snapshot)) {
    const slug = pkgMeta.slug ?? pkgName.replace(/^@zenith\//, '');
    const symbols = pkgMeta.exports ?? [];
    const entryPath = path.join(ROOT, 'packages', slug, 'src', 'index.ts');
    if (!fs.existsSync(entryPath)) continue;

    // Transpile entrypoint with esbuild/TypeScript transpileModule to verify JS export emission
    const src = fs.readFileSync(entryPath, 'utf8');
    const transpiled = ts.transpileModule(src, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;

    const valueSymbols = symbols.filter(
      (s) => s.kind !== 'type' && s.kind !== 'interface' && s.name !== '*',
    );

    // If package has re-exports (`export * from`), also inspect direct child modules
    const srcDir = path.dirname(entryPath);
    let combinedJs = transpiled;
    for (const f of fs.readdirSync(srcDir)) {
      if (f.endsWith('.ts') && f !== 'index.ts') {
        const subSrc = fs.readFileSync(path.join(srcDir, f), 'utf8');
        combinedJs +=
          '\n' +
          ts.transpileModule(subSrc, {
            compilerOptions: {
              module: ts.ModuleKind.ESNext,
              target: ts.ScriptTarget.ES2022,
            },
          }).outputText;
      }
    }

    for (const sym of valueSymbols) {
      const escaped = sym.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`);
      if (!regex.test(combinedJs)) {
        mismatches.push({ pkg: pkgName, symbol: sym.name, kind: sym.kind });
      }
    }
    checkedPackages++;
  }

  return { checkedPackages, mismatches };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { checkedPackages, mismatches } = checkDtsJsParity();
  if (mismatches.length > 0) {
    console.error('❌ .d.ts ↔ JS export parity mismatches found:');
    for (const m of mismatches) {
      console.error(`  - ${m.pkg}: missing runtime JS export "${m.symbol}" (${m.kind})`);
    }
    process.exit(1);
  }
  console.log(`✅ .d.ts ↔ JS export parity verified across ${checkedPackages} packages.`);
}
