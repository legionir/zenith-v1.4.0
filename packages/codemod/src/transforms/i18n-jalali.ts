// packages/codemod/src/transforms/i18n-jalali.ts — توابع جلالی `i18n` ⇒ `@zenith/jalali` (#167)
//
// نگاشت دقیق از روی `jalali-compat.ts` (هر alias همان را می‌گوید): تغییر نام،
// جابه‌جایی ماژول، یا هر دو. `toJalali` معادل مستقیم ندارد (رشتهٔ فارسیِ
// قالب‌بندی‌شده در برابر parts) ⇒ manual. تغییرشکل‌های خروجی (tuple⇒object،
// null⇒throw) هم manual می‌شوند تا رفتار بی‌سروصدا عوض نشود.
import ts from 'typescript';
import {
  ensureNamedImports,
  isNameTaken,
  manual,
  namedImportsFrom,
  removeSpecifiers,
  resolvesTo,
  type TextEdit,
} from '../edits';
import type { ManualItem } from '../types';
import type { Transform, TransformContext } from '../transform';

interface JalaliMapping {
  /** نام جدید (در `@zenith/jalali`). */
  readonly to: string;
  /** آیا علاوه بر rename، یادداشت manual لازم است؟ */
  readonly note?: string;
}

const MAPPINGS: Readonly<Record<string, JalaliMapping>> = {
  parseJalaliParts: {
    to: 'toJalaliParts',
    note: '`parseJalaliParts` returned `[y, m, d] | null`; `toJalaliParts` returns a `{ y, m, d }` object and throws out of range — adjust call sites.',
  },
  fromJalali: {
    to: 'fromJalaliParts',
    note: '`fromJalali` never threw (Invalid Date on bad input); `fromJalaliParts` throws — adjust error handling.',
  },
  compareJalali: { to: 'compareJalali' },
  addDaysJalali: {
    to: 'addDays',
    note: '`addDaysJalali` returned `null` on invalid input; `addDays` throws — adjust error handling.',
  },
  isJalaliLeap: { to: 'isLeap' },
  jalaliMonthDays: { to: 'monthDays' },
  formatJalali: { to: 'formatJalali' },
  jalaliMonthName: { to: 'monthName' },
  jalaliNow: { to: 'jalaliNow' },
};

/** @public */
export const i18nJalali: Transform = {
  id: 'i18n-jalali',
  description: 'Move jalali helpers from `@zenith/i18n` to `@zenith/jalali` with renames.',
  run(ctx: TransformContext) {
    const { source, checker, file, text } = ctx;
    const edits: TextEdit[] = [];
    const manuals: ManualItem[] = [];
    const changes = new Set<string>();

    const imports = namedImportsFrom(source, '@zenith/i18n');
    const specs = imports.filter((imp) => MAPPINGS[imp.imported] !== undefined);
    const hasToJalali = imports.some((imp) => imp.imported === 'toJalali');
    if (specs.length === 0 && !hasToJalali) return { edits, manual: manuals, changes: [] };

    if (hasToJalali) {
      const toJalaliSpecs = imports.filter((imp) => imp.imported === 'toJalali');
      const visitManual = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === 'toJalali' &&
          toJalaliSpecs.some((spec) => resolvesTo(checker, node.expression as ts.Identifier, spec.node.name))
        ) {
          manuals.push(
            manual(
              file,
              source,
              node.getStart(source),
              'i18n-jalali',
              '`toJalali` has no direct equivalent (legacy formatted Persian string) — migrate to `formatJalali`/`toJalaliParts` from `@zenith/jalali` manually.',
            ),
          );
        }
        ts.forEachChild(node, visitManual);
      };
      visitManual(source);
    }

    const moved = new Map<string, string>();
    const removals: Array<{ element: ts.ImportSpecifier; parent: ts.ImportDeclaration }> = [];
    for (const spec of specs) {
      const mapping = MAPPINGS[spec.imported]!;
      if (isNameTaken(source, mapping.to) && mapping.to !== spec.local) {
        manuals.push(
          manual(
            file,
            source,
            spec.node.getStart(source),
            'i18n-jalali',
            `\`${spec.imported}\` cannot move to \`${mapping.to}\` (name taken) — rename manually.`,
          ),
        );
        continue;
      }
      // specifier از import قدیمی حذف؛ فراخوانی‌ها به نام جدید (با حفظ alias).
      removals.push({ element: spec.node, parent: spec.parent });
      moved.set(spec.imported, spec.imported === spec.local ? mapping.to : spec.local);
      changes.add(`${spec.imported} → ${mapping.to} (@zenith/jalali)`);
      if (mapping.note) {
        manuals.push(manual(file, source, spec.node.getStart(source), 'i18n-jalali', mapping.note));
      }
    }
    edits.push(...removeSpecifiers(source, text, removals));

    // فراخوانی‌های resolveشونده به specifierهای منتقل‌شده + import جدید گروهی.
    const movedSpecs = specs.filter((spec) => moved.has(spec.imported));
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        for (const spec of movedSpecs) {
          if (resolvesTo(checker, node.expression, spec.node.name)) {
            edits.push({
              start: node.expression.getStart(source),
              end: node.expression.end,
              text: moved.get(spec.imported)!,
            });
            break;
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);

    edits.push(
      ...ensureNamedImports(
        source,
        text,
        '@zenith/jalali',
        movedSpecs.map((spec) => ({
          imported: MAPPINGS[spec.imported]!.to,
          local: moved.get(spec.imported)!,
        })),
      ),
    );
    return { edits, manual: manuals, changes: [...changes] };
  },
};
