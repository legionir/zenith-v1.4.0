import ts from 'typescript';
import { isOptionsParamText } from '../../packages/eslint-plugin/src/rules/options-object.js';

const privateMember = node => Boolean(node.modifiers?.some(m => m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword)) || Boolean(node.name && ts.isPrivateIdentifier(node.name));
const exported = node => Boolean(node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword));

/**
 * Source inventory, NOT proof of publication. Exported private leaves remain in
 * this legacy inventory; the declaration graph separately identifies published
 * call paths. Qualify members so a function exemption cannot exempt a class.
 */
export function collectSourceSignatures(file, text) {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const signatures = [];
  const deprecated = node => ts.getJSDocTags(node).some(tag => tag.tagName.text === 'deprecated') || (ts.getLeadingCommentRanges(text, node.pos) ?? []).some(range => /@deprecated\b/.test(text.slice(range.pos, range.end)));
  const combine = (rows, next) => {
    if (rows.length * next.length > 256) throw new Error(`Public rest tuple expansion exceeds 256 variants in ${file}`);
    return rows.flatMap(prefix => next.map(parts => [...prefix, ...parts]));
  };
  const restVariants = (type, fallback) => {
    if (type && ts.isParenthesizedTypeNode(type)) return restVariants(type.type, fallback);
    if (type && ts.isTypeOperatorNode(type) && type.operator === ts.SyntaxKind.ReadonlyKeyword) return restVariants(type.type, fallback);
    if (type && ts.isUnionTypeNode(type)) return type.types.flatMap(part => restVariants(part, fallback));
    if (!type || !ts.isTupleTypeNode(type)) return [[fallback]];
    return type.elements.reduce((variants, member) => {
      const label = ts.isNamedTupleMember(member) ? member : undefined;
      const optional = Boolean(label?.questionToken) || ts.isOptionalTypeNode(member);
      const rest = Boolean(label?.dotDotDotToken) || ts.isRestTypeNode(member);
      const value = label ? label.type : ts.isOptionalTypeNode(member) || ts.isRestTypeNode(member) ? member.type : member;
      const next = rest ? restVariants(value, `...rest: ${value.getText(sf)}`) : [[`${optional ? '?' : ''}: ${value.getText(sf)}`]];
      return combine(variants, next);
    }, [[]]).map(parts => parts.map((part, index) => part.startsWith('...rest:') ? part.replace('...rest:', `...rest${index}:`) : part.startsWith(':') || part.startsWith('?:') ? `rest${index}${part}` : part.replace(/^(\.\.\.)?rest\d+(\??:)/, `$1rest${index}$2`)));
  };
  const record = (node, name, kind, documentation = node, inheritedDeprecated = false) => {
    const parameters = node.parameters.filter(p => !ts.isIdentifier(p.name) || p.name.text !== 'this');
    const variants = parameters.reduce((rows, parameter) => {
      const next = parameter.dotDotDotToken ? restVariants(parameter.type, parameter.getText(sf)) : [[parameter.getText(sf)]];
      return combine(rows, next);
    }, [[]]);
    for (const params of variants) signatures.push({ name, kind, params, optionsParam: params.some(isOptionsParamText), deprecated: inheritedDeprecated || deprecated(documentation), line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1 });
  };
  const memberName = node => node.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) || ts.isNumericLiteral(node.name)) ? node.name.text : node.name?.getText(sf);
  const unwrap = node => {
    while (node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node))) node = node.expression;
    return node;
  };
  const visitType = (node, prefix, old = false) => {
    if (!node) return;
    if (ts.isFunctionTypeNode(node)) { record(node, prefix, 'callback', node, old); return; }
    if (ts.isTypeLiteralNode(node)) { visitMembers(node.members, prefix, old); return; }
    if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) for (const child of node.types) visitType(child, prefix, old);
  };
  const visitObject = (node, prefix, old = false) => {
    node = unwrap(node);
    if (!node || !ts.isObjectLiteralExpression(node)) return;
    for (const member of node.properties) {
      const name = memberName(member); if (!name) continue;
      const path = `${prefix}.${name}`;
      if (ts.isMethodDeclaration(member)) record(member, path, 'method', member, old);
      else if (ts.isPropertyAssignment(member)) {
        const value = unwrap(member.initializer);
        if (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) record(value, path, 'method', member, old);
        else visitObject(value, path, old || deprecated(member));
      }
    }
  };
  const visitMembers = (members, prefix, old = false) => {
    for (const member of members) {
      if (privateMember(member)) continue;
      const name = memberName(member);
      const path = ts.isConstructorDeclaration(member) || ts.isConstructSignatureDeclaration(member) ? `${prefix}.constructor` : ts.isCallSignatureDeclaration(member) ? `${prefix}.[call]` : name ? `${prefix}.${name}` : null;
      if (!path) continue;
      if (ts.isMethodDeclaration(member) || ts.isConstructorDeclaration(member)) {
        // The body is not a public overload when ambient signatures precede it.
        if (member.body && members.some(other => other !== member && !other.body && other.kind === member.kind && memberName(other) === name)) continue;
        record(member, path, ts.isConstructorDeclaration(member) ? 'constructor' : 'method', member, old);
      } else if (ts.isMethodSignature(member) || ts.isCallSignatureDeclaration(member) || ts.isConstructSignatureDeclaration(member)) record(member, path, 'method', member, old);
      else if (ts.isPropertySignature(member) || ts.isPropertyDeclaration(member)) {
        if (member.type) visitType(member.type, path, old || deprecated(member));
        const value = member.initializer && unwrap(member.initializer);
        if (value && (ts.isArrowFunction(value) || ts.isFunctionExpression(value))) record(value, path, 'method', member, old);
        else if (value) visitObject(value, path, old || deprecated(member));
      }
    }
  };
  for (const statement of sf.statements) {
    if (!exported(statement)) continue;
    const old = deprecated(statement);
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      if (statement.body && sf.statements.some(other => ts.isFunctionDeclaration(other) && !other.body && other.name?.text === statement.name.text)) continue;
      record(statement, statement.name.text, 'function');
    } else if ((ts.isClassDeclaration(statement) || ts.isInterfaceDeclaration(statement)) && statement.name) visitMembers(statement.members, statement.name.text, old);
    else if (ts.isTypeAliasDeclaration(statement)) visitType(statement.type, statement.name.text, old);
    else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        const name = declaration.name.text, init = declaration.initializer && unwrap(declaration.initializer);
        if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) record(init, name, 'function', statement);
        else if (init && ts.isClassExpression(init)) visitMembers(init.members, name, old);
        else if (init) visitObject(init, name, old);
        // Typed variables may expose methods that are implemented elsewhere.
        if (declaration.type) visitType(declaration.type, name, old);
      }
    }
  }
  return signatures;
}

export const normalizeParameter = text => text.replace(/\s+/g, ' ').trim();
/** A qualified member lease never matches another owner or a changed signature. */
export function signatureAllowed(signature, entries) {
  return entries.some(entry => entry.pkg === signature.pkg && entry.name === signature.name && (!entry.file || entry.file === signature.file) && (!entry.params || (entry.params.length === signature.params.length && entry.params.every((param, i) => normalizeParameter(param) === normalizeParameter(signature.params[i])))));
}
