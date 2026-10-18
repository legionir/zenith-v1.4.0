import type { ElementInfo } from './syntax-types';
/** Attribute iteration, raw text and child classification. @internal */
export function analyzeElement(el: Element): ElementInfo {
  const directives: Array<{ name: string; value: string; raw: string }> = [];
  const staticAttrs: Array<{ name: string; value: string }> = [];

  for (const attr of Array.from(el.attributes)) {
    if (attr.name.startsWith('zen-')) {
      // دایرکتیو.
      const name = attr.name.split(':')[0]!; // zen-bind:class → zen-bind
      directives.push({ name, value: attr.value, raw: attr.name });
    } else {
      // static attribute.
      staticAttrs.push({ name: attr.name, value: attr.value });
    }
  }

  // static text (اگر فقط یک text node فرزند است).
  let staticText: string | null = null;
  const children = Array.from(el.childNodes);
  if (children.length === 1 && children[0]!.nodeType === 3) {
    staticText = children[0]!.textContent;
  }

  // آیا فرزندان (غیر از text) دارد؟
  const hasChildren = children.some((c) => c.nodeType === 1);

  return {
    tag: el.tagName.toLowerCase(),
    directives,
    staticAttrs,
    staticText,
    hasChildren,
  };
}
