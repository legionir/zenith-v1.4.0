/**
 * @param {string} paramText
 * @returns {boolean}
 */
export function isOptionsParamText(paramText) {
  const text = paramText.replace(/\s+/g, ' ').trim();
  if (/(?:^|[\s:{(&|,[])\w*(Options|Config)\w*\s*[:?=]?/.test(text)) return true;
  return /[:?]\s*\{[^}]*[:?]/.test(text);
}

/**
 * @typedef {{pkg: string, name: string, params?: string[], file?: string}} LegacySignature
 * @typedef {{allowlist?: LegacySignature[], workspaceOnly?: boolean}} RuleOptions
 */

/**
 * Public API parameters are `(main, options?)`. An options parameter elsewhere
 * does NOT exempt extra positional configuration. Overloads are checked one by
 * one; only the deprecated overload itself is exempt.
 * @param {RuleOptions} [options]
 * @returns {import('eslint').Rule.RuleModule}
 */
export function createOptionsObjectRule(options = {}) {
  return {
    meta: {
      type: 'problem',
      docs: { description: 'Require public configuration in a single trailing options object (API-CONVENTIONS §1.1/§4).' },
      schema: [],
      messages: { optionsObject: '`{{name}}` takes positional configuration; use `(main, options?)` or a deprecated legacy overload.' },
    },
    create(context) {
      const match = /(?:^|[\\/])packages[\\/]([^\\/]+)[\\/]src[\\/]/.exec(context.filename);
      if (options.workspaceOnly && !match) return {};
      const pkg = match?.[1];
      const normalize = text => text.replace(/\s+/g, ' ').trim();
      const deprecated = node => {
        const parent = node.parent?.type === 'ExportNamedDeclaration' ? node.parent : node;
        return context.sourceCode.getCommentsBefore(parent).some(comment => /@deprecated\b/.test(comment.value));
      };
      const file = context.filename.replace(/\\/g, '/');
      const workspaceFile = file.match(/(?:^|\/)packages\/[^/]+\/src\/.+$/)?.[0].replace(/^\//, '');
      const combine = (rows, next) => {
        if (rows.length * next.length > 256) throw new Error(`Public rest tuple expansion exceeds 256 variants in ${context.filename}`);
        return rows.flatMap(prefix => next.map(parts => [...prefix, ...parts]));
      };
      const tupleVariants = (type, fallback) => {
        if (type?.type === 'TSTypeAnnotation') return tupleVariants(type.typeAnnotation, fallback);
        if (type?.type === 'TSParenthesizedType' || type?.type === 'TSTypeOperator' && type.operator === 'readonly') return tupleVariants(type.typeAnnotation, fallback);
        if (type?.type === 'TSUnionType') return type.types.flatMap(part => tupleVariants(part, fallback));
        if (type?.type !== 'TSTupleType') return [[fallback]];
        return type.elementTypes.reduce((variants, member) => {
          const label = member.type === 'TSNamedTupleMember' ? member : null;
          let value = label ? label.elementType : member;
          const optional = Boolean(label?.optional) || value.type === 'TSOptionalType';
          let rest = value.type === 'TSRestType';
          if (value.type === 'TSOptionalType' || rest) value = value.typeAnnotation;
          // Named rest tuples may carry the rest wrapper outside the label.
          if (value.type === 'TSNamedTupleMember') { rest = true; value = value.elementType; }
          const next = rest ? tupleVariants(value, `...rest: ${context.sourceCode.getText(value)}`) : [[`${optional ? '?' : ''}: ${context.sourceCode.getText(value)}`]];
          return combine(variants, next);
        }, [[]]).map(parts => parts.map((part, index) => part.startsWith('...rest:') ? part.replace('...rest:', `...rest${index}:`) : part.startsWith(':') || part.startsWith('?:') ? `rest${index}${part}` : part.replace(/^(\.\.\.)?rest\d+(\??:)/, `$1rest${index}$2`)));
      };
      const check = (node, name, documentation = node, inheritedDeprecated = false) => {
        if (inheritedDeprecated || deprecated(documentation)) return;
        const params = node.params.filter(param => !(param.type === 'Identifier' && param.name === 'this'));
        const variants = params.reduce((rows, parameter) => {
          const text = normalize(context.sourceCode.getText(parameter));
          const next = parameter.type === 'RestElement' ? tupleVariants(parameter.typeAnnotation ?? parameter.argument?.typeAnnotation, text) : [[text]];
          return combine(rows, next);
        }, [[]]);
        const allowed = text => options.allowlist?.some(entry => entry.pkg === pkg && entry.name === name && (!entry.file || entry.file === workspaceFile) && (!entry.params || (entry.params.length === text.length && entry.params.every((param, i) => normalize(param) === normalize(text[i])))));
        if (variants.some(text => text.length > 2 && !allowed(text))) context.report({ node, messageId: 'optionsObject', data: { name } });
      };
      const keyName = node => node?.key?.type === 'Identifier' ? node.key.name : node?.key?.type === 'Literal' ? String(node.key.value) : node?.key ? context.sourceCode.getText(node.key) : null;
      const unwrap = node => {
        while (node && ['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression'].includes(node.type)) node = node.expression;
        return node;
      };
      const inspectType = (node, prefix, old = false) => {
        if (!node) return;
        if (node.type === 'TSTypeAnnotation') return inspectType(node.typeAnnotation, prefix, old);
        if (['TSFunctionType', 'TSConstructorType'].includes(node.type)) check(node, prefix, node, old);
        else if (node.type === 'TSTypeLiteral') inspectMembers(node.members, prefix, old);
        else if (['TSIntersectionType', 'TSUnionType'].includes(node.type)) for (const type of node.types) inspectType(type, prefix, old);
      };
      const inspectObject = (node, prefix, old = false) => {
        node = unwrap(node); if (!node || node.type !== 'ObjectExpression') return;
        for (const property of node.properties) {
          const name = keyName(property); if (!name || property.type !== 'Property') continue;
          const value = unwrap(property.value), path = `${prefix}.${name}`;
          if (['ArrowFunctionExpression', 'FunctionExpression'].includes(value?.type)) check(value, path, property, old);
          else inspectObject(value, path, old || deprecated(property));
        }
      };
      const inspectMembers = (members, prefix, old = false) => {
        for (const member of members) {
          if (['private', 'protected'].includes(member.accessibility) || member.key?.type === 'PrivateIdentifier') continue;
          const key = keyName(member), name = member.kind === 'constructor' || member.type === 'TSConstructSignatureDeclaration' ? 'constructor' : member.type === 'TSCallSignatureDeclaration' ? '[call]' : key;
          if (!name) continue;
          const path = `${prefix}.${name}`;
          if (['MethodDefinition', 'TSAbstractMethodDefinition'].includes(member.type)) {
            if (member.value.body && members.some(other => other !== member && other.type === member.type && keyName(other) === key && !other.value.body)) continue;
            check(member.value, path, member, old);
          } else if (['TSMethodSignature', 'TSCallSignatureDeclaration', 'TSConstructSignatureDeclaration', 'TSDeclareMethod'].includes(member.type)) check(member, path, member, old);
          else {
            const value = unwrap(member.value);
            if (value && ['ArrowFunctionExpression', 'FunctionExpression'].includes(value.type)) check(value, path, member, old);
            else inspectType(member.typeAnnotation, path, old || deprecated(member));
            if (value) inspectObject(value, path, old || deprecated(member));
          }
        }
      };
      return {
        ExportNamedDeclaration(node) {
          const declaration = node.declaration;
          if (!declaration) return;
          if (['FunctionDeclaration', 'TSDeclareFunction'].includes(declaration.type) && declaration.id) {
            const hasOverloads = declaration.body && context.sourceCode.ast.body.some(statement => statement.type === 'ExportNamedDeclaration' && statement.declaration?.type === 'TSDeclareFunction' && statement.declaration.id?.name === declaration.id.name);
            if (!hasOverloads) check(declaration, declaration.id.name);
          }
          if (['ClassDeclaration', 'TSInterfaceDeclaration'].includes(declaration.type) && declaration.id) inspectMembers(declaration.body.body, declaration.id.name, deprecated(declaration));
          if (declaration.type === 'TSTypeAliasDeclaration') inspectType(declaration.typeAnnotation, declaration.id.name, deprecated(declaration));
          if (declaration.type === 'VariableDeclaration') {
            for (const d of declaration.declarations) {
              if (d.id.type !== 'Identifier') continue;
              const value = unwrap(d.init), name = d.id.name;
              if (value && ['ArrowFunctionExpression', 'FunctionExpression'].includes(value.type)) check(value, name, node);
              else if (value?.type === 'ClassExpression') inspectMembers(value.body.body, name, deprecated(node));
              else if (value) inspectObject(value, name, deprecated(node));
              if (d.id.typeAnnotation) inspectType(d.id.typeAnnotation, name, deprecated(node));
            }
          }
        },
      };
    },
  };
}

/** @public */
export const optionsObjectRule = createOptionsObjectRule();
