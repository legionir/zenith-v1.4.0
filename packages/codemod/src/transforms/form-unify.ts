// packages/codemod/src/transforms/form-unify.ts — سازنده‌های قدیمی فرم ⇒ `createForm` (#167)
//
// `createReactiveForm/createAdvancedForm/createWizardForm` همان آرگومان‌ها را
// به `createForm` می‌دهند (overloadها گونه را تشخیص می‌دهند؛ کارخانهٔ داخلی
// همین تفویض را می‌کند، پس رفتار حفظ می‌شود). ماژول همان `@zenith/form` است.
// اگر `createForm` محلی گرفته شده باشد، مورد manual می‌شود (بدون بازنویسی
// ناسالم).
import ts from 'typescript';
import { isNameTaken, manual, namedImportsFrom, resolvesTo, type TextEdit } from '../edits';
import type { ManualItem } from '../types';
import type { Transform, TransformContext } from '../transform';

/** @public */
export const FORM_CREATORS = new Set([
  'createReactiveForm',
  'createAdvancedForm',
  'createWizardForm',
]);

/** @public */
export const formUnify: Transform = {
  id: 'form-unify',
  description: 'Rewrite legacy form creators to `createForm` with the same arguments.',
  run(ctx: TransformContext) {
    const { source, checker, file } = ctx;
    const edits: TextEdit[] = [];
    const manuals: ManualItem[] = [];
    const changes = new Set<string>();

    const imports = namedImportsFrom(source, '@zenith/form').filter((imp) =>
      FORM_CREATORS.has(imp.imported),
    );
    if (imports.length === 0) return { edits, manual: manuals, changes: [] };

    const blocked = isNameTaken(source, 'createForm');
    const actives: ts.ImportSpecifier[] = [];
    for (const imp of imports) {
      if (blocked) {
        manuals.push(
          manual(
            file,
            source,
            imp.node.getStart(source),
            'form-unify',
            `\`${imp.imported}\` cannot be renamed to \`createForm\` (the name is already taken here) — rename manually.`,
          ),
        );
        continue;
      }
      edits.push({
        start: imp.node.getStart(source),
        end: imp.node.end,
        text: imp.imported === imp.local ? 'createForm' : `createForm as ${imp.local}`,
      });
      changes.add(`${imp.imported} import → createForm`);
      if (imp.imported === imp.local) actives.push(imp.node);
    }

    // فراخوانی‌های بدون alias که به specifier ویرایش‌شده resolve می‌شوند.
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        for (const target of actives) {
          if (resolvesTo(checker, node.expression, target.name)) {
            edits.push({
              start: node.expression.getStart(source),
              end: node.expression.end,
              text: 'createForm',
            });
            changes.add('legacy form creator call → createForm');
            break;
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);

    return { edits, manual: manuals, changes: [...changes] };
  },
};
