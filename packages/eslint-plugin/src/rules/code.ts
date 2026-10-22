import type { Rule } from 'eslint';

type Node = Rule.Node;
type Shape = { type?: string; name?: string; value?: unknown; [key: string]: unknown };
const shape = (value: unknown): Shape => value && typeof value === 'object' ? value as Shape : {};
const nameOf = (value: unknown): string | undefined => {
  const item = shape(value); return typeof item.name === 'string' ? item.name : typeof item.value === 'string' ? item.value : undefined;
};
function ancestors(node: Node): Node[] { const result: Node[] = []; for (let n: Node | null | undefined = node; n; n = n.parent) result.push(n); return result; }
function exported(node: Node): boolean { return ancestors(node).some(n => n.type === 'ExportNamedDeclaration' || n.type === 'ExportDefaultDeclaration'); }
function factory(node: Node): Node | undefined { return ancestors(node).find(n => /Function|ArrowFunction/.test(n.type)); }
function functionName(node: Node): string { const item = shape(node); return nameOf(item.id) ?? nameOf(shape(node.parent).id) ?? ''; }
type LexicalScope = ReturnType<Rule.RuleContext['sourceCode']['getScope']>;
function binding(context: Rule.RuleContext, node: Node, name: string) {
  let scope: LexicalScope | null = context.sourceCode.getScope(node);
  while (scope) { const variable = scope.set.get(name); if (variable) return variable; scope = scope.upper; }
  return undefined;
}
function shadowed(context: Rule.RuleContext, node: Node, name: string): boolean { return (binding(context, node, name)?.defs.length ?? 0) > 0; }
function make(description: string, create: Rule.RuleModule['create'], type: 'problem' | 'suggestion' = 'problem'): Rule.RuleModule {
  return { meta: { type, docs: { description }, schema: [], messages: { contract: description } }, create };
}
export const codeRules: Record<string, Rule.RuleModule> = {
  'no-console': make('Use @zenith/logger for diagnostics or an explicit CLI/IDE output writer.', context => ({ MemberExpression(node) {
    const object = shape(node.object);
    if ((nameOf(object) === 'console' && !shadowed(context, node, 'console')) || (object.type === 'MemberExpression' && nameOf(object.property) === 'console' && nameOf(object.object) === 'globalThis' && !shadowed(context, node, 'globalThis'))) context.report({ node, messageId: 'contract' });
  } })),
  'no-plain-error': make('Throw a structured Zenith error with a registered code, not plain Error.', context => ({ NewExpression(node) {
    if (node.callee.type === 'Identifier' && node.callee.name === 'Error' && !shadowed(context, node, 'Error')) context.report({ node, messageId: 'contract' });
  } })),
  'no-destroy-alias': make('Public lifecycle APIs use dispose; destroy aliases require an explicit migration.', context => {
    const visit = (node: Node) => {
      const item = shape(node); const key = shape(item.key);
      if (nameOf(key) !== 'destroy' || !exported(node) || key.type === 'PrivateIdentifier' || ['private', 'protected'].includes(String(item.accessibility))) return;
      if (node.type === 'Property' && node.value.type === 'Literal') return;
      context.report({ node, messageId: 'contract' });
    };
    const exportedName = (node: Node) => { if (nameOf(shape(node).exported) === 'destroy' || node.parent?.type === 'ExportNamedDeclaration' && nameOf(shape(node).id) === 'destroy') context.report({ node, messageId: 'contract' }); };
    return { Property: visit, MethodDefinition: visit, TSMethodSignature: visit, TSPropertySignature: visit, FunctionDeclaration: exportedName, ExportSpecifier: exportedName };
  }),
  'dispose-required': make('A createX factory returning an object must expose dispose().', context => {
    const inspect = (node: Node, owner: Node | undefined) => {
      if (!owner || !/^create[A-Z]/.test(functionName(owner)) || !exported(owner) || node.type !== 'ObjectExpression') return;
      // Imported/spread contracts are delegated to the type checker; literal
      // non-callable dispose values cannot satisfy the lifecycle contract.
      if (!node.properties.some(p => p.type === 'SpreadElement' || nameOf(p.key) === 'dispose' && p.value.type !== 'Literal')) context.report({ node, messageId: 'contract' });
    };
    return { ReturnStatement(node) { if (node.argument) inspect(node.argument as Node, factory(node)); }, ArrowFunctionExpression(node) { if (node.body.type === 'ObjectExpression') inspect(node.body as Node, node); } };
  }),
  'no-module-state': make('Mutable module state must be App/request-owned or explicitly documented.', context => ({ VariableDeclaration(node) {
    const parent = node.parent?.type === 'ExportNamedDeclaration' ? node.parent.parent : node.parent;
    if (parent?.type !== 'Program') return;
    if (node.kind !== 'const' || node.declarations.some(d => d.init?.type === 'NewExpression' && d.init.callee.type === 'Identifier' && ['Map', 'Set', 'WeakMap', 'WeakSet'].includes(d.init.callee.name))) context.report({ node, messageId: 'contract' });
  } }), 'suggestion'),
  'no-math-random-security': make('Use crypto.getRandomValues/secureId for security-sensitive randomness.', context => ({ CallExpression(node) {
    if (node.callee.type !== 'MemberExpression' || nameOf(node.callee.object) !== 'Math' || nameOf(node.callee.property) !== 'random' || shadowed(context, node, 'Math')) return;
    const names = ancestors(node).map(n => functionName(n) + ' ' + (nameOf(shape(n).id) ?? '')).join(' ');
    if (/auth|token|nonce|password|secret|session|secure/i.test(names + context.filename)) context.report({ node, messageId: 'contract' });
  } })),
  'no-deprecated-api': make('Replace the deprecated Zenith API with its documented canonical API.', context => {
    const imports = new Set<string>(); const namespaces = new Set<string>();
    const deprecated = new Set(['clearActions', 'clearComponents', 'clearResources', 'clearStores', 'clearPermissionManagers', 'resetResourceRegistry', 'compileAndRender', 'processVirtualList']);
    const collectImport = (node: Extract<NonNullable<Rule.RuleContext['sourceCode']['ast']['body']>[number], { type: 'ImportDeclaration' }>) => {
        if (typeof node.source.value !== 'string' || !/^@zenith\//.test(node.source.value)) return;
        for (const item of node.specifiers) { if (item.type === 'ImportNamespaceSpecifier') namespaces.add(item.local.name); else if (item.type === 'ImportSpecifier' && deprecated.has(nameOf(item.imported) ?? '')) imports.add(item.local.name); }
    };
    for (const node of context.sourceCode.ast.body) if (node.type === 'ImportDeclaration') collectImport(node);
    const imported = (name: string, node: Node) => binding(context, node, name)?.defs.some(def => def.type === 'ImportBinding') === true;
    return {
      CallExpression(node) {
        const callee = node.callee;
        if ((callee.type === 'Identifier' && imports.has(callee.name) && imported(callee.name, node)) || (callee.type === 'MemberExpression' && namespaces.has(nameOf(callee.object) ?? '') && imported(nameOf(callee.object) ?? '', node) && deprecated.has(nameOf(callee.property) ?? ''))) context.report({ node, messageId: 'contract' });
      },
    };
  }, 'suggestion'),
  'no-global-name-collision': make('Do not export a binding that collides with a browser host global.', context => {
    const reserved = new Set(['window', 'document', 'console', 'crypto', 'localStorage', 'sessionStorage']);
    const check = (value: unknown) => { const name = nameOf(value); if (name && reserved.has(name)) context.report({ node: value as Node, messageId: 'contract' }); };
    const pattern = (value: unknown): void => {
      const item = shape(value);
      if (item.type === 'Identifier') check(value);
      else if (item.type === 'AssignmentPattern') pattern(item.left);
      else if (item.type === 'RestElement') pattern(item.argument);
      else if (item.type === 'ArrayPattern' && Array.isArray(item.elements)) item.elements.forEach(pattern);
      else if (item.type === 'ObjectPattern' && Array.isArray(item.properties)) for (const property of item.properties) { const member = shape(property); pattern(member.type === 'RestElement' ? member.argument : member.value); }
    };
    return {
      ExportNamedDeclaration(node) {
        const item = shape(node); if (item.exportKind === 'type') return;
        const declaration = shape(item.declaration);
        if (declaration.type === 'VariableDeclaration' && Array.isArray(declaration.declarations)) for (const binding of declaration.declarations) pattern(shape(binding).id);
        else if (['FunctionDeclaration', 'ClassDeclaration', 'TSDeclareFunction', 'TSEnumDeclaration', 'TSModuleDeclaration'].includes(declaration.type ?? '')) check(declaration.id);
        if (Array.isArray(item.specifiers)) for (const specifier of item.specifiers) { const entry = shape(specifier); if (entry.exportKind !== 'type') check(entry.exported); }
      },
      ExportAllDeclaration(node) { if (shape(node).exportKind !== 'type') check(shape(node).exported); },
      TSNamespaceExportDeclaration(node: Node) { check(shape(node).id); },
    };
  }),
  'tsdoc-default': make('Document each optional Options/Config property with @defaultValue.', context => ({ TSPropertySignature(node: Node) {
    const item = shape(node); if (!item.optional) return;
    const owner = ancestors(node).find(n => ['TSInterfaceDeclaration', 'TSTypeAliasDeclaration'].includes(n.type));
    if (!owner || !/(Options|Config)$/.test(nameOf(shape(owner).id) ?? '')) return;
    if (!context.sourceCode.getCommentsBefore(node).some(comment => /@default(?:Value)?\b/.test(comment.value))) context.report({ node, messageId: 'contract' });
  } }), 'suggestion'),
};
