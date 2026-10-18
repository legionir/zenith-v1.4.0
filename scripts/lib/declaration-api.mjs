import ts from 'typescript';
import { RELEASE_LEVELS } from './release-tags.mjs';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { publishedProgram, publishedSymbolMetadata } from './published-program.mjs';
import { conditionTarget } from './exports-shape.mjs';

/** All published declaration entry points, including require types and subpaths. */
export function declarationEntries(root) {
  const entries = [];
  for (const dir of readdirSync(join(root, 'packages')).sort()) {
    const path = join(root, 'packages', dir, 'package.json');
    if (!existsSync(path)) continue;
    const manifest = JSON.parse(readFileSync(path, 'utf8'));
    if (manifest.private) continue;
    for (const [subpath, value] of Object.entries(manifest.exports ?? {})) {
      if (subpath === './package.json') continue;
      const releaseLevel = manifest.zenith?.entryLevels?.[subpath] ?? (subpath === './internal' ? 'internal' : 'public');
      if (!RELEASE_LEVELS.includes(releaseLevel) || (subpath === '.' && releaseLevel !== 'public')) throw new Error(`${manifest.name}${subpath}: invalid release level ${releaseLevel}`);
      const types = new Set();
      const collect = node => {
        if (!node || typeof node !== 'object') return;
        if (typeof node.types === 'string') types.add(node.types);
        for (const child of Object.values(node)) if (typeof child === 'object') collect(child);
      };
      collect(value);
      const target = conditionTarget(value, 'types');
      if (target) types.add(target);
      if (!types.size) throw new Error(`${manifest.name}${subpath}: missing declarations`);
      for (const file of types) {
        const absolute = resolve(dirname(path), file);
        const local = relative(dirname(path), absolute);
        if (local.startsWith(`..${sep}`) || local === '..' || !/\.d\.(?:ts|cts|mts)$/.test(file)) throw new Error(`Invalid declaration target ${file}`);
        entries.push({ packageName: manifest.name, directory: dir, subpath, releaseLevel, packageDirectory: dirname(path), file: absolute });
      }
    }
  }
  return entries;
}

const isPrivate = node => !ts.isParameter(node) && (Boolean(node.modifiers?.some(m => m.kind === ts.SyntaxKind.PrivateKeyword)) || (node.name && ts.isPrivateIdentifier(node.name)));

/**
 * Follow the compiler's actual export graph, not barrel text. Only declarations
 * in includeDirectories are audited; TypeScript/DOM/third-party ambient libs are
 * not our published API. Referenced workspace declarations are still followed.
 */
export function inspectDeclarationApi(entries, { includeDirectories, strictResolution = true } = {}) {
  const { program, checker, owned } = publishedProgram(entries, { includeDirectories, strictResolution });
  const findings = new Map();
  const surface = [];
  const printer = ts.createPrinter({ removeComments: false, newLine: ts.NewLineKind.LineFeed });
  for (const entry of entries) {
    const source = program.getSourceFile(entry.file);
    const module = source && checker.getSymbolAtLocation(source);
    if (!module) throw new Error(`Not a declaration module: ${entry.file}`);
    for (const exported of checker.getExportsOfModule(module).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const seen = new Set();
      const seenSymbols = new Set();
      const exposedBy = `${entry.packageName ?? entry.file}${entry.subpath ?? '.'}:${exported.name}`;
      const unalias = symbol => (symbol.flags & ts.SymbolFlags.Alias) ? checker.getAliasedSymbol(symbol) : symbol;
      const { actual, declarations, metadata } = publishedSymbolMetadata(exported, checker);
      surface.push({ entry: exposedBy, declaration: relative(entry.packageDirectory ?? dirname(entry.file), entry.file).split('\\').join('/'), releaseLevel: entry.releaseLevel ?? (entry.subpath === './internal' ? 'internal' : 'public'), ...metadata, signatures: declarations.filter(d => owned(d.getSourceFile().fileName)).map(d => printer.printNode(ts.EmitHint.Unspecified, d, d.getSourceFile()).replace(/\r\n/g, '\n')) });
      const visitSymbol = symbol => {
        const resolved = unalias(symbol);
        if (seenSymbols.has(resolved)) return;
        seenSymbols.add(resolved);
        for (const declaration of resolved.declarations ?? []) if (!ts.isSourceFile(declaration) && !ts.isModuleDeclaration(declaration)) visit(declaration);
        if (resolved.flags & ts.SymbolFlags.Module) for (const child of checker.getExportsOfModule(resolved)) visitSymbol(child);
      };
      const recordAny = (node, kind) => {
        const sf = node.getSourceFile();
        const start = node.getStart(sf);
        const { line, character } = sf.getLineAndCharacterOfPosition(start);
        const key = `${sf.fileName}:${start}`;
        if (!findings.has(key)) findings.set(key, { file: sf.fileName, line: line + 1, column: character + 1, kind, exposedBy: new Set() });
        findings.get(key).exposedBy.add(exposedBy);
      };
      const visit = node => {
        if (seen.has(node) || !owned(node.getSourceFile().fileName) || isPrivate(node)) return;
        seen.add(node);
        if (node.kind === ts.SyntaxKind.AnyKeyword) recordAny(node, 'explicit');
        else if ((ts.isTypeNode(node) || (!node.type && (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isPropertySignature(node)))) && (checker.getTypeAtLocation(node).flags & ts.TypeFlags.Any)) recordAny(node, 'inferred');
        if ((ts.isFunctionDeclaration(node) || ts.isMethodSignature(node) || ts.isCallSignatureDeclaration(node) || ts.isGetAccessorDeclaration(node)) && !node.type) {
          const signature = checker.getSignatureFromDeclaration(node);
          if (signature && (checker.getReturnTypeOfSignature(signature).flags & ts.TypeFlags.Any)) recordAny(node, 'inferred-return');
        }
        const reference = ts.isTypeReferenceNode(node) ? node.typeName : ts.isExpressionWithTypeArguments(node) ? node.expression : ts.isTypeQueryNode(node) ? node.exprName : ts.isImportTypeNode(node) ? node.qualifier : undefined;
        if (reference) { const symbol = checker.getSymbolAtLocation(reference); if (symbol) visitSymbol(symbol); }
        else if (ts.isImportTypeNode(node)) { const symbol = checker.getTypeFromTypeNode(node).getSymbol(); if (symbol) visitSymbol(symbol); }
        ts.forEachChild(node, visit);
      };
      visitSymbol(actual);
    }
  }
  return { surface, any: [...findings.values()].map(f => ({ ...f, exposedBy: [...f.exposedBy].sort() })).sort((a, b) => a.file.localeCompare(b.file, 'en') || a.line - b.line || a.column - b.column) };
}
