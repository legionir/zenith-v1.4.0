// packages/ssr/src/server-component-factory.ts
//
// factory تعریف ServerComponent — استخراج مکانیکی از server-component.ts،
// بدون تغییر رفتار (#40).

import type { ServerComponent } from './server-component-types';


// ── FACTORY ──

/**
 * Factory helper برای تعریف یک Server Component با type safety.
 *
 * استفاده:
 *   const Markdown = defineServerComponent('markdown', async (props) => {
 *     return `<div class="markdown">${props.content}</div>`;
 *   });
 *   registerServerComponent(Markdown);
 *
 * یا به‌صورت inline:
 *   registerServerComponent(defineServerComponent('header', (p) => `<h1>${p.title}</h1>`));
 *
 * @param name   نام کامپوننت.
 * @param render تابع رندر.
 */
export function defineServerComponent(
  name: string,
  render: (props: Record<string, unknown>) => Promise<string> | string,
): ServerComponent {
  return { name, render };
}
