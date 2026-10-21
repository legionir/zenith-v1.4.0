// packages/codemod/src/transforms/cache-unify.ts — کش‌های قدیمی ⇒ `createCache` (#167)
//
// دو بخش: (۱) بازنویسی خودکار `registerCache` (از `@zenith/devtools-core`) به
// `registerDevtoolsCache` (ZEN-DEPR-042)؛ (۲) شناسایی الگوهای ساختاری کش دستی
// (`new LRUCache`، `new Map<…CacheEntry…>`، `class XxxCache`) که معنایشان
// قابل استنتاج مکانیکی نیست ⇒ manual با راهنمای `createCache`.
import ts from 'typescript';
import { manual, namedImportsFrom, resolvesTo, type TextEdit } from '../edits';
import type { ManualItem } from '../types';
import type { Transform, TransformContext } from '../transform';

/** @public */
export const cacheUnify: Transform = {
  id: 'cache-unify',
  description:
    'Rename `registerCache` to `registerDevtoolsCache` and flag hand-rolled caches for `createCache`.',
  run(ctx: TransformContext) {
    const { source, checker, file } = ctx;
    const edits: TextEdit[] = [];
    const manuals: ManualItem[] = [];
    const changes = new Set<string>();

    const imports = namedImportsFrom(source, '@zenith/devtools-core').filter(
      (imp) => imp.imported === 'registerCache',
    );
    // فایلی که از قبل روی `@zenith/cache` است، کش دستیِ عمدی دارد — سکوت.
    const alreadyUnified =
      source.statements.some(
        (statement) =>
          ts.isImportDeclaration(statement) &&
          ts.isStringLiteral(statement.moduleSpecifier) &&
          statement.moduleSpecifier.text === '@zenith/cache',
      );
    const targets = imports.map((imp) => imp.node);
    for (const imp of imports) {
      edits.push({
        start: imp.node.getStart(source),
        end: imp.node.end,
        text: imp.imported === imp.local ? 'registerDevtoolsCache' : `registerDevtoolsCache as ${imp.local}`,
      });
      changes.add('registerCache import → registerDevtoolsCache');
    }

    const visit = (node: ts.Node): void => {
      // فراخوانی‌های بدون alias.
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'registerCache' &&
        targets.some((target) => resolvesTo(checker, node.expression as ts.Identifier, target.name))
      ) {
        edits.push({
          start: node.expression.getStart(source),
          end: node.expression.end,
          text: 'registerDevtoolsCache',
        });
        changes.add('registerCache() → registerDevtoolsCache()');
      }
      // الگوهای ساختاری کش دستی ⇒ manual (مگر فایل از قبل یکپارچه باشد).
      if (
        !alreadyUnified &&
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'LRUCache'
      ) {
        manuals.push(
          manual(
            file,
            source,
            node.getStart(source),
            'cache-unify',
            'Hand-rolled `LRUCache` — replace with `createCache` from `@zenith/cache` (see #144) manually.',
          ),
        );
      }
      if (
        !alreadyUnified &&
        ts.isNewExpression(node) &&
        node.typeArguments?.some(
          (arg) =>
            ts.isTypeReferenceNode(arg) &&
            ts.isIdentifier(arg.typeName) &&
            /CacheEntry$/.test(arg.typeName.text),
        )
      ) {
        manuals.push(
          manual(
            file,
            source,
            node.getStart(source),
            'cache-unify',
            'Hand-rolled `Map`-based cache store — replace with `createCache` from `@zenith/cache` manually.',
          ),
        );
      }
      if (
        !alreadyUnified &&
        ts.isClassDeclaration(node) &&
        node.name &&
        /Cache$/.test(node.name.text)
      ) {
        manuals.push(
          manual(
            file,
            source,
            node.getStart(source),
            'cache-unify',
            `Hand-rolled cache class \`${node.name.text}\` — replace with \`createCache\` from \`@zenith/cache\` manually.`,
          ),
        );
      }
      ts.forEachChild(node, visit);
    };
    visit(source);

    return { edits, manual: manuals, changes: [...changes] };
  },
};
