import { logger } from '@zenith/logger';
import type { CompileSession } from './session';
import { STRUCTURAL_DIRECTIVES, STRUCTURAL_CONFLICT_MATRIX, COMPILABLE_DIRECTIVES, RUNTIME_DIRECTIVES } from './directives';
import { emitDirective } from './emit-directive';
import { preserveDirectiveForRuntime } from './fallback';
import { analyzeElement } from './analyze-element';
/** Depth-first source walk owns variable numbering and fallback decisions. @internal */
export function compileNode(node: Node, input: { session: CompileSession; parentVar: string; path: string }): void {
  const { session, parentVar, path } = input;
  const { codeLines, warnings, options } = session;
  if (node.nodeType !== 1) {
    // ELEMENT_NODE
    // Text node — اگر محتوای داینامیک دارد.
    if (node.nodeType === 3) {
      // TEXT_NODE
      const text = node.textContent || '';
      if (text.trim()) {
        // static text
        codeLines.push(
          `  ${parentVar}.appendChild(document.createTextNode(${JSON.stringify(text)}));`,
        );
      }
    }
    return;
  }

  const el = node as Element;
  const tagName = el.tagName.toLowerCase();
  const varName = `el${session.varCounter++}`;
  session.elementCount++;
  const elementPath = `${path} > ${tagName}#${varName}`;

  // ساخت عنصر.
  codeLines.push(`  const ${varName} = document.createElement('${tagName}');`);

  // پردازش attribute ها.
  const info = analyzeElement(el);
  for (const attr of info.staticAttrs) {
    codeLines.push(`  ${varName}.setAttribute('${attr.name}', ${JSON.stringify(attr.value)});`);
  }

  // بررسی zen-for — در صورت وجود، الگوریتم پردازش directiveها و فرزندان تغییر می‌کند.
  const hasFor = info.directives.some((d) => d.name === 'zen-for');

  // BUG-COMP-01 FIX (v1.3.0): بررسی جامع تداخل directiveهای ساختاری.
  // از ماتریس STRUCTURAL_CONFLICT_MATRIX استفاده می‌کند تا هر جفت
  // directive ناسازگار روی یک المنت را تشخیص دهد.
  const structuralNamesOnElement = info.directives
    .filter((d) => STRUCTURAL_DIRECTIVES.has(d.name))
    .map((d) => d.name);
  const conflictPairs: string[] = [];
  for (const [a, b] of STRUCTURAL_CONFLICT_MATRIX) {
    if (structuralNamesOnElement.includes(a) && structuralNamesOnElement.includes(b)) {
      conflictPairs.push(`"${a}" + "${b}"`);
    }
  }
  if (conflictPairs.length > 0 && logger.isEnabled('warn')) {
    logger.warn(
      `[Zenith Compiler] Element <${tagName}> has conflicting structural directives: ` +
        `${conflictPairs.join(', ')}. Only the first matching directive will be compiled; ` +
        `others are preserved for runtime fallback.`,
    );
  }

  // پردازش دایرکتیوها.
  for (const dir of info.directives) {
    // zen-key توسط zen-for مصرف می‌شود — پردازش standalone را skip کن.
    if (dir.name === 'zen-key' && hasFor) continue;

    // برای الگوی zen-for: سایر directiveهای روی عنصر template به‌عنوان attribute
    // حفظ می‌شوند تا runtime walker (از طریق processChildren) روی هر clone
    // آن‌ها را پردازش کند. این directiveها روی خود template compile نمی‌شوند
    // چون template هرگز به DOM اضافه نمی‌شود و effectها به فرزندان clone
    // متصل نمی‌شوند.
    if (hasFor && dir.name !== 'zen-for') {
      codeLines.push(
        `  ${varName}.setAttribute(${JSON.stringify(dir.raw)}, ${JSON.stringify(dir.value)});`,
      );
      continue;
    }

    // ابتدا تلاش کن directive را compile کن
    const compiled = emitDirective(dir, { session, varName, parentVar, allDirectives: info.directives, el });

    if (!compiled) {
      // BUG-COMP-07 FIX: بهبود مدیریت fallback زمانی که compileCompilableDirective
      // false برمی‌گرداند. قبلاً در این حالت برای COMPILABLE_DIRECTIVES پیام خطای
      // مشخصی نداشت و خاموش به runtime بسپار می‌کرد. حالا با یک warning واضح و
      // در حالت strict با throw error، توسعه‌دهنده را مطلع می‌کنیم.
      if (RUNTIME_DIRECTIVES.has(dir.name)) {
        // شناخته‌شده اما غیرقابل compile — برای runtime حفظ کن
        preserveDirectiveForRuntime(dir, { session, varName, elementPath });
      } else if (COMPILABLE_DIRECTIVES.has(dir.name)) {
        // BUG-COMP-07 FIX: این حالت ممکن است رخ دهد وقتی compileCompilableDirective
        // به دلیل edge case (مثلاً zen-for با syntax نامعتبر، zen-bind با object
        // syntax پیشرفته) false برمی‌گرداند. به‌جای سکوت، با warning گزارش می‌کنیم.
        const fallbackWarning =
          `[Zenith Compiler] Compilable directive '${dir.raw}' (value: "${dir.value}") ` +
          `could not be compiled at ${elementPath}. Falling back to runtime walker. ` +
          `Consider simplifying the expression or using a simpler directive variant for better performance.`;
        warnings.push(fallbackWarning);
        if (options.strict) {
          throw new Error(fallbackWarning);
        }
        if (logger.isEnabled('warn')) {
          logger.warn(fallbackWarning);
        }
        preserveDirectiveForRuntime(dir, { session, varName, elementPath });
      } else {
        // BUG-COMP-08 FIX: غنی‌سازی پیام برای directive ناشناخته
        const valueDisplay = dir.value ? ` (value: "${dir.value}")` : '';
        const warning =
          `[Zenith Compiler] Unknown directive '${dir.raw}'${valueDisplay} at ${elementPath}. ` +
          `This directive is not recognized and will be preserved for runtime (may not work). ` +
          `Check the spelling or add it to the VALID_DIRECTIVES list.`;
        warnings.push(warning);
        if (options.strict) {
          throw new Error(warning);
        }
        if (logger.isEnabled('warn')) {
          logger.warn(warning);
        }
        preserveDirectiveForRuntime(dir, { session, varName, elementPath });
      }
    }
  }

  // اگر zen-if / zen-for نیست، عنصر را به parent اضافه کن.
  // برای zen-for، خود template به DOM اضافه نمی‌شود — فقط placeholder (comment)
  // و cloneها در زمان effect اضافه می‌شوند.
  const hasIf = info.directives.some((d) => d.name === 'zen-if');
  if (!hasIf && !hasFor) {
    codeLines.push(`  ${parentVar}.appendChild(${varName});`);
  }

  // static text.
  if (info.staticText) {
    codeLines.push(`  ${varName}.textContent = ${JSON.stringify(info.staticText)};`);
  }

  // فرزندان — برای zen-for، children به‌صورت innerHTML در zen-for case قرار
  // می‌گیرند (cloneNode(true) آن‌ها را روی هر clone preserve می‌کند) و توسط
  // processChildren (runtime walker) پردازش می‌شوند.
  if (info.hasChildren && !hasFor) {
    for (const child of Array.from(el.childNodes)) {
      compileNode(child, { session, parentVar: varName, path: elementPath });
    }
  }
}
