// scripts/lib/public-exports.mjs
//
// #119 — استخراج exportهای عمومی هر پکیج همراه با **منشأ**:
//   - `local`   : در همان پکیج تعریف شده (function/const/class/type/interface)
//   - `facade`  : از پکیج دیگر workspace دوباره export شده (پکیج چتر/facade)
//
// همین منشأ است که «نام تکراری مجاز» (facade) را از «نام تکراری با معنای متفاوت»
// (تعریف مستقل در دو پکیج) جدا می‌کند؛ گیت scripts/check-unique-export-names.mjs
// روی دومی حساس است.
//
// واکشی با AST تایپ‌اسکریپت است (نه regex) و re-exportهای محلی
// (`export * from './x'`) را تا ته دنبال می‌کند.

import ts from 'typescript';
import { releaseMetadata, mergeDeclarationMetadata, exposureMetadata } from './release-tags.mjs';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** نام پکیج workspace از روی specifier بیرونی (null اگر بیرونی نباشد). */
export function zenithPackageOf(spec) {
  const m = /^@zenith\/([^/]+)/.exec(spec);
  if (m) return m[1];
  if (spec === 'zenith' || spec.startsWith('zenith/')) return 'zenith';
  return null;
}

/** مسیر فایل ماژول محلی از specifier نسبی. */
function resolveLocal(fromFile, spec) {
  const base = resolve(dirname(fromFile), spec.replace(/\.(?:mjs|cjs|js)$/, ''));
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, `${base}.mts`, `${base}.cts`, join(base, 'index.ts')]) {
    if (existsSync(cand) && statSync(cand).isFile() && !cand.endsWith('.d.ts')) return cand;
  }
  return null;
}

function hasExportModifier(node) {
  return Boolean(node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword));
}

function releaseTag(node, sourceText) {
  const ranges = ts.getLeadingCommentRanges(sourceText, node.pos) ?? [];
  const comments = ranges.map((r) => sourceText.slice(r.pos, r.end)).join('\n');
  return releaseMetadata([...comments.matchAll(/@(public|beta|alpha|experimental|internal|deprecated)\b/g)].map(match => match[1]));
}

function kindOf(node) {
  if (ts.isFunctionDeclaration(node)) return 'function';
  if (ts.isClassDeclaration(node)) return 'class';
  if (ts.isInterfaceDeclaration(node)) return 'interface';
  if (ts.isTypeAliasDeclaration(node)) return 'type';
  if (ts.isEnumDeclaration(node)) return 'enum';
  if (ts.isVariableStatement(node)) return 'const';
  return 'unknown';
}

/**
 * exportهای یک فایل (و زیرماژول‌های محلی‌اش) با منشأ.
 *
 * منشأ هر نام یکی از این دو است:
 *   - `local`  : در همین پکیج تعریف شده
 *   - `facade` : از یک پکیج دیگر workspace دوباره export شده (با نام پکیج مبدأ)
 *
 * @param {string} entryFile مسیر src/index.ts
 * @param {(pkg: string) => string|null} resolveWorkspace مسیر entry یک پکیج workspace
 * @returns {Map<string, {name: string, kind: string, tag: string, origin: 'local'|'facade', from?: string}>}
 */
export function collectPublicExports(entryFile, resolveWorkspace) {
  const cache = new Map();

  const walk = (file) => {
    if (cache.has(file)) return cache.get(file);
    const result = new Map();
    const priorities = new Map();
    cache.set(file, result); // پیش از بازگشت، تا چرخه نسازد
    if (!file || !existsSync(file)) return result;

    const sourceText = readFileSync(file, 'utf8');
    const sf = ts.createSourceFile(file, sourceText, ts.ScriptTarget.ES2022, true);

    // provenance از importهای همین فایل: برای `export { X }` بدون specifier
    // (re-export یک binding واردشده) منشأ واقعی همان import است.
    const imports = new Map();
    for (const stmt of sf.statements) {
      if (!ts.isImportDeclaration(stmt) || !stmt.importClause) continue;
      const spec =
        stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)
          ? stmt.moduleSpecifier.text
          : null;
      if (!spec) continue;
      const external = zenithPackageOf(spec);
      const localFile = !external && spec.startsWith('.') ? resolveLocal(file, spec) : null;
      const clause = stmt.importClause;
      if (clause.name) imports.set(clause.name.text, { external, localFile, spec });
      const bindings = clause.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        for (const el of bindings.elements) {
          imports.set(el.name.text, {
            external,
            localFile,
            spec,
            importedName: el.propertyName?.text ?? el.name.text,
          });
        }
      }
    }

    const add = (name, kind, metadata, origin, from, priority = 3) => {
      if (typeof metadata === 'string') metadata = { tag: metadata, deprecated: false };
      const existing = result.get(name);
      // تعریف محلی بر re-export اولویت دارد.
      const previousPriority = priorities.get(name) ?? 0;
      if (existing && previousPriority > priority) return;
      if (existing && previousPriority === priority && existing.origin === 'local') {
        if (origin === 'local' && existing.kind === 'function' && kind === 'function') Object.assign(existing, mergeDeclarationMetadata([existing, metadata]));
        return;
      }
      priorities.set(name, priority);
      result.set(name, { name, kind, ...metadata, origin, from });
    };

    for (const stmt of sf.statements) {
      if (hasExportModifier(stmt) && !ts.isExportDeclaration(stmt)) {
        if (ts.isFunctionDeclaration(stmt) && stmt.body && sf.statements.some(other => ts.isFunctionDeclaration(other) && !other.body && other.name?.text === stmt.name?.text)) continue;
        if (ts.isVariableStatement(stmt)) {
          for (const decl of stmt.declarationList.declarations) {
            if (ts.isIdentifier(decl.name)) {
              add(decl.name.text, 'const', releaseTag(stmt, sourceText), 'local');
            }
          }
        } else if (stmt.name && ts.isIdentifier(stmt.name)) {
          add(stmt.name.text, kindOf(stmt), releaseTag(stmt, sourceText), 'local');
        }
        continue;
      }
      if (!ts.isExportDeclaration(stmt)) continue;

      const spec =
        stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)
          ? stmt.moduleSpecifier.text
          : null;
      const external = spec ? zenithPackageOf(spec) : null;
      const localFile = spec && !external && spec.startsWith('.') ? resolveLocal(file, spec) : null;

      if (stmt.exportClause && ts.isNamespaceExport(stmt.exportClause)) {
        add(stmt.exportClause.name.text, 'namespace', releaseTag(stmt, sourceText), external ? 'facade' : 'local', external ?? undefined);
        continue;
      }

      if (stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
        for (const el of stmt.exportClause.elements) {
          const exported = el.name.text;
          const localName = el.propertyName?.text ?? exported;
          if (external) {
            const other = resolveWorkspace(external, spec);
            const inner = other ? walk(other).get(localName) : undefined;
            add(exported, inner?.kind ?? 'value', inner ? exposureMetadata(inner, releaseTag(stmt, sourceText)) : releaseTag(stmt, sourceText), 'facade', external);
          } else if (localFile) {
            const inner = walk(localFile).get(localName);
            add(
              exported,
              inner?.kind ?? 'value',
              inner ? exposureMetadata(inner, releaseTag(stmt, sourceText)) : releaseTag(stmt, sourceText),
              inner?.origin ?? 'local',
              inner?.from,
            );
          } else {
            // `export { X }` (بدون specifier): binding واردشده در همین فایل.
            const imported = imports.get(localName);
            if (imported?.external) {
              const other = resolveWorkspace(imported.external, imported.spec);
              const inner = other ? walk(other).get(imported.importedName ?? localName) : undefined;
              add(exported, inner?.kind ?? 'value', inner ? exposureMetadata(inner, releaseTag(stmt, sourceText)) : releaseTag(stmt, sourceText), 'facade', imported.external);
            } else if (imported?.localFile) {
              const inner = walk(imported.localFile).get(imported.importedName ?? localName);
              add(
                exported,
                inner?.kind ?? 'value',
                inner ? exposureMetadata(inner, releaseTag(stmt, sourceText)) : releaseTag(stmt, sourceText),
                inner?.origin ?? 'local',
                inner?.from,
              );
            } else {
              // تعریف‌شده در همین فایل (مثلاً تابع wrapper) — local.
              const declaration = sf.statements.find(candidate => candidate.name?.text === localName || (ts.isVariableStatement(candidate) && candidate.declarationList.declarations.some(d => d.name?.text === localName)));
              add(exported, declaration ? kindOf(declaration) : 'value', releaseTag(declaration ?? stmt, sourceText), 'local');
            }
          }
        }
        continue;
      }

      // `export * from …`
      if (external) {
        const otherEntry = resolveWorkspace(external, spec);
        if (otherEntry) {
          for (const [name, info] of walk(otherEntry)) {
            add(name, info.kind, { tag: info.tag, deprecated: info.deprecated }, 'facade', external, 1);
          }
        }
      } else if (localFile) {
        for (const [name, info] of walk(localFile)) {
          add(name, info.kind, { tag: info.tag, deprecated: info.deprecated }, info.origin, info.from, 1);
        }
      }
    }
    return result;
  };

  return walk(entryFile);
}

/**
 * exportهای عمومی همهٔ پکیج‌های workspace.
 * @returns {Map<string, Array<{pkg: string, kind: string, tag: string, origin: string, from?: string}>>}
 */
export function collectWorkspaceExports(root = process.cwd()) {
  const packagesDir = join(root, 'packages');
  const dirs = readdirSync(packagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('tmp-'))
    .map((d) => d.name)
    .filter((d) => existsSync(join(packagesDir, d, 'src/index.ts')))
    .sort();

  const resolveWorkspace = (pkg, spec) => {
    const suffix = spec?.startsWith('@zenith/') ? spec.split('/').slice(2).join('/') : spec?.startsWith('zenith/') ? spec.slice(7) : '';
    const entry = join(packagesDir, pkg, 'src', suffix ? `${suffix}.ts` : 'index.ts');
    return existsSync(entry) ? entry : null;
  };

  const byName = new Map();
  for (const pkg of dirs) {
    const exports = collectPublicExports(join(packagesDir, pkg, 'src/index.ts'), resolveWorkspace);
    for (const info of exports.values()) {
      if (!byName.has(info.name)) byName.set(info.name, []);
      byName.get(info.name).push({ pkg, ...info });
    }
  }
  return byName;
}
