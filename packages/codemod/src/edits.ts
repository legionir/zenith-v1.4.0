// packages/codemod/src/edits.ts — موتور ویرایش متنی + کمک‌های AST (#167)
//
// ویرایش‌ها روی بازه‌های TS (start/end مطلق) اعمال می‌شوند: مرتب‌سازی نزولی،
// رد هم‌پوشان‌ها (با مورد manual). تزریق import موجود را بازاستفاده می‌کند تا
// خروجی idempotent بماند (اجرای دوم = بدون تغییر).
import ts from 'typescript';
import type { ManualItem, TransformId } from './types';

/** @public یک ویرایش متنی روی بازهٔ مطلق. */
export interface TextEdit {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

/** شمارهٔ خط ۱-مبنا برای یک موقعیت مطلق. */
export function lineOf(source: ts.SourceFile, pos: number): number {
  return source.getLineAndCharacterOfPosition(pos).line + 1;
}

/**
 * اعمال ویرایش‌ها روی متن. هم‌پوشان‌ها رد می‌شوند و در `dropped` گزارش
 * می‌شوند تا فراخواننده مورد manual ثبت کند.
 *
 * @public
 */
export function applyEdits(
  text: string,
  edits: readonly TextEdit[],
): { text: string; dropped: number } {
  let out = text;
  let dropped = 0;
  let floor = Number.POSITIVE_INFINITY;
  // نزولیِ موقعیت؛ در شروعِ برابر، بازهٔ بزرگ‌تر اول (حذفِ کل declaration پیش
  // از درجِ تازه در همان نقطه) تا ترکیب remove+insert سالم بماند.
  const ordered = [...edits].sort(
    (a, b) => b.start - a.start || b.end - b.start - (a.end - a.start),
  );
  for (const edit of ordered) {
    // درج خالص (start === end) مجاز است؛ فقط بازهٔ وارونه یا هم‌پوشان رد می‌شود.
    if (edit.end > floor || edit.start > edit.end) {
      dropped++;
      continue;
    }
    floor = edit.start;
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  }
  return { text: out, dropped };
}

/** @public یک specifier ایمپورت نام‌دارِ غیر-type. */
export interface NamedImport {
  /** نام واردشده (`propertyName ?? name`). */
  readonly imported: string;
  /** نام محلی. */
  readonly local: string;
  /** گره specifier (برای ویرایش). */
  readonly node: ts.ImportSpecifier;
  /** گره import والد. */
  readonly parent: ts.ImportDeclaration;
}

/** فهرست importهای نام‌دار غیر-type-only از یک ماژول دقیق. */
export function namedImportsFrom(
  source: ts.SourceFile,
  module: string,
): NamedImport[] {
  const out: NamedImport[] = [];
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }
    if (statement.moduleSpecifier.text !== module) continue;
    if (statement.importClause?.isTypeOnly) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      if (element.isTypeOnly) continue;
      out.push({
        imported: (element.propertyName ?? element.name).text,
        local: element.name.text,
        node: element,
        parent: statement,
      });
    }
  }
  return out;
}

/** آیا نامی در سطح فایل به‌عنوان binding محلی گرفته شده؟ (import/declared) */
export function isNameTaken(source: ts.SourceFile, name: string): boolean {
  let taken = false;
  const visit = (node: ts.Node): void => {
    if (taken) return;
    if (
      (ts.isVariableDeclaration(node) ||
        ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isEnumDeclaration(node) ||
        ts.isImportSpecifier(node) ||
        ts.isImportClause(node) ||
        ts.isNamespaceImport(node)) &&
      node.name &&
      ts.isIdentifier(node.name) &&
      node.name.text === name
    ) {
      taken = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return taken;
}

/**
 * آیا این شناسه دقیقاً به گرهٔ import داده‌شده resolve می‌شود؟
 * (محافظ shadowing: پارامتر/متغیر محلیِ هم‌نام هرگز match نمی‌شود.)
 */
export function resolvesTo(
  checker: ts.TypeChecker,
  id: ts.Identifier,
  target: ts.Node,
): boolean {
  const symbol = checker.getSymbolAtLocation(id);
  return symbol?.declarations?.includes(target) ?? false;
}

/**
 * ویرایش‌های لازم برای «این نام‌ها از ماژول M در دسترس باشند» (یک statement
 * واحد؛ alias اختیاری `import { X as local }`):
 * اگر import نام‌دارِ موجود از M هست، specifierها به آن اضافه می‌شوند؛ وگرنه
 * یک import تازه در ابتدای فایل (پس از shebang) درج می‌شود — عمداً ابتدای
 * فایل تا هرگز داخل بازهٔ یک حذفِ هم‌زمان نیفتد. نام‌های ازپیش‌واردشده
 * نادیده گرفته می‌شوند (idempotency).
 */
export function ensureNamedImports(
  source: ts.SourceFile,
  text: string,
  module: string,
  wants: ReadonlyArray<{ imported: string; local: string }>,
): TextEdit[] {
  const existing = namedImportsFrom(source, module);
  const missing = wants.filter(
    (want) => !existing.some((imp) => imp.imported === want.imported),
  );
  if (missing.length === 0) return [];
  const clause = missing
    .map((want) => (want.local === want.imported ? want.imported : `${want.imported} as ${want.local}`))
    .join(', ');
  if (existing.length > 0) {
    const last = existing[existing.length - 1]!;
    return [{ start: last.node.end, end: last.node.end, text: `, ${clause}` }];
  }
  // سبک مخزن: importها با `;\n` جدا می‌شوند؛ درج تازه همین شکل را دارد.
  const prefix = text.startsWith('#!') ? `${text.split('\n')[0]}\n` : '';
  return [
    {
      start: prefix.length,
      end: prefix.length,
      text: `${prefix}import { ${clause} } from '${module}';\n`,
    },
  ];
}

/**
 * حالت تکی `ensureNamedImports` (سازگاری فراخوان‌ها).
 */
export function ensureNamedImport(
  source: ts.SourceFile,
  text: string,
  module: string,
  name: string,
  local: string = name,
): TextEdit[] {
  return ensureNamedImports(source, text, module, [{ imported: name, local }]);
}

/**
 * حذف یک specifier از import؛ اگر آخرین specifier بود، کل declaration حذف
 * می‌شود (همراه خط خودش تا خروجی تمیز بماند).
 */
export function removeImportSpecifier(
  source: ts.SourceFile,
  text: string,
  spec: ts.ImportSpecifier,
  parent: ts.ImportDeclaration,
): TextEdit[] {
  const bindings = parent.importClause?.namedBindings;
  if (!bindings || !ts.isNamedImports(bindings) || bindings.elements.length <= 1) {
    const start = parent.getStart(source);
    let end = parent.end;
    if (text[end] === '\n') end++;
    else if (text[end] === '\r') end += text[end + 1] === '\n' ? 2 : 1;
    return [{ start, end, text: '' }];
  }
  return [{ start: spec.getStart(source), end: spec.end, text: '__CODEMOD_REMOVE__' }];
}

/**
 * پس‌پردازش حذف specifier: `, X` یا `X ,`ِ به‌جامانده را پاک می‌کند.
 * روی متنِ پس از اعمال ویرایش‌ها اجرا می‌شود (placeholder حذف می‌شود).
 */
export function cleanupRemovedSpecifiers(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      if (!line.includes('__CODEMOD_REMOVE__')) return line;
      return line
        .replace(/,\s*__CODEMOD_REMOVE__/, '')
        .replace(/__CODEMOD_REMOVE__\s*,/, '')
        .replace(/__CODEMOD_REMOVE__/, '');
    })
    .join('\n');
}

/**
 * حذف گروهی specifierها: اگر همهٔ specifierهای نام‌دار یک declaration بروند
 * (و default هم نباشد)، کل declaration حذف می‌شود تا `import { , }` نماند؛
 * وگرنه placeholder تکی (با `cleanupRemovedSpecifiers` تمیز می‌شود).
 */
export function removeSpecifiers(
  source: ts.SourceFile,
  text: string,
  items: ReadonlyArray<{ element: ts.ImportSpecifier; parent: ts.ImportDeclaration }>,
): TextEdit[] {
  const edits: TextEdit[] = [];
  const byParent = new Map<ts.ImportDeclaration, ts.ImportSpecifier[]>();
  for (const item of items) {
    const list = byParent.get(item.parent) ?? [];
    list.push(item.element);
    byParent.set(item.parent, list);
  }
  for (const [parent, elements] of byParent) {
    const bindings = parent.importClause?.namedBindings;
    const allNamed =
      bindings && ts.isNamedImports(bindings) ? [...bindings.elements] : [];
    const removingAll =
      allNamed.length > 0 &&
      allNamed.every((element) => elements.includes(element)) &&
      !parent.importClause?.name;
    if (removingAll) {
      const start = parent.getStart(source);
      let end = parent.end;
      if (text[end] === '\n') end++;
      else if (text[end] === '\r') end += text[end + 1] === '\n' ? 2 : 1;
      edits.push({ start, end, text: '' });
    } else {
      for (const element of elements) {
        edits.push(...removeImportSpecifier(source, text, element, parent));
      }
    }
  }
  return edits;
}

/** سازندهٔ مورد manual. */
export function manual(
  file: string,
  source: ts.SourceFile,
  pos: number,
  transform: TransformId,
  message: string,
): ManualItem {
  return { file, line: lineOf(source, pos), transform, message };
}
