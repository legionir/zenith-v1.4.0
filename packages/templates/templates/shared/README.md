# __PROJECT_NAME__

یک اپلیکیشن ساخته‌شده با [فریم‌ورک Zenith](https://github.com/zenith).

## شروع

```bash
npm install
npm run dev
```

سپس مرورگر را روی http://localhost:3000 باز کنید.

## ساختار

- `index.html` — صفحه‌ی اصلی با دایرکتیوهای Zenith
- `src/main.ts` — تعریف State و Action ها
- `vite.config.ts` — پیکربندی Vite با پلاگین Zenith

## ابزارهای توسعه

- **HMR:** تغییرات HTML به‌صورت زنده اعمال می‌شوند.
- **Lint:** قراردادهای Zenith با `npm run lint` بررسی می‌شوند (`@zenith/eslint-plugin`).
- **DevTools:** در console، `window.__ZENITH__` را امتحان کنید.

## یاد بیشتر

- [مستندات Zenith](https://github.com/zenith/docs)
- [CLI Commands](https://github.com/zenith/cli)
