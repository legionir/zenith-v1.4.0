import ts from 'typescript';
import { CliFailure } from '../failure';

interface Edit { start: number; end: number; text: string; }
export interface Migration { source: string; changes: string[]; }
const classes: Readonly<Record<string, string>> = {
  Resource: '@zenith/resource', FormStore: '@zenith/form', Auth: '@zenith/auth',
  CrudEngine: '@zenith/crud', ActionRegistry: '@zenith/actions', SWController: '@zenith/service-worker',
};
/** Conservative, binding-aware edits: strings/comments/shadowed or mutable locals stay untouched. */
export function migrateSource(text: string, filename: string): Migration {
  const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true, filename.endsWith('.tsx') ? ts.ScriptKind.TSX : filename.endsWith('.jsx') ? ts.ScriptKind.JSX : /\.[cm]?js$/.test(filename) ? ts.ScriptKind.JS : ts.ScriptKind.TS);
  const host = ts.createCompilerHost({ noLib: true, noResolve: true, allowJs: true, target: ts.ScriptTarget.Latest });
  host.getSourceFile = name => name === filename ? source : undefined;
  const program = ts.createProgram([filename], { noLib: true, noResolve: true, allowJs: true, target: ts.ScriptTarget.Latest }, host); const diagnostics = program.getSyntacticDiagnostics(source);
  if (diagnostics.length) throw new CliFailure(`Cannot safely migrate invalid syntax in ${filename}. Fix syntax before upgrade.`);
  const checker = program.getTypeChecker();
  const constructors = new Set<ts.Symbol>(); const instances = new Set<ts.Symbol>(); const notificationNamespaces = new Set<ts.Symbol>();
  const edits: Edit[] = []; const changes = new Set<string>();
  const edit = (node: ts.Node, replacement: string, description: string) => { edits.push({ start: node.getStart(source), end: node.end, text: replacement }); changes.add(description); };
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const module = statement.moduleSpecifier.text; const clause = statement.importClause; if (clause?.isTypeOnly) continue;
    const bindings = clause?.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings) && module === '@zenith/notifications') { const symbol = checker.getSymbolAtLocation(bindings.name); if (symbol) notificationNamespaces.add(symbol); }
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const item of bindings.elements) {
      if (item.isTypeOnly) continue;
      const imported = (item.propertyName ?? item.name).text; const symbol = checker.getSymbolAtLocation(item.name);
      if (symbol && classes[imported] === module) constructors.add(symbol);
      if (module === '@zenith/notifications' && (imported === 'alert' || imported === 'confirm')) {
        const replacement = imported === 'alert' ? 'showAlert' : 'showConfirm';
        // Preserve the local binding so every reference (including shorthand) remains valid.
        if (item.propertyName) edit(item.propertyName, replacement, 'notifications canonical imports');
        else edit(item, `${replacement} as ${item.name.text}`, 'notifications canonical imports');
      }
    }
  }
  const collect = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isNewExpression(node.initializer) && ts.isIdentifier(node.initializer.expression) && ts.isVariableDeclarationList(node.parent) && (node.parent.flags & ts.NodeFlags.Const)) {
      const constructor = checker.getSymbolAtLocation(node.initializer.expression), instance = checker.getSymbolAtLocation(node.name);
      if (constructor && constructors.has(constructor) && instance) instances.add(instance);
    }
    ts.forEachChild(node, collect);
  }; collect(source);
  const visit = (node: ts.Node) => {
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
      const symbol = checker.getSymbolAtLocation(node.expression);
      if (symbol && instances.has(symbol) && node.name.text === 'destroy') edit(node.name, 'dispose', 'owned instance destroy → dispose');
      if (symbol && notificationNamespaces.has(symbol) && ['alert', 'confirm'].includes(node.name.text)) edit(node.name, node.name.text === 'alert' ? 'showAlert' : 'showConfirm', 'notifications canonical namespace');
    }
    ts.forEachChild(node, visit);
  }; visit(source);
  let result = text;
  for (const item of edits.sort((a, b) => b.start - a.start)) result = result.slice(0, item.start) + item.text + result.slice(item.end);
  return { source: result, changes: [...changes] };
}
