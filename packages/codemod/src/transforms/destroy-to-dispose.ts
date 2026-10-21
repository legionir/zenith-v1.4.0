// packages/codemod/src/transforms/destroy-to-dispose.ts — `x.destroy()` ⇒ `x.dispose()` (#167)
//
// فقط روی instanceهای رهگیری‌شده: `const x = new Cls()` که Cls از ماژولِ
// نگاشت‌شدهٔ @zenith وارد شده باشد (الگوی binding-aware در `migrations.ts`
// ِCLI؛ رشته‌ها/کامنت‌ها/متغیرهای shadow دست نمی‌خورند). `x.cancel()` عمداً
// پوشش داده نمی‌شود: در Zenith به معنای dispose نیست (استریم/DOM/animation).
import ts from 'typescript';
import type { TextEdit } from '../edits';
import type { Transform, TransformContext } from '../transform';

/** کلاس ⇒ ماژول @zenithای که از آن وارد می‌شود (رونوشت نگاشت CLI؛ #109 یکتا می‌کند). */
const CLASSES: Readonly<Record<string, string>> = {
  Resource: '@zenith/resource',
  FormStore: '@zenith/form',
  Auth: '@zenith/auth',
  CrudEngine: '@zenith/crud',
  ActionRegistry: '@zenith/actions',
  SWController: '@zenith/service-worker',
};

/** @public */
export const destroyToDispose: Transform = {
  id: 'destroy-to-dispose',
  description: 'Rewrite `.destroy()` to `.dispose()` on tracked Zenith owned instances.',
  run(ctx: TransformContext) {
    const { source, checker } = ctx;
    const edits: TextEdit[] = [];
    const changes = new Set<string>();

    const constructors = new Set<ts.Symbol>();
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
        continue;
      }
      if (statement.importClause?.isTypeOnly) continue;
      const bindings = statement.importClause?.namedBindings;
      if (!bindings || !ts.isNamedImports(bindings)) continue;
      for (const element of bindings.elements) {
        if (element.isTypeOnly) continue;
        const imported = (element.propertyName ?? element.name).text;
        if (CLASSES[imported] !== statement.moduleSpecifier.text) continue;
        const symbol = checker.getSymbolAtLocation(element.name);
        if (symbol) constructors.add(symbol);
      }
    }

    const instances = new Set<ts.Symbol>();
    const collect = (node: ts.Node): void => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        ts.isNewExpression(node.initializer) &&
        ts.isIdentifier(node.initializer.expression) &&
        ts.isVariableDeclarationList(node.parent) &&
        (node.parent.flags & ts.NodeFlags.Const) !== 0
      ) {
        const constructor = checker.getSymbolAtLocation(node.initializer.expression);
        const instance = checker.getSymbolAtLocation(node.name);
        if (constructor && constructors.has(constructor) && instance) instances.add(instance);
      }
      ts.forEachChild(node, collect);
    };
    collect(source);

    const visit = (node: ts.Node): void => {
      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
        const symbol = checker.getSymbolAtLocation(node.expression);
        if (symbol && instances.has(symbol) && node.name.text === 'destroy') {
          edits.push({ start: node.name.getStart(source), end: node.name.end, text: 'dispose' });
          changes.add('owned instance destroy → dispose');
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);

    return { edits, manual: [], changes: [...changes] };
  },
};
