import { escapeHtml } from './escape';
export function indexHtmlTemplate(projectName: string): string {
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(projectName)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      line-height: 1.6;
      color: #1f2937;
      background: #f9fafb;
    }
    h1 { color: #3b82f6; }
    button {
      padding: 10px 18px;
      font-size: 14px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      cursor: pointer;
      background: #fff;
    }
    button:hover { background: #f3f4f6; }
    .counter {
      font-size: 3rem;
      font-weight: bold;
      color: #3b82f6;
      font-variant-numeric: tabular-nums;
      margin: 16px 0;
    }
  </style>
</head>
<body>
  <h1>🚀 ${escapeHtml(projectName)}</h1>
  <p>به فریم‌ورک Zenith خوش آمدید!</p>

  <div id="app">
    <h2>شمارنده</h2>
    <div class="counter"><span zen-text="$count"></span></div>
    <button zen-action="increment">+ ۱</button>
    <button zen-action="decrement">− ۱</button>
  </div>

  <script type="module" src="/src/main.ts"></script>
</body>
</html>
`;
}

/**
 * قالب `src/main.ts` برای پروژه‌ی جدید.
 */
export function mainTsTemplate(): string {
  return `import { signal } from '@zenith/state';
import { Zen } from '@zenith/runtime';
import { logger } from '@zenith/logger';

// 1. تعریف State
const state = {
  count: signal(0),
};

// 2. ثبت Action ها
Zen.action('increment', ({ state }) => {
  state.count.set(state.count.get() + 1);
});

Zen.action('decrement', ({ state }) => {
  state.count.set(Math.max(0, state.count.get() - 1));
});

// 3. شروع فریم‌ورک
Zen.start(document.getElementById('app')!, state);

// BUG-CLI-01 FIX: اعتبارسنجی runtime برای Action‌های تعریف‌نشده
// اگر دکمه‌ای در HTML دارای zen-action باشد اما handler آن ثبت نشده باشد،
// یک warning در کنسول چاپ می‌شود.
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement | null;
  const actionName = target?.getAttribute?.('zen-action');
  if (actionName && typeof actionName === 'string') {
    if (!Zen.action.has(actionName)) {
      logger.warn(\`[Zenith] Action "\${actionName}" is not registered. \` +
        \`Define it with: Zen.action('\${actionName}', handler)\`);
    }
  }
}, true);

logger.debug('🚀 App started. Try Zen DevTools: window.__ZENITH__');
`;
}

/**
 * قالب `vite.config.ts` برای پروژه‌ی جدید.
 */
export function viteConfigTemplate(): string {
  return `import { defineConfig } from 'vite';
import { zenithPlugin } from '@zenith/vite-plugin';

export default defineConfig({
  plugins: [
    zenithPlugin(),
  ],
  server: {
    port: 3000,
  },
});
`;
}

/**
 * قالب `package.json` برای پروژه‌ی جدید.
 */
export function tsConfigTemplate(): string {
  return `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src", "server", "vite.config.ts"]
}
`;
}

/**
 * قالب `README.md` برای پروژه‌ی جدید.
 */
export function readmeTemplate(projectName: string): string {
  return `# ${projectName}

یک اپلیکیشن ساخته‌شده با [فریم‌ورک Zenith](https://github.com/zenith).

## شروع

\`\`\`bash
npm install
npm run dev
\`\`\`

سپس مرورگر را روی http://localhost:3000 باز کنید.

## ساختار

- \`index.html\` — صفحه‌ی اصلی با دایرکتیوهای Zenith
- \`src/main.ts\` — تعریف State و Action ها
- \`vite.config.ts\` — پیکربندی Vite با پلاگین Zenith

## ابزارهای توسعه

- **HMR:** تغییرات HTML به‌صورت زنده اعمال می‌شوند.
- **DevTools:** در console، \`window.__ZENITH__\` را امتحان کنید.

## یاد بیشتر

- [مستندات Zenith](https://github.com/zenith/docs)
- [CLI Commands](https://github.com/zenith/cli)
`;
}

/**
 * قالب کامپوننت.
 */
export function gitignoreTemplate(): string {
  return `node_modules/
dist/
.env
.env.local
*.log
.DS_Store
.vite/
`;
}

// ────────────────────────────────────────────────
// PWA Templates (Production Readiness #32)
// ────────────────────────────────────────────────

/**
 * قالب manifest.json برای PWA.
 *
 * این فایل به مرورگر می‌گوید که اپلیکیشن قابل نصب است و
 * هنگام install روی home screen با این متادیتا نمایش داده می‌شود.
 */
