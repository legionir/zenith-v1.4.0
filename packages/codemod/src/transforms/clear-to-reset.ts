// packages/codemod/src/transforms/clear-to-reset.ts — `clearX()` در تست ⇒ `resetForTesting()` (#167)
//
// یازده پاک‌سازی سراسریِ منسوخ (ZEN-DEPR-054..064) در فایل‌های تست به
// `resetForTesting()` از `@zenith/testing` تبدیل می‌شوند؛ بیرون از تست فقط
// manual (در کد production نباید صدا زده شوند).
import ts from 'typescript';
import {
  ensureNamedImport,
  manual,
  removeSpecifiers,
  resolvesTo,
  type TextEdit,
} from '../edits';
import type { ManualItem } from '../types';
import type { Transform, TransformContext } from '../transform';

/** نام‌های تحت پوشش (ZEN-DEPR-054 تا ZEN-DEPR-064). */
const CLEAR_NAMES = new Set([
  'clearActions',
  'clearComponents',
  'clearAuth',
  'clearPermissionManagers',
  'clearResources',
  'clearStores',
  'clearServerComponents',
  'clearEventModifiers',
  'clearCustomDirectives',
  'clearScheduler',
  'clearRegistry',
]);

/** `clearRegistry` فقط از این ماژول‌ها (DEPR-034/064)؛ بقیهٔ منابع نادیده. */
const CLEAR_REGISTRY_MODULES = new Set(['@zenith/devtools-core', '@zenith/state']);

/** @public آیا این مسیر فایل تست است؟ */
export function isTestFile(filename: string): boolean {
  return (
    /\.test\.[cm]?[jt]sx?$/.test(filename) ||
    /\.spec\.[cm]?[jt]sx?$/.test(filename) ||
    /(^|\/)test\//.test(filename) ||
    /(^|\/)__tests__\//.test(filename)
  );
}

interface ClearSpec {
  readonly element: ts.ImportSpecifier;
  readonly parent: ts.ImportDeclaration;
  readonly imported: string;
}

/** @public */
export const clearToReset: Transform = {
  id: 'clear-to-reset',
  description:
    'Rewrite deprecated `clearX()` globals to `resetForTesting()` from `@zenith/testing` in test files.',
  run(ctx: TransformContext) {
    const { source, checker, file, text } = ctx;
    const edits: TextEdit[] = [];
    const manuals: ManualItem[] = [];
    const changes = new Set<string>();
    const test = isTestFile(file);
    const specs: ClearSpec[] = [];

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
        if (!CLEAR_NAMES.has(imported)) continue;
        if (
          imported === 'clearRegistry' &&
          !CLEAR_REGISTRY_MODULES.has(statement.moduleSpecifier.text)
        ) {
          continue;
        }
        if (!test) {
          manuals.push(
            manual(
              file,
              source,
              element.getStart(source),
              'clear-to-reset',
              `\`${imported}()\` is deprecated (use \`resetForTesting()\` from \`@zenith/testing\` in tests); production code should not call global resets — remove or migrate manually.`,
            ),
          );
          continue;
        }
        specs.push({ element, parent: statement, imported });
      }
    }
    if (specs.length === 0) return { edits, manual: manuals, changes: [] };

    // فراخوانی‌هایی که به specifierهای جمع‌شده resolve می‌شوند (محافظ shadowing).
    let renamedCalls = 0;
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        for (const spec of specs) {
          if (resolvesTo(checker, node.expression, spec.element.name)) {
            edits.push({
              start: node.expression.getStart(source),
              end: node.expression.end,
              text: 'resetForTesting',
            });
            renamedCalls++;
            break;
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);

    edits.push(
      ...removeSpecifiers(
        source,
        text,
        specs.map((spec) => ({ element: spec.element, parent: spec.parent })),
      ),
    );
    for (const spec of specs) {
      changes.add(`${spec.imported} import removed`);
    }
    if (renamedCalls > 0) {
      edits.push(...ensureNamedImport(source, text, '@zenith/testing', 'resetForTesting'));
      changes.add('clearX() → resetForTesting()');
    }
    return { edits, manual: manuals, changes: [...changes] };
  },
};
