// packages/codemod/src/transforms/console-to-logger.ts — `console.*` ⇒ `logger.*` (#167)
//
// تک‌آرگومانی‌ها بازنویسی می‌شوند (`log/info` ⇒ `info`؛ بقیه هم‌نام) و import
// تزریق می‌شود؛ چندآرگومانی‌ها و متدهای بدون معادل manual می‌شوند. `console`
// محلیِ shadowشده هرگز دست نمی‌خورد.
import ts from 'typescript';
import { ensureNamedImport, isNameTaken, manual, type TextEdit } from '../edits';
import type { ManualItem } from '../types';
import type { Transform, TransformContext } from '../transform';

/** متد console ⇒ متد logger. */
const LEVELS: Readonly<Record<string, string>> = {
  log: 'info',
  info: 'info',
  warn: 'warn',
  error: 'error',
  debug: 'debug',
};

/** @public */
export const consoleToLogger: Transform = {
  id: 'console-to-logger',
  description: 'Rewrite single-argument `console.*` calls to `logger.*` from `@zenith/logger`.',
  run(ctx: TransformContext) {
    const { source, file, text } = ctx;
    const edits: TextEdit[] = [];
    const manuals: ManualItem[] = [];
    const changes = new Set<string>();
    let needsImport = false;
    const shadowed = isNameTaken(source, 'console');

    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === 'console' &&
        ts.isIdentifier(node.expression.name)
      ) {
        const start = node.expression.getStart(source);
        const method = node.expression.name.text;
        const level = LEVELS[method];
        if (shadowed) {
          manuals.push(
            manual(
              file,
              source,
              start,
              'console-to-logger',
              '`console` is shadowed by a local binding here — migrate this call manually.',
            ),
          );
        } else if (level === undefined) {
          manuals.push(
            manual(
              file,
              source,
              start,
              'console-to-logger',
              `\`console.${method}\` has no direct \`logger\` equivalent — migrate manually.`,
            ),
          );
        } else if (node.arguments.length !== 1) {
          manuals.push(
            manual(
              file,
              source,
              start,
              'console-to-logger',
              `\`console.${method}\` with ${node.arguments.length} arguments cannot map to \`logger.${level}(msg, details?)\` — migrate manually.`,
            ),
          );
        } else {
          edits.push({
            start: node.expression.expression.getStart(source),
            end: node.expression.end,
            text: `logger.${level}`,
          });
          needsImport = true;
          changes.add(`console.${method} → logger.${level}`);
        }
      } else if (
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'console' &&
        !ts.isCallExpression(node.parent)
      ) {
        // ارجاع غیرفراخوانی (`const c = console.log`) — بدون shadowing هم manual.
        manuals.push(
          manual(
            file,
            source,
            node.getStart(source),
            'console-to-logger',
            'Non-call `console` reference — migrate manually.',
          ),
        );
      }
      ts.forEachChild(node, visit);
    };
    visit(source);

    if (needsImport) {
      edits.push(...ensureNamedImport(source, text, '@zenith/logger', 'logger'));
    }
    return { edits, manual: manuals, changes: [...changes] };
  },
};
