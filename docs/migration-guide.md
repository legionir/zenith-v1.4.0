# Migration Guide: Zenith 0.6.x → 1.0.0

> راهنمای کامل مهاجرت از نسخه‌ی ۰.۶.x به ۱.۰.۰.
>
> v1.0.0 یک **major release** است با تغییرات breaking (با backwards compatibility).

---

## فهرست

1. [خلاصه‌ی تغییرات Breaking](#خلاصه‌ی-تغییرات-breaking)
2. [گام ۱: به‌روزرسانی وابستگی‌ها](#گام-۱-به-روزرسانی-وابستگی‌ها)
3. [گام ۲: بررسی Zen.start](#گام-۲-بررسی-zenstart)
4. [گام ۳: بررسی Resource.destroy](#گام-۳-بررسی-resourcedestroy)
5. [گام ۴: بررسی zen-for](#گام-۴-بررسی-zen-for)
6. [گام ۵: بررسی SSR](#گام-۵-بررسی-ssr)
7. [گام ۶: بررسی Expression Evaluator](#گام-۶-بررسی-expression-evaluator)
8. [گام ۷: بهینه‌سازی‌های اختیاری](#گام-۷-بهینه‌سازی‌های-اختیاری)
9. [عیب‌یابی](#عیب-یابی)

---

## خلاصه‌ی تغییرات Breaking

| تغییر | تأثیر | خطر |
|-------|--------|-----|
| `Zen.start` signature اضافه شد | **بدون** — پارامتر سوم اختیاری است | 🟢 None |
| `Resource.destroy()` اضافه شد | **بدون** — متد جدید، API موجود دست‌نخورده | 🟢 None |
| `compileExpression` اضافه شد | **بدون** — API جدید، `evaluateExpression` همچنان موجود | 🟢 None |
| `zen-static` attribute اضافه شد | **بدون** — attribute جدید، بدون آن رفتار قبلی | 🟢 None |
| SSR از AsyncLocalStorage استفاده می‌کند | **بدون** — `renderToString` API همان است | 🟢 None |
| Property Diffing در directiveها | **بدون** — فقط skip DOM mutation اگر `===` | 🟢 None |
| DocumentFragment batching در zen-for | **بدون** — فقط سرعت mount بهتر | 🟢 None |
| `devtools: false` option | **بدون** — پیش‌فرض `true` (مانند قبل) | 🟢 None |

**نتیجه**: v1.0.0 **fully backwards compatible** است. هیچ کد 0.6.x نباید بشکند.

---

## گام ۱: به‌روزرسانی وابستگی‌ها

### package.json

```json
{
  "dependencies": {
    "@zenith/runtime": "1.0.0",
    "@zenith/state": "1.0.0",
    "@zenith/expressions": "1.0.0",
    "@zenith/resource": "1.0.0",
    "@zenith/ssr": "1.0.0"
  }
}
```

```bash
npm install
# یا
bun install
```

### TypeScript Definitions

اگر از TypeScript استفاده می‌کنید، فایل‌های `.d.ts` به‌طور خودکار به‌روزرسانی می‌شوند. اما اگر type errors دارید:

```bash
# پاک کردن cache
rm -rf node_modules/.cache

# typecheck
npx tsc --noEmit
```

---

## گام ۲: بررسی Zen.start

### قبل (0.6.x)

```typescript
Zen.start(root, state);
```

### بعد (1.0.0) — بدون تغییر

```typescript
Zen.start(root, state); // همچنان کار می‌کند!
```

### اختیاری: غیرفعال‌کردن DevTools در production

```typescript
// Production
Zen.start(root, state, { devtools: false });

// Development (پیش‌فرض)
Zen.start(root, state, { devtools: true });
// یا
Zen.start(root, state);
```

### Migration checklist

- [ ] بررسی کنید که آیا `Zen.start` با ۲ آرگومان صدا زده می‌شود — **همچنان کار می‌کند**.
- [ ] (اختیاری) در production build، `{ devtools: false }` اضافه کنید برای performance بهتر.
- [ ] (اختیاری) در benchmark، `{ devtools: false }` اضافه کنید.

---

## گام ۳: بررسی Resource.destroy

### قبل (0.6.x)

Resource ها فقط `reset()` داشتند. هیچ راهی برای teardown کامل نبود.

```typescript
const users = createResource('users', { url: '/api/users' });
// ... استفاده ...
users.reset(); // فقط state را پاک می‌کرد، اما fetch های inflight ادامه می‌یافتند.
```

### بعد (1.0.0) — اختیاری

```typescript
const users = createResource('users', { url: '/api/users' });
// ... استفاده ...

// هنگام unmount کامپوننت:
users.destroy(); // teardown کامل: timer, abort, queue, registry removal.
```

### Migration checklist

- [ ] بررسی کنید که آیا Resource هایی دارید که باید teardown شوند (مخصوصاً در SPA با route changes).
- [ ] در `onUnmounted` یا cleanup hooks، `destroy()` را صدا بزنید.
- [ ] اگر از `reset()` برای cleanup استفاده می‌کردید، `destroy()` را در نظر بگیرید (کامل‌تر).

### مثال: React Integration

```typescript
import { createResource } from '@zenith/resource';
import { useEffect } from 'react';

function useResource(name: string, url: string) {
  useEffect(() => {
    const resource = createResource(name, { url });
    resource.list();
    return () => {
      resource.destroy(); // v1.0.0: teardown کامل
    };
  }, [name, url]);
}
```

---

## گام ۴: بررسی zen-for

### قبل (0.6.x)

```html
<li zen-for="item in $items" zen-key="item.id">
  <span zen-text="item.name"></span>
</li>
```

### بعد (1.0.0) — بدون تغییر

```html
<li zen-for="item in $items" zen-key="item.id">
  <span zen-text="item.name"></span>
</li>
```

### اختیاری: zen-static برای لیست‌های read-only

```html
<!-- برای لیست‌های فقط‌خواندنی (منو، جدول read-only) -->
<li zen-for="item in $items" zen-key="item.id" zen-static="">
  <span zen-text="item.name"></span>
</li>
```

### Migration checklist

- [ ] بررسی کنید که آیا zen-for هایی دارید که فقط read-only هستند.
- [ ] برای آن‌ها `zen-static` اضافه کنید (۱.۳x-۱.۹x سریع‌تر mount).
- [ ] **هشدار**: `zen-static` با `zen-model` کار نمی‌کند. اگر inside zen-for از zen-model استفاده می‌کنید، `zen-static` اضافه نکنید.

### مثال: چه زمانی zen-static استفاده نکنیم

```html
<!-- ❌ این کار نمی‌کند — zen-model با zen-static پشتیبانی نمی‌شود -->
<li zen-for="user in $users" zen-key="user.id" zen-static="">
  <input zen-model="user.name">
</li>

<!-- ✅ درست — بدون zen-static -->
<li zen-for="user in $users" zen-key="user.id">
  <input zen-model="user.name">
</li>
```

---

## گام ۵: بررسی SSR

### قبل (0.6.x)

`renderToString` از `globalThis` mutation استفاده می‌کرد:

```typescript
// 0.6.x implementation (داخلی):
const saved = {};
for (const g of globals) {
  saved[g] = globalThis[g];
  globalThis[g] = dom.window[g]; // RACE CONDITION!
}
try {
  Zen.start(root, state);
  // ...
} finally {
  for (const g of globals) {
    globalThis[g] = saved[g]; // restore
  }
}
```

### بعد (1.0.0)

`renderToString` از `AsyncLocalStorage` استفاده می‌کند:

```typescript
// 1.0.0 implementation (داخلی):
const globals = { window: dom.window, document: dom.window.document, ... };
await domAls.run(globals, () => {
  Zen.start(root, state);
  // ...
});
// بدون globalThis mutation!
```

### Migration checklist

- [ ] **API تغییر نکرده** — `renderToString(html, state, options)` همچنان همان است.
- [ ] اگر کد سفارشی SSR دارید که `globalThis` را mutate می‌کند، آن را به `domAls.run` تغییر دهید.
- [ ] در ۱۰۰+ concurrent requests، race condition برطرف شده.

### مثال: کد سفارشی SSR

```typescript
// 0.6.x (خطرناک در concurrent):
globalThis.document = dom.window.document;
try {
  // render
} finally {
  delete globalThis.document;
}

// 1.0.0 (safe در concurrent):
import { domAls } from '@zenith/ssr';
const globals = { document: dom.window.document, /* ... */ };
await domAls.run(globals, () => {
  // render
});
```

---

## گام ۶: بررسی Expression Evaluator

### قبل (0.6.x)

```typescript
import { evaluateExpression } from '@zenith/expressions';

const dispose = effect(() => {
  const value = evaluateExpression(expr, context); // هر بار compile() صدا زده می‌شود
  el.textContent = String(value);
});
```

### بعد (1.0.0) — بدون تغییر (همچنین کار می‌کند)

```typescript
import { evaluateExpression } from '@zenith/expressions';

const dispose = effect(() => {
  const value = evaluateExpression(expr, context); // همچنان کار می‌کند
  el.textContent = String(value);
});
```

### اختیاری: compileExpression برای Hot Path

```typescript
import { compileExpression } from '@zenith/expressions';
import { effect } from '@zenith/state';

// compile-once — expr فقط یک‌بار parse می‌شود.
const evalFn = compileExpression(expr);

const dispose = effect(() => {
  const value = evalFn(context); // صفر Map operation
  el.textContent = String(value);
});
```

### Migration checklist

- [ ] **هیچ تغییری لازم نیست** — `evaluateExpression` همچنان کار می‌کند.
- [ ] (اختیاری) برای directive processor های پرتکرار، `compileExpression` استفاده کنید.
- [ ] (اختیاری) اگر custom directive می‌سازید، از `compileExpression` استفاده کنید.

---

## گام ۷: بهینه‌سازی‌های اختیاری

### ۱. Property Diffing (automatic)

هیچ کاری لازم نیست. v1.0.0 به‌طور خودکار در `zen-bind`, `zen-show`, `zen-html`, `zen-html-trusted`, `zen-model` property diffing را فعال می‌کند.

### ۲. DocumentFragment Batching (automatic)

هیچ کاری لازم نیست. v1.0.0 به‌طور خودکار در initial mountِ zen-for (هم standard و هم static) از DocumentFragment استفاده می‌کند.

### ۳. DevTools disable در production

```typescript
// Production
Zen.start(root, state, { devtools: false });
```

### ۴. zen-static برای read-only lists

```html
<li zen-for="item in $items" zen-key="item.id" zen-static="">
  <span zen-text="item.name"></span>
</li>
```

### ۵. compileExpression برای Hot Path

```typescript
const evalFn = compileExpression(expr);
const dispose = effect(() => {
  const value = evalFn(context);
});
```

### ۶. Resource.destroy در unmount

```typescript
onUnmounted(() => {
  resource.destroy();
});
```

---

## عیب‌یابی

### مشکل: `Resource.destroy is not a function`

**علت**: پکیج `@zenith/resource` به 1.0.0 به‌روزرسانی نشده.

**راه‌حل**:
```bash
npm ls @zenith/resource
# بررسی version
npm install @zenith/resource@1.0.0
```

### مشکل: `compileExpression is not exported`

**علت**: پکیج `@zenith/expressions` به 1.0.0 به‌روزرسانی نشده.

**راه‌حل**:
```bash
npm install @zenith/expressions@1.0.0
```

### مشکل: `zen-static باعث می‌شود zen-model کار نکند`

**علت**: این یک documented limitation است. `zen-static` signalsMap نمی‌سازد.

**راه‌حل**: `zen-static` را از element حذف کنید.

### مشکل: `window.__ZENITH__ undefined در production`

**علت**: `devtools: false` باعث می‌شود `initDevTools` صدا زده نشود.

**راه‌حل**: این رفتار درست است. اگر DevTools نیاز دارید، `devtools: true` (یا حذف option) استفاده کنید.

### مشکل: `tsc errors after upgrade`

**علت**: فایل‌های `.d.ts` به‌روزرسانی نشده‌اند.

**راه‌حل**:
```bash
rm -rf node_modules/.cache
rm -rf node_modules/@zenith
npm install
npx tsc --noEmit
```

### مشکل: `SSR race condition هنوز رخ می‌دهد`

**علت**: کد سفارشی SSR دارید که `globalThis` را mutate می‌کند.

**راه‌حل**: کد را به `domAls.run` تغییر دهید (به [گام ۵](#گام-۵-بررسی-ssr) مراجعه کنید).

---

## راهنمای سریع

| می‌_migration خطر | اقدام لازم |
|------------------|-----------|
| 🟢 None | فقط `npm install` — همه چیز کار می‌کند |
| 🟡 Low | (اختیاری) `devtools: false` در production |
| 🟡 Low | (اختیاری) `zen-static` برای read-only lists |
| 🟡 Low | (اختیاری) `compileExpression` برای Hot Path |
| 🟡 Low | (اختیاری) `Resource.destroy()` در unmount |

---

##seealso

- [API Reference v1.0.0](./api-v1.0.md)
- [Performance Tuning Guide](./performance-tuning.md)
- [Changelog v1.0.0](../CHANGELOG.md)
- [Security Audit Report](../../tests/v1.0/security-audit/README.md)
