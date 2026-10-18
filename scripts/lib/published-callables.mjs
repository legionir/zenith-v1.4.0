import ts from 'typescript';
import { relative } from 'node:path';
import { publishedProgram, publishedSymbolMetadata } from './published-program.mjs';
import { isOptionsParamText } from '../../packages/eslint-plugin/src/rules/options-object.js';
import { signatureAllowed } from './positional-signatures.mjs';

const hidden = node => Boolean(node?.modifiers?.some(m => m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword)) || Boolean(node?.name && ts.isPrivateIdentifier(node.name));
const old = node => Boolean(node && ts.getJSDocTags(node).some(tag => tag.tagName.text === 'deprecated'));
const named = node => node?.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) || ts.isNumericLiteral(node.name)) ? node.name.text : undefined;

/** Stable declaration owner, independently of aliases/re-exports of that API. */
function declarationName(node, fallback) {
  if (ts.isFunctionDeclaration(node)) return named(node) ?? fallback;
  const parts = [];
  if (ts.isConstructorDeclaration(node) || ts.isConstructSignatureDeclaration(node)) parts.push('constructor');
  else if (ts.isCallSignatureDeclaration(node)) parts.push('[call]');
  else if (named(node)) parts.push(named(node));
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isInterfaceDeclaration(parent) || ts.isClassDeclaration(parent) || ts.isTypeAliasDeclaration(parent) || ts.isVariableDeclaration(parent)) {
      const name = named(parent); if (name) parts.unshift(name); break;
    }
    if (ts.isPropertySignature(parent) || ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent)) { const name = named(parent); if (name) parts.unshift(name); }
  }
  return parts.length ? parts.join('.') : fallback;
}

/**
 * Actual published signatures: aliases/namespaces, class/static/instance methods,
 * callable interfaces, object properties, callbacks and factory return values.
 * Native library members are not ours, but their workspace type arguments (e.g.
 * Promise<Api>, WeakRef<View>) are followed. Cycles terminate on the active path;
 * unexpectedly expanding recursive types fail rather than yield a clean report.
 */
export function inspectPublishedCallables(entries, { root = process.cwd(), allowlist = [], ...options } = {}) {
  const { program, checker, owned } = publishedProgram(entries, options);
  const records = new Map();
  for (const entry of entries) {
    if (entry.releaseLevel === 'internal') continue;
    const source = program.getSourceFile(entry.file), module = source && checker.getSymbolAtLocation(source);
    if (!module) throw new Error(`Not a declaration module: ${entry.file}`);
    const active = new Set(), activeSymbols = new Set();
    const unalias = symbol => symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    const add = (signature, path, kind, inheritedDeprecated) => {
      const declaration = signature.getDeclaration();
      if (!declaration || !owned(declaration.getSourceFile().fileName) || hidden(declaration)) return;
      const sf = declaration.getSourceFile();
      const combine = (rows, next) => {
        if (rows.length * next.length > 256) throw new Error(`Public rest tuple expansion exceeds 256 variants at ${path}`);
        return rows.flatMap(prefix => next.map(parts => [...prefix, ...parts]));
      };
      const restVariants = (type, fallback, expanding = new Set()) => {
        if (expanding.has(type)) throw new Error(`Recursive public rest tuple at ${path}`);
        if (type.isUnion()) return type.types.flatMap(part => restVariants(part, fallback, expanding));
        if (!checker.isTupleType(type)) return [[fallback]];
        const activeRest = new Set(expanding); activeRest.add(type);
        const flags = type.target?.elementFlags ?? [];
        return checker.getTypeArguments(type).reduce((rows, element, index) => {
          const rest = Boolean(flags[index] & (ts.ElementFlags.Rest | ts.ElementFlags.Variadic));
          const optional = Boolean(flags[index] & ts.ElementFlags.Optional);
          const restText = `${checker.typeToString(element)}${flags[index] & ts.ElementFlags.Rest ? '[]' : ''}`;
          const next = rest ? flags[index] & ts.ElementFlags.Rest ? [[`...rest: ${restText}`]] : restVariants(element, `...rest: ${restText}`, activeRest) : [[`${optional ? '?' : ''}: ${checker.typeToString(element)}`]];
          return combine(rows, next);
        }, [[]]).map(parts => parts.map((part, index) => part.startsWith('...rest:') ? part.replace('...rest:', `...rest${index}:`) : part.startsWith(':') || part.startsWith('?:') ? `rest${index}${part}` : part.replace(/^(\.\.\.)?rest\d+(\??:)/, `$1rest${index}$2`)));
      };
      const variants = declaration.parameters.filter(parameter => !ts.isIdentifier(parameter.name) || parameter.name.text !== 'this').reduce((rows, parameter) => {
        const next = parameter.dotDotDotToken ? restVariants(checker.getTypeAtLocation(parameter), parameter.getText(sf)) : [[parameter.getText(sf)]];
        return combine(rows, next);
      }, [[]]);
      const file = relative(root, sf.fileName).split('\\').join('/');
      const name = declarationName(declaration, path);
      for (const params of variants) {
        const key = `${entry.packageName}:${entry.subpath}:${entry.file}:${sf.fileName}:${declaration.pos}:${checker.signatureToString(signature)}:${JSON.stringify(params)}`;
        let row = records.get(key);
        if (!row) {
          row = { pkg: entry.directory ?? entry.packageName, name, file, line: sf.getLineAndCharacterOfPosition(declaration.getStart(sf)).line + 1, kind, params, optionsParam: params.some(isOptionsParamText), deprecated: inheritedDeprecated || old(declaration) || signature.getJsDocTags().some(tag => tag.name === 'deprecated'), entry: `${entry.packageName}${entry.subpath ?? '.'}`, declaration: entry.file, exposedAs: [] };
          records.set(key, row);
        }
        if (!row.exposedAs.includes(path)) row.exposedAs.push(path);
        // One nondeprecated path means this exact rest variant is still live API.
        if (!inheritedDeprecated && !old(declaration) && !signature.getJsDocTags().some(tag => tag.name === 'deprecated')) row.deprecated = false;
      }
    };
    const walkType = (type, path, inheritedDeprecated = false, depth = 0) => {
      if (!type || active.has(type)) return;
      if (depth > 64) throw new Error(`Expanding public API type at ${path}`);
      active.add(type);
      try {
        if (type.isUnionOrIntersection()) {
          for (const part of type.types) walkType(part, path, inheritedDeprecated, depth + 1);
        }
        for (const kind of [ts.SignatureKind.Call, ts.SignatureKind.Construct]) {
          for (const signature of checker.getSignaturesOfType(type, kind)) {
            const declaration = signature.getDeclaration();
            if (hidden(declaration)) continue;
            const signatureDeprecated = inheritedDeprecated || old(declaration) || signature.getJsDocTags().some(tag => tag.name === 'deprecated');
            add(signature, path, kind === ts.SignatureKind.Construct ? 'constructor' : path.includes('.parameter:') ? 'callback' : 'call', inheritedDeprecated);
            if (declaration && owned(declaration.getSourceFile().fileName)) {
              walkType(checker.getReturnTypeOfSignature(signature), `${path}()`, signatureDeprecated, depth + 1);
              for (const parameter of signature.getParameters()) {
                const location = parameter.valueDeclaration ?? parameter.declarations?.[0] ?? declaration;
                walkType(checker.getTypeOfSymbolAtLocation(parameter, location), `${path}.parameter:${parameter.name}`, signatureDeprecated, depth + 1);
              }
            }
          }
        }
        // Includes externally-owned containers with workspace payload arguments.
        if (type.flags & ts.TypeFlags.Object && type.objectFlags & ts.ObjectFlags.Reference) {
          for (const argument of checker.getTypeArguments(type)) walkType(argument, `${path}.[typeArgument]`, inheritedDeprecated, depth + 1);
        }
        for (const property of checker.getPropertiesOfType(type)) {
          const declaration = property.valueDeclaration ?? property.declarations?.[0];
          if (!declaration || !owned(declaration.getSourceFile().fileName) || hidden(declaration)) continue;
          walkType(checker.getTypeOfSymbolAtLocation(property, declaration), `${path}.${property.name}`, inheritedDeprecated || publishedSymbolMetadata(property, checker).metadata.deprecated, depth + 1);
        }
      } finally { active.delete(type); }
    };
    const walkSymbol = (symbol, path, inheritedDeprecated = false) => {
      const actual = unalias(symbol), declaration = actual.valueDeclaration ?? actual.declarations?.[0];
      if (!declaration || !owned(declaration.getSourceFile().fileName) || activeSymbols.has(actual)) return;
      activeSymbols.add(actual);
      try {
        const deprecated = inheritedDeprecated || publishedSymbolMetadata(symbol, checker).metadata.deprecated;
        if (actual.flags & ts.SymbolFlags.Module) {
          for (const child of checker.getExportsOfModule(actual)) walkSymbol(child, `${path}.${child.name}`, deprecated);
        }
        if (actual.flags & (ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Interface | ts.SymbolFlags.Class)) walkType(checker.getDeclaredTypeOfSymbol(actual), path, deprecated);
        if (actual.flags & ts.SymbolFlags.Value) walkType(checker.getTypeOfSymbolAtLocation(actual, declaration), path, deprecated);
      } finally { activeSymbols.delete(actual); }
    };
    for (const symbol of checker.getExportsOfModule(module)) walkSymbol(symbol, symbol.name);
  }
  const signatures = [...records.values()].map(row => ({ ...row, exposedAs: row.exposedAs.sort(), flagged: row.params.length > 2 && !row.deprecated && !signatureAllowed(row, allowlist) })).sort((a, b) => a.entry.localeCompare(b.entry) || a.name.localeCompare(b.name) || a.line - b.line);
  return { scope: 'published-declaration-graph', signatures, violations: signatures.filter(row => row.flagged), entries: entries.length };
}
