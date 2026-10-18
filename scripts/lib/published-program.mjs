import ts from 'typescript';
import { releaseMetadata, mergeDeclarationMetadata, exposureMetadata } from './release-tags.mjs';
import { existsSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Share a fail-closed declaration program between API/any/callable inspections. */
export function publishedProgram(entries, { includeDirectories, strictResolution = true } = {}) {
  if (!entries.length) throw new Error('No published declaration entries found');
  for (const entry of entries) if (!existsSync(entry.file)) throw new Error(`Missing declaration: ${entry.file}`);
  const roots = (includeDirectories ?? [...new Set(entries.map(e => dirname(e.file)))]).map(p => resolve(p));
  const owned = file => roots.some(root => { const rel = relative(root, resolve(file)); return rel !== '..' && !rel.startsWith(`..${sep}`) && !rel.startsWith(sep); });
  const program = ts.createProgram(entries.map(e => e.file), { noEmit: true, strict: true, skipLibCheck: false, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, types: ['node'], typeRoots: [resolve(dirname(fileURLToPath(import.meta.url)), '../../node_modules/@types')] });
  const unresolved = program.getSourceFiles().filter(sf => owned(sf.fileName)).flatMap(sf => program.getSemanticDiagnostics(sf)).filter(d => [2304, 2307, 2308, 2688, 7016].includes(d.code) && d.file && owned(d.file.fileName));
  if (strictResolution && unresolved.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(unresolved, { getCanonicalFileName: n => n, getCurrentDirectory: () => process.cwd(), getNewLine: () => '\n' }));
  return { program, checker: program.getTypeChecker(), owned };
}

/** Explicit alias/overload metadata, without treating one legacy overload as an obsolete symbol. */
export function publishedSymbolMetadata(symbol, checker) {
  const actual = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  const declarations = actual.declarations ?? [];
  const published = declarations.filter(declaration => !(ts.isFunctionDeclaration(declaration) && declaration.body && declarations.some(other => ts.isFunctionDeclaration(other) && !other.body)));
  const declared = mergeDeclarationMetadata(published.map(declaration => releaseMetadata(ts.getJSDocTags(ts.isVariableDeclaration(declaration) ? declaration.parent.parent : declaration).map(tag => tag.tagName.text))));
  const aliasTags = symbol === actual ? [] : (symbol.declarations ?? []).flatMap(declaration => ts.getJSDocTags(ts.isExportSpecifier(declaration) ? declaration.parent.parent : ts.isNamespaceExport(declaration) ? declaration.parent : declaration).map(tag => tag.tagName.text));
  return { actual, declarations, metadata: exposureMetadata(declared, releaseMetadata(aliasTags)) };
}
