// scripts/lib/dts-bundle.mjs
// #74 — bundle a package's per-module declarations into one self-contained `.d.ts` per entry.
//
// rollup-plugin-dts merges the package's own files but DROPS the `type` modifier of names that
// are re-exported from external modules:   export { type Resource, getResource } from '@x/y'
// becomes                                   export { Resource, getResource } from '@x/y'
// After that the declaration claims a runtime value `Resource` that the JavaScript bundle does
// not export (#140 catches exactly this). `restoreTypeOnlyReexports` puts the modifier back using
// the pre-bundle sources as the source of truth.
import ts from 'typescript';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.d\.ts$/.test(name)) yield full;
  }
}

const isExternal = (spec) => !spec.startsWith('.') && !spec.startsWith('/');

/**
 * module specifier → names imported/re-exported ONLY as types (never as a value) in the scratch d.ts tree.
 * A name that is exported as a value anywhere keeps its value status.
 */
export function collectTypeOnlyReexports(scratchDir) {
  const typeOnly = new Map(); // module → Set(name)
  const valueNames = new Map(); // module → Set(name)
  const add = (map, mod, name) => {
    if (!map.has(mod)) map.set(mod, new Set());
    map.get(mod).add(name);
  };
  for (const file of walk(scratchDir)) {
    const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    for (const stmt of sf.statements) {
      // `import { type X } from 'ext'; export { X }` is the same thing one hop removed
      if (
        ts.isImportDeclaration(stmt) &&
        ts.isStringLiteral(stmt.moduleSpecifier) &&
        isExternal(stmt.moduleSpecifier.text) &&
        stmt.importClause?.namedBindings &&
        ts.isNamedImports(stmt.importClause.namedBindings)
      ) {
        const mod = stmt.moduleSpecifier.text;
        for (const el of stmt.importClause.namedBindings.elements) {
          const imported = (el.propertyName ?? el.name).text;
          if (stmt.importClause.isTypeOnly || el.isTypeOnly) add(typeOnly, mod, imported);
          else add(valueNames, mod, imported);
        }
        continue;
      }
      if (
        !ts.isExportDeclaration(stmt) ||
        !stmt.moduleSpecifier ||
        !stmt.exportClause ||
        !ts.isNamedExports(stmt.exportClause)
      ) {
        continue;
      }
      const mod = stmt.moduleSpecifier.text;
      if (!isExternal(mod)) continue;
      for (const el of stmt.exportClause.elements) {
        const exported = el.name.text;
        if (stmt.isTypeOnly || el.isTypeOnly) add(typeOnly, mod, exported);
        else add(valueNames, mod, exported);
      }
    }
  }
  for (const [mod, names] of typeOnly) {
    for (const n of [...names]) if (valueNames.get(mod)?.has(n)) names.delete(n);
  }
  return typeOnly;
}

/** Re-insert `type` on re-exports from externals in the bundled declaration text. */
export function restoreTypeOnlyReexports(bundledText, typeOnly) {
  const sf = ts.createSourceFile('bundle.d.ts', bundledText, ts.ScriptTarget.Latest, true);
  const edits = [];
  for (const stmt of sf.statements) {
    if (
      !ts.isExportDeclaration(stmt) ||
      stmt.isTypeOnly ||
      !stmt.moduleSpecifier ||
      !stmt.exportClause ||
      !ts.isNamedExports(stmt.exportClause)
    ) {
      continue;
    }
    const names = typeOnly.get(stmt.moduleSpecifier.text);
    if (!names) continue;
    for (const el of stmt.exportClause.elements) {
      // `export { A as B } from 'm'`: the ORIGINAL name (propertyName ?? name) is what m declares
      const original = (el.propertyName ?? el.name).text;
      if (!el.isTypeOnly && names.has(el.name.text) && names.has(original)) {
        edits.push(el.getStart(sf));
      }
    }
  }
  let out = bundledText;
  for (const pos of edits.sort((a, b) => b - a)) out = `${out.slice(0, pos)}type ${out.slice(pos)}`;
  return out;
}
