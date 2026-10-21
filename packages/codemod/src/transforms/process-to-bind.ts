// packages/codemod/src/transforms/process-to-bind.ts — `processTrack` ⇒ `bindTrack` (#167)
//
// عمداً manual-only: امضای جدید به نمونهٔ `analytics` نیاز دارد که بازنویسی
// مکانیکی نمی‌تواند آن را اختراع کند. موارد با دستورالعمل دقیق گزارش می‌شوند.
import ts from 'typescript';
import { manual, namedImportsFrom, resolvesTo } from '../edits';
import type { ManualItem } from '../types';
import type { Transform, TransformContext } from '../transform';

/** @public */
export const processToBind: Transform = {
  id: 'process-to-bind',
  description:
    'Flag legacy `processTrack(el, attr, ctx)` for manual migration to `bindTrack(el, { analytics, ... })`.',
  run(ctx: TransformContext) {
    const { source, checker, file } = ctx;
    const imports = namedImportsFrom(source, '@zenith/runtime').filter(
      (imp) => imp.imported === 'processTrack',
    );
    if (imports.length === 0) return { edits: [], manual: [], changes: [] };
    const targets = new Set(imports.map((imp) => imp.node));
    const manuals: ManualItem[] = [];
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'processTrack' &&
        [...targets].some((target) => resolvesTo(checker, node.expression as ts.Identifier, target))
      ) {
        manuals.push(
          manual(
            file,
            source,
            node.getStart(source),
            'process-to-bind',
            'Replace `processTrack(el, attr, ctx)` with `bindTrack(el, { analytics, expression: attr, context: ctx })` from `@zenith/analytics` (provide an `analytics` instance; see `createAnalytics`).',
          ),
        );
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    return { edits: [], manual: manuals, changes: [] };
  },
};
