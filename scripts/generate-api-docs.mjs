#!/usr/bin/env node
/**
 * #56 & #103 — Public API Surface Extractor & TypeDoc-Style Reference Generator
 *
 * 1. Scans `packages/<slug>/src/index.ts`, every public subpath entry
 *    (`src/<sub>.ts` from the single table in `scripts/lib/exports-shape.mjs`,
 *    e.g. `@zenith/schema/attr`), and local re-exports using the TypeScript
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
import { PUBLIC_SUBPATHS, subpathKey } from './lib/exports-shape.mjs';

function extractReleaseTag(node, sourceText) {
  const ranges = ts.getLeadingCommentRanges(sourceText, node.pos) || [];
  const comments = ranges.map((r) => sourceText.slice(r.pos, r.end)).join('\n');
  if (/@internal\b/.test(comments)) return 'internal';
  if (/@experimental\b|@beta\b/.test(comments)) return 'experimental';
  if (/@deprecated\b/.test(comments)) return 'deprecated';
  return 'public';
}

/** بازصادرات از پکیج‌های ورک‌اسپیس (`export * from '@zenith/ssr'`). */
export function collectWorkspaceReexports(entryFile) {
  if (!existsSync(entryFile)) return [];
  const sourceText = readFileSync(entryFile, 'utf8');
  const sf = ts.createSourceFile(entryFile, sourceText, ts.ScriptTarget.ES2022, true);
  const out = [];
  for (const stmt of sf.statements) {
    if (!ts.isExportDeclaration(stmt) || !stmt.moduleSpecifier) continue;
    if (!ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    const spec = stmt.moduleSpecifier.text;
    if (spec.startsWith('.') || spec.startsWith('node:')) continue;
    if (!spec.startsWith('@zenith/') && spec !== 'zenith' && !spec.startsWith('zenith/')) continue;
    if (!out.includes(spec)) out.push(spec);
  }
  return out;
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
      const targetSymbols = targetFile
        ? extractPackageExports(targetFile, new Set(visited))
        : new Map();

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
    .filter(
      (d) =>
        d.isDirectory() &&
        // tmp-* = scratch packages created (and removed) by the scaffold test while suites run in parallel
        !d.name.startsWith('tmp-') &&
        existsSync(join(packagesDir, d.name, 'package.json')) &&
        existsSync(join(packagesDir, d.name, 'src', 'index.ts')),
    )
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

    // #142/#120 — زیرمسیرهای عمومی هم بخشی از API عمومی‌اند (مثل
    // `@zenith/schema/attr`) و باید در snapshot و مرجع دیده شوند. فهرست از
    // جدول یکتای scripts/lib/exports-shape.mjs می‌آید، نه از package.json.
    for (const sub of PUBLIC_SUBPATHS[pkgJson.name] ?? []) {
      const subEntry = join(packagesDir, slug, 'src', `${sub}.ts`);
      if (!existsSync(subEntry)) continue;
      const subSymbols = [...extractPackageExports(subEntry).values()].sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      const reexports = collectWorkspaceReexports(subEntry);
      surface[`${pkgJson.name}/${sub}`] = {
        slug,
        subpath: sub,
        target: pkgJson.zenith?.target ?? 'universal',
        entry: `src/${sub}.ts`,
        ...(reexports.length > 0 ? { reexports } : {}),
        exports: subSymbols,
      };
    }
  }
  return surface;
}

/** نام فایل doc برای یک کلید سطح (`@zenith/schema` یا `@zenith/schema/attr`). */
export function apiDocFileName(info) {
  return info.subpath ? `${info.slug}--${info.subpath.replace(/\//g, '-')}.md` : `${info.slug}.md`;
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
    const docFile = apiDocFileName(info);
    const docPath = join(apiDir, docFile);
    if (info.subpath) continue; // جدول دوم برای زیرمسیرها (پایین‌تر)
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

  // ── زیرمسیرهای عمومی (#142/#120): صفحهٔ مستقل + ردیف در همان INDEX ──
  const subpathRows = [];
  for (const [specifier, info] of Object.entries(surface)) {
    if (!info.subpath) continue;
    const docFile = apiDocFileName(info);
    const docPath = join(apiDir, docFile);
    subpathRows.push(
      `| \`${specifier}\` | \`${info.target}\` | ${info.exports.length} | [${docFile}](./${docFile}) |`,
    );

    if (!existsSync(docPath)) {
      const subLines = [
        `# API Reference: \`${specifier}\``,
        '',
        `- **پکیج والد**: \`${info.slug}\` — [\`${info.slug}.md\`](./${info.slug}.md)`,
        `- **فایل منبع**: \`packages/${info.slug}/${info.entry}\``,
        `- **کلید exports**: \`${subpathKey(info.subpath)}\` (ESM-only؛ DEC-027)`,
        `- **محیط هدف (\`zenith.target\`)**: \`${info.target}\``,
        '',
        '## چرا زیرمسیر؟',
        '',
        'زیرمسیرهای عمومی برای نگه‌داشتن **بودجهٔ باندل ورودی اصلی** ساخته شده‌اند',
        '(#142): مصرف‌کننده‌ای که فقط این بخش را می‌خواهد، باندل اصلی پکیج را',
        'بار نمی‌کند. شکل و فهرست زیرمسیرها از `scripts/lib/exports-shape.mjs`',
        '(`PUBLIC_SUBPATHS`) می‌آید؛ DEC-036/DEC-037.',
        '',
        '## نمادهای صادرشده (Public Surface)',
        '',
        ...(info.exports.length > 0
          ? [
              '| نام نماد | نوع (Kind) | سطح پایداری |',
              '|----------|------------|-------------|',
              ...info.exports.map((s) => `| \`${s.name}\` | \`${s.kind}\` | \`@${s.tag}\` |`),
            ]
          : [
              'این زیرمسیر چیزی خودش تعریف نمی‌کند؛ همهٔ نمادها از پکیج',
              (info.reexports ?? []).map((r) => `\`${r}\``).join('، ') + ' بازصادر می‌شوند:',
              ...[
                ...new Set(
                  (info.reexports ?? []).map((r) => {
                    const rest = r.startsWith('@zenith/') ? r.slice('@zenith/'.length) : r;
                    return rest.split('/')[0];
                  }),
                ),
              ].map((slug) => `[\`${slug}.md\`](./${slug}.md)`),
            ]),
        '',
      ];
      writeFileSync(docPath, subLines.join('\n'), 'utf8');
    }
  }

  if (subpathRows.length > 0) {
    indexLines.push(
      '',
      '## زیرمسیرهای عمومی (subpath entry points؛ #142/#120)',
      '',
      'این زیرمسیرها بخشی از API عمومی‌اند و در `api-surface.snapshot.json` هم',
      'با کلید خودشان (`@zenith/schema/attr` و …) ثبت شده‌اند تا حذف/افزودن',
      'ناخواسته در CI قرمز شود.',
      '',
      '| زیرمسیر | محیط هدف (`zenith.target`) | تعداد نمادهای عمومی | صفحهٔ مرجع API |',
      '|---------|----------------------------|---------------------|----------------|',
      ...subpathRows,
      '',
    );
  }

  writeFileSync(join(apiDir, 'INDEX.md'), indexLines.join('\n') + '\n', 'utf8');
  return { surface, updated: true };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const checkOnly = process.argv.includes('--check');
  const { surface } = generateApiDocs(process.cwd(), { checkOnly });
  console.log(
    `✅ API surface ${checkOnly ? 'verified' : 'generated'} for ${
      Object.values(surface).filter((i) => !i.subpath).length
    } packages + ${Object.values(surface).filter((i) => i.subpath).length} public subpaths.`,
  );
}
