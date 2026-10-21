// packages/codemod/src/transforms/error-class.ts — `throw new Error` ⇒ `ZenithError` (#167)
//
// پیام (و `cause`) حفظ می‌شود؛ `code` عمداً خالی می‌ماند تا بازبین یک کد
// واقعی `ZEN-xxxx` انتخاب کند (مورد manual روی همان خط). import تزریق می‌شود.
import ts from 'typescript';
import { ensureNamedImport, isNameTaken, manual, type TextEdit } from '../edits';
import type { ManualItem } from '../types';
import type { Transform, TransformContext } from '../transform';

/** @public */
export const errorClass: Transform = {
  id: 'error-class',
  description:
    'Rewrite `throw new Error(msg)` to `throw new ZenithError({ ... })` (reviewer picks a real code).',
  run(ctx: TransformContext) {
    const { source, file, text } = ctx;
    const edits: TextEdit[] = [];
    const manuals: ManualItem[] = [];
    const changes = new Set<string>();
    let needsImport = false;
    // اگر `Error` محلی bind شده (import/declared)، سراسری‌بودن نامشخص است.
    const shadowed = isNameTaken(source, 'Error');

    const visit = (node: ts.Node): void => {
      if (
        ts.isThrowStatement(node) &&
        node.expression &&
        ts.isNewExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === 'Error'
      ) {
        const args = node.expression.arguments ?? [];
        const start = node.expression.getStart(source);
        if (shadowed) {
          manuals.push(
            manual(
              file,
              source,
              start,
              'error-class',
              '`Error` is shadowed by a local binding here — migrate this `throw` manually.',
            ),
          );
        } else if (args.length === 0 || args.length > 2) {
          manuals.push(
            manual(
              file,
              source,
              start,
              'error-class',
              '`throw new Error` with no message (or extra arguments) cannot be mapped to `ZenithError` — rewrite manually with a real `ZEN-xxxx` code.',
            ),
          );
        } else {
          const message = args[0]!.getText(source);
          let cause = '';
          if (args.length === 2) {
            const second = args[1]!;
            const causeProp =
              ts.isObjectLiteralExpression(second) && second.properties.length === 1
                ? second.properties[0]
                : undefined;
            if (
              causeProp &&
              ts.isPropertyAssignment(causeProp) &&
              ts.isIdentifier(causeProp.name) &&
              causeProp.name.text === 'cause'
            ) {
              cause = `, cause: ${causeProp.initializer.getText(source)}`;
            } else {
              manuals.push(
                manual(
                  file,
                  source,
                  start,
                  'error-class',
                  'Second `Error` argument is not `{ cause }` — migrated the message only; carry the extra argument over manually.',
                ),
              );
            }
          }
          edits.push({
            start,
            end: node.expression.end,
            text: `new ZenithError({ code: '' /* TODO(codemod): set a real ZEN-xxxx code */, category: 'Internal', message: ${message}${cause} })`,
          });
          manuals.push(
            manual(
              file,
              source,
              start,
              'error-class',
              'Pick a real `ZEN-xxxx` code for this `ZenithError` (placeholder `code: \'\'`).',
            ),
          );
          needsImport = true;
          changes.add('throw new Error → ZenithError');
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);

    if (needsImport) {
      edits.push(...ensureNamedImport(source, text, '@zenith/errors', 'ZenithError'));
    }
    return { edits, manual: manuals, changes: [...changes] };
  },
};
