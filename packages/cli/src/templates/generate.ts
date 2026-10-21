export function componentTemplate(name: string): string {
  // تبدیل نام به kebab-case (مثلا UserCard → user-card).
  const kebabName = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

  return `<zen-component name="${kebabName}">
  <template>
    <div class="${kebabName}">
      <h2>${name}</h2>
      <slot></slot>
    </div>
  </template>
</zen-component>
`;
}

/**
 * قالب صفحه (برای SPA).
 */
export function pageTemplate(pageName: string): string {
  return `<div class="page page-${pageName.toLowerCase()}">
  <h1>${pageName}</h1>
  <p>این صفحه‌ی ${pageName} است.</p>
</div>
`;
}

/**
 * قالب Action.
 */
export function actionTemplate(actionName: string): string {
  return `// Action: ${actionName}
// این فایل را در main.ts (یا فایل اصلی اپلیکیشن) import کنید.
import { Zen } from '@zenith/runtime';
import { logger } from '@zenith/logger';

Zen.action('${actionName}', ({ state, element, event }) => {
  logger.debug('Action invoked.');
  // TODO: منطق اکشن را اینجا بنویسید.
});
`;
}

/**
 * قالب فایل `.gitignore`.
 */
