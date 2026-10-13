#!/usr/bin/env node
/**
 * #56 & #103 — Public API Surface Extractor & TypeDoc-Style Reference Generator
 *
 * 1. Scans `packages/<slug>/src/index.ts` (and local re-exports) using the TypeScript
 *    compiler AST (`typescript`).
 * 2. Extracts all exported symbols, their kind (`function`, `class`, `interface`,
 *    `type`, `const`), and release tag (`@public`, `@internal`, `@experimental`, `@deprecated`).
 * 3. Generates `docs/api/<pkg>.md` for every package and `docs/api/INDEX.md` (#103).
 * 4. Writes/verifies `docs/api/api-surface.snapshot.json` (#56) so unintentional
 *    public API additions/removals fail CI (`--check`).
 */
import ts from 'typescript';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function extractReleaseTag(node, sourceText) {
  const ranges = ts.getLeadingCommentRanges(sourceText, node.pos) || [];
  const comments = ranges.map((r) => sourceText.slice(r.pos, r.end)).join('\n');
  if (/@internal\b/.test(comments)) return 'internal';
  if (/@experimental\b|@beta\b/.test(comments)) return 'experimental';
  if (/@deprecated\b/.test(comments)) return 'deprecated';
  return 'public';
}

function resolveLocalModulePath(fromFile, spec) {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(fromFile), spec);
  for (const cand of [base, `${base}.ts`, join(base, 'index.ts')]) {
    if (existsSync(cand) && !cand.endsWith('.d.ts')) return cand;
  }
  return null;
}

export function extractPackageExports(entryFile, visited = new Set()) {
  if (!existsSync(entryFile) || visited.has(entryFile)) return new Map();
  visited.add(entryFile);

  const sourceText = readFileSync(entryFile, 'utf8');
  const sf = ts.createSourceFile(entryFile, sourceText, ts.ScriptTarget.ES2022, true);
  const symbols = new Map();

  const hasExportModifier = (node) =>
    Boolean(node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword));

  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name && hasExportModifier(stmt)) {
      symbols.set(stmt.name.text, {
        name: stmt.name.text,
        kind: 'function',
        tag: extractReleaseTag(stmt, sourceText),
      });
    } else if (ts.isClassDeclaration(stmt) && stmt.name && hasExportModifier(stmt)) {
      symbols.set(stmt.name.text, {
        name: stmt.name.text,
        kind: 'class',
        tag: extractReleaseTag(stmt, sourceText),
      });
    } else if (ts.isInterfaceDeclaration(stmt) && stmt.name && hasExportModifier(stmt)) {
      symbols.set(stmt.name.text, {
        name: stmt.name.text,
        kind: 'interface',
        tag: extractReleaseTag(stmt, sourceText),
      });
    } else if (ts.isTypeAliasDeclaration(stmt) && stmt.name && hasExportModifier(stmt)) {
      symbols.set(stmt.name.text, {
        name: stmt.name.text,
        kind: 'type',
        tag: extractReleaseTag(stmt, sourceText),
      });
    } else if (ts.isEnumDeclaration(stmt) && stmt.name && hasExportModifier(stmt)) {
      symbols.set(stmt.name.text, {
        name: stmt.name.text,
        kind: 'enum',
        tag: extractReleaseTag(stmt, sourceText),
      });
    } else if (ts.isVariableStatement(stmt) && hasExportModifier(stmt)) {
      const tag = extractReleaseTag(stmt, sourceText);
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          symbols.set(decl.name.text, {
            name: decl.name.text,
            kind: 'const',
            tag,
          });
        }
      }
    } else if (ts.isExportDeclaration(stmt)) {
      const spec =
        stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)
          ? stmt.moduleSpecifier.text
          : null;
      const targetFile = spec ? resolveLocalModulePath(entryFile, spec) : null;
      const targetSymbols = targetFile ? extractPackageExports(targetFile, new Set(visited)) : new Map();

      if (!stmt.exportClause) {
        // export * from './...'
        for (const [k, v] of targetSymbols.entries()) {
          if (!symbols.has(k)) symbols.set(k, v);
        }
      } else if (ts.isNamedExports(stmt.exportClause)) {
        const isTypeOnly = stmt.isTypeOnly;
        for (const el of stmt.exportClause.elements) {
          const exportedName = el.name.text;
          const origName = (el.propertyName ?? el.name).text;
          const fromTarget = targetSymbols.get(origName);
          symbols.set(exportedName, {
            name: exportedName,
            kind: isTypeOnly || el.isTypeOnly ? 'type' : (fromTarget?.kind ?? 'value'),
            tag: fromTarget?.tag ?? extractReleaseTag(stmt, sourceText),
          });
        }
      }
    }
  }

  return symbols;
}

export function buildApiSurfaceSnapshot(rootDir = process.cwd()) {
  const packagesDir = join(rootDir, 'packages');
  const slugs = readdirSync(packagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(packagesDir, d.name, 'src', 'index.ts')))
    .map((d) => d.name)
    .sort();

  const surface = {};
  for (const slug of slugs) {
    const pkgJson = JSON.parse(readFileSync(join(packagesDir, slug, 'package.json'), 'utf8'));
    const entry = join(packagesDir, slug, 'src', 'index.ts');
    const symbols = [...extractPackageExports(entry).values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    surface[pkgJson.name] = {
      slug,
      target: pkgJson.zenith?.target ?? 'universal',
      exports: symbols,
    };
  }
  return surface;
}

export function generateApiDocs(rootDir = process.cwd(), { checkOnly = false } = {}) {
  const apiDir = join(rootDir, 'docs', 'api');
  if (!existsSync(apiDir)) mkdirSync(apiDir, { recursive: true });

  const surface = buildApiSurfaceSnapshot(rootDir);
  const snapshotPath = join(apiDir, 'api-surface.snapshot.json');
  const serializedSnapshot = JSON.stringify(surface, null, 2) + '\n';

  if (checkOnly) {
    if (!existsSync(snapshotPath)) {
      throw new Error('Missing docs/api/api-surface.snapshot.json');
    }
    const existing = readFileSync(snapshotPath, 'utf8');
    if (existing !== serializedSnapshot) {
      throw new Error(
        'Public API surface drifted from docs/api/api-surface.snapshot.json. Run `node scripts/generate-api-docs.mjs` to update.',
      );
    }
    return { surface, updated: false };
  }

  writeFileSync(snapshotPath, serializedSnapshot, 'utf8');

  const indexLines = [
    '# مرجع کامل API پکیج‌های Zenith (`#56`, `#103`)',
    '',
    'این فهرست به‌صورت خودکار از روی AST و TSDoc تمام ۴۳ پکیج TypeScript فریم‌ورک Zenith تولید شده است.',
    '',
    '| پکیج | محیط هدف (`zenith.target`) | تعداد نمادهای عمومی | صفحهٔ مرجع API |',
    '|------|----------------------------|---------------------|----------------|',
  ];

  for (const [pkgName, info] of Object.entries(surface)) {
    const docFile = `${info.slug}.md`;
    const docPath = join(apiDir, docFile);
    indexLines.push(
      `| \`${pkgName}\` | \`${info.target}\` | ${info.exports.length} | [${docFile}](./${docFile}) |`,
    );

    // Generate per-package API doc if it doesn't already exist as a hand-authored guide
    if (!existsSync(docPath)) {
      const pkgLines = [
        `# API Reference: \`${pkgName}\``,
        '',
        `- **محیط هدف (` + '`zenith.target`' + `)**: \`${info.target}\``,
        `- **مسیر بسته**: \`packages/${info.slug}\``,
        `- **README پکیج**: [\`packages/${info.slug}/README.md\`](../../packages/${info.slug}/README.md)`,
        '',
        '## نمادهای صادرشده (Public Surface)',
        '',
        '| نام نماد | نوع (Kind) | سطح پایداری |',
        '|----------|------------|-------------|',
        ...info.exports.map((s) => `| \`${s.name}\` | \`${s.kind}\` | \`@${s.tag}\` |`),
        '',
      ];
      writeFileSync(docPath, pkgLines.join('\n'), 'utf8');
    }
  }

  writeFileSync(join(apiDir, 'INDEX.md'), indexLines.join('\n') + '\n', 'utf8');
  return { surface, updated: true };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const checkOnly = process.argv.includes('--check');
  const { surface } = generateApiDocs(process.cwd(), { checkOnly });
  console.log(
    `✅ API surface ${checkOnly ? 'verified' : 'generated'} for ${Object.keys(surface).length} packages.`,
  );
}
