# Performance Tuning Guide — Zenith v1.0.0

> راهنمای کامل بهینه‌سازی performance در Zenith v1.0.0.
>
> شامل: چه زمانی `devtools: false`، چه زمانی `zen-static`، چه زمانی compile.

---

## فهرست

1. [خلاصه‌ی بهبودهای v1.0.0](#خلاصه‌ی-بهبودهای-v100)
2. [Decision Tree: کدام بهینه‌سازی؟](#decision-tree)
3. [DevTools: چه زمانی disable کنیم؟](#1-devtools-چه-زمانی-disable-کنیم)
4. [zen-static: چه زمانی استفاده کنیم؟](#2-zen-static-چه-زمانی-استفاده-کنیم)
5. [compileExpression: چه زمانی استفاده کنیم؟](#3-compileexpression-چه-زمانی-استفاده-کنیم)
6. [Compiler: چه زمانی فعال کنیم؟](#4-compiler-چه-زمانی-فعال-کنیم)
7. [Resource.destroy: چه زمانی صدا بزنیم؟](#5-resourcedestroy-چه-زمانی-صدا-بزنیم)
8. [Property Diffing: چگونه کار می‌کند؟](#6-property-diffing-چگونه-کار-میکند)
9. [DocumentFragment Batching: چگونه کار می‌کند؟](#7-documentfragment-batching)
10. [Benchmark Results](#benchmark-results)
11. [Production Checklist](#production-checklist)

---

## خلاصه‌ی بهبودهای v1.0.0

| بهبود | تأثیر | اتوماتیک؟ |
|-------|--------|-----------|
| `devtools: false` option | ۱۰۰x سریع‌تر mount (برای ۱۰k عنصر) | ❌ Manual |
| `zen-static` attribute | ۱.۳x-۱.۹x سریع‌تر mount (برای zen-for) | ❌ Manual |
| `compileExpression` | حذف cache overhead در Hot Path | ❌ Manual |
| Compiler (Level 3) | حذف walker در production build | ❌ Manual (vite-plugin) |
| Property Diffing | ۲x سریع‌تر update (zen-bind) | ✅ Automatic |
| DocumentFragment Batching | ۱ reflow به جای N در initial mount | ✅ Automatic |
| Resource.destroy | جلوگیری از memory leak | ❌ Manual |
| SSR AsyncLocalStorage | رفع race condition در concurrent | ✅ Automatic |

---

## Decision Tree

```
آیا در production هستید؟
├── بله → devtools: false (الزامی)
│         ├── آیا لیست‌های read-only دارید؟
│         │   ├── بله → zen-static (توصیه می‌شود)
│         │   └── خیر → standard zen-for
│         ├── آیا custom directive می‌سازید؟
│         │   ├── بله → compileExpression (توصیه می‌شود)
│         │   └── خیر → evaluateExpression (همچنان کار می‌کند)
│         ├── آیا vite استفاده می‌کنید؟
│         │   ├── بله → compile: { enabled: true } (توصیه می‌شود)
│         │   └── خیر → runtime walker
│         └── آیا Resource دارید؟
│             ├── بله → destroy() در unmount (توصیه می‌شود)
│             └── خیر → بدون اقدام
└── خیر (development) → پیش‌فرض‌ها کافی است
```

---

## ۱. DevTools: چه زمانی disable کنیم؟

### توضیح

DevTools Hook (`window.__ZENITH__`) در `Zen.start` به‌صورت پیش‌فرض نصب می‌شود. این hook به افزونه Chrome اجازه می‌دهد signal ها، effect ها، و directive ها را مانیتور کند. اما برای هر directive، `__trackDirective` صدا زده می‌شود که با LRU eviction (MAX_NODES_PER_TYPE=500) می‌تواند در صفحات بزرگ کند شود.

### چه زمانی `devtools: false` استفاده کنیم

| سناریو | توصیه | دلیل |
|---------|--------|------|
| **Production** | ✅ `devtools: false` | DevTools مفیدی ندارد (افزونه نصب نیست) |
| **Benchmark** | ✅ `devtools: false` | اندازه‌گیری REAL runtime |
| **صفحات بزرگ** (۱۰۰۰+ عنصر) | ✅ `devtools: false` | LRU eviction overhead |
| **Development** | ❌ `devtools: true` (پیش‌فرض) | DevTools مفید است |
| **Debugging** | ❌ `devtools: true` | نیاز به DevTools |
| **صفحات کوچک** (< ۱۰۰ عنصر) | 🟡 اختیاری | overhead کم |

### مثال

```typescript
// Production
Zen.start(root, state, { devtools: false });

// Development (پیش‌فرض)
Zen.start(root, state);
// یا صریح:
Zen.start(root, state, { devtools: true });
```

### Benchmark

| سناریو | `devtools: true` | `devtools: false` | بهبود |
|---------|------------------|-------------------|-------|
| zen-text ۱۰k mount | ۱۳٬۹۲۴ms | ۱۱۶ms | **۱۲۰x** |
| zen-bind ۱۰k mount | ۱۷٬۲۸۳ms | ۱۰۲.۸ms | **۱۶۸x** |
| zen-for ۱۰k init | ۸٬۱۷۳ms | ۱۶۶ms | **۴۹x** |

### کد نمونه

```typescript
// تشخیص production از development
const isProduction = process.env.NODE_ENV === 'production';

Zen.start(root, state, {
  devtools: !isProduction, // true در dev، false در prod
});
```

---

## ۲. zen-static: چه زمانی استفاده کنیم؟

### توضیح

`zen-static` یک attribute برای `zen-for` است که fast path را فعال می‌کند:
- per-item `signal(item)` + `signal(i)` ساخته نمی‌شود.
- `createStaticLoopContext` (مقادیر مستقیم) به جای `createLoopContext` (getter + signalsMap).
- در تغییر لیست: full re-render به جای keyed diffing.

### چه زمانی `zen-static` استفاده کنیم

| سناریو | توصیه | دلیل |
|---------|--------|------|
| **منوی ایستا** | ✅ `zen-static` | read-only، ۱۰۰+ آیتم |
| **جدول read-only** | ✅ `zen-static` | read-only، ۱۰۰۰+ آیتم |
| **نتایج جستجوی static** | ✅ `zen-static` | read-only |
| **فرم با zen-model** | ❌ standard | zen-static با zen-model کار نمی‌کند |
| **chat (تغییر مکرر)** | ❌ standard | full re-render کندتر از keyed diffing |
| **live data feed** | ❌ standard | تغییرات مکرر |
| **لیست با animation** | ❌ standard | enter/leave transition |

### مثال

```html
<!-- ✅ منوی ایستا — zen-static مناسب است -->
<nav>
  <li zen-for="item in $menuItems" zen-key="item.id" zen-static="">
    <a zen-text="item.label" zen-link="item.path"></a>
  </li>
</nav>

<!-- ❌ فرم با zen-model — zen-static استفاده نکنید -->
<form>
  <li zen-for="user in $users" zen-key="user.id">
    <input zen-model="user.name">
  </li>
</form>

<!-- ✅ جدول read-only — zen-static مناسب است -->
<table>
  <tr zen-for="row in $rows" zen-key="row.id" zen-static="">
    <td zen-text="row.name"></td>
    <td zen-text="row.value"></td>
  </tr>
</table>
```

### Benchmark

| Benchmark | Standard | zen-static | Speedup |
|-----------|----------|------------|---------|
| ۱k items init | ۱۹ms | ۱۰ms | **۱.۹x** |
| ۱۰k items init | ۱۶۶ms | ۱۲۵ms | **۱.۳x** |

### Caveats

- **zen-model پشتیبانی نمی‌شود**: اگر inside zen-for از zen-model استفاده می‌کنید، `zen-static` اضافه نکنید.
- **Full re-render**: در تغییر لیست، همه‌ی آیتم‌ها dispose + rebuild می‌شوند. برای لیست‌های با تغییرات مکرر، این کندتر از keyed diffing است.
- **Reactivity**: تغییرات in-place روی item fields re-trigger نمی‌کنند. فقط list replacement re-render رخ می‌دهد.

---

## ۳. compileExpression: چه زمانی استفاده کنیم؟

### توضیح

`compileExpression` یک Expression را **یک‌بار** parse می‌کند و یک closure برمی‌گرداند. در هر re-runِ effect، فقط `evaluate(ast, ctx)` اجرا می‌شود — صفر Map operation.

### چه زمانی `compileExpression` استفاده کنیم

| سناریو | توصیه | دلیل |
|---------|--------|------|
| **Directive processor** | ✅ `compileExpression` | Hot Path — effect هزاران بار re-run |
| **Custom directive** | ✅ `compileExpression` | Hot Path |
| **یک‌بار evaluation** | 🟡 `evaluateExpression` | تفاوت ناچیز |
| **Expression داینامیک** | 🟡 `evaluateExpression` | اگر expr هر بار متفاوت است |

### مثال

```typescript
import { compileExpression } from '@zenith/expressions';
import { effect } from '@zenith/state';

// ✅ compileExpression — برای Hot Path
function processMyDirective(el, expr, context) {
  const evalFn = compileExpression(expr); // یک‌بار parse

  const dispose = effect(() => {
    // در هر re-run، فقط evaluate — صفر Map operation.
    const value = evalFn(context);
    el.textContent = String(value);
  });

  return dispose;
}

// 🟡 evaluateExpression — برای استفاده‌ی نادر
import { evaluateExpression } from '@zenith/expressions';

const result = evaluateExpression('$user.name', context); // هر بار compile
```

### چه زمانی فرقی نمی‌کند

اگر Expression فقط **یک‌بار** evaluate می‌شود (نه داخل effect)، تفاوت performance ناچیز است. `evaluateExpression` ساده‌تر است.

### Caveats

- **Cache sharing**: closure با سایر closure های همان expression، AST یکسانی به اشتراک می‌گذارند.
- **LRU eviction**: اگر cache پر شود (۵۰۰ entry)، expression های قدیمی evict می‌شوند. اما closure های evicted شده هنوز کار می‌کنند.

---

## ۴. Compiler: چه زمانی فعال کنیم؟

### توضیح

Compiler (vite-plugin) در build time، HTML را به JavaScript compile می‌کند. این کار walker را در runtime حذف می‌کند و effect ها را inline می‌سازد.

### چه زمانی Compiler فعال کنیم

| سناریو | توصیه | دلیل |
|---------|--------|------|
| **Production build با Vite** | ✅ `compile: { enabled: true }` | حذف walker overhead |
| **Development** | ❌ `compile: false` (پیش‌فرض) | HMR سریع‌تر |
| **بدون Vite** | ❌ نه ممکن | Compiler نیاز به Vite دارد |

### مثال

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { zenithPlugin } from '@zenith/vite-plugin';

export default defineConfig({
  plugins: [
    zenithPlugin({
      compile: {
        enabled: true, // فعال‌سازی compiler در production build
        strict: true,  // خطاهای warning به error تبدیل شوند
      },
    }),
  ],
});
```

### Benchmark

| Benchmark | Runtime Walker | Compiled | بهبود |
|-----------|---------------|----------|-------|
| initial render | ۱۰۰% | ~۵۰-۷۰% | **۱.۴x-۲x** |
| bundle size | ۱۰۰% | ~۹۰% | **۱۰٪ کمتر** |

### Caveats

- **Development**: در dev، compiler غیرفعال است (HMR سریع‌تر).
- **HMR**: اگر HTML تغییر کند، HMR کار می‌کند.
- **Runtime directives**: directive هایی که قابل compile نیستند (zen-action, zen-fetch, zen-resource) روی element حفظ می‌شوند و runtime walker آن‌ها را پردازش می‌کند.
- **v1.0.0 Level 3**: compiled module از `walkAndBind` به جای `Zen.start` per-element استفاده می‌کند (رفع duplicate Event Delegation).

---

## ۵. Resource.destroy: چه زمانی صدا بزنیم؟

### توضیح

`Resource.destroy()` یک Resource را به‌طور کامل tear down می‌کند: timer، AbortController، mutation queue، registry removal.

### چه زمانی `destroy()` صدا بزنیم

| سناریو | توصیه | دلیل |
|---------|--------|------|
| **SPA route change** | ✅ `destroy()` | جلوگیری از memory leak |
| **React unmount** | ✅ `destroy()` | جلوگیری از memory leak |
| **Vue beforeUnmount** | ✅ `destroy()` | جلوگیری از memory leak |
| **modal close** | ✅ `destroy()` | اگر Resource مخصوص modal است |
| **logout** | ✅ `destroy()` | پاکسازی داده‌های حساس |
| **app shutdown** | 🟡 اختیاری | browser در هر حال memory را پاک می‌کند |

### مثال

```typescript
// React
import { useEffect } from 'react';
import { createResource } from '@zenith/resource';

function UserList() {
  useEffect(() => {
    const users = createResource('users', { url: '/api/users' });
    users.list();
    return () => users.destroy(); // cleanup
  }, []);
}

// Vue 3
import { onUnmounted } from 'vue';
import { createResource } from '@zenith/resource';

const users = createResource('users', { url: '/api/users' });
users.list();
onUnmounted(() => users.destroy());

// Vanilla JS
const users = createResource('users', { url: '/api/users' });
users.list();
// هنگام cleanup:
users.destroy();
```

### چه زمانی `destroy()` صدا نزنیم

- اگر Resource سراسری است و تا آخر app زندگی می‌کند (مثلاً auth state).
- اگر فقط `reset()` می‌خواهید (state پاک شود اما Resource قابل استفاده بماند).

---

## ۶. Property Diffing: چگونه کار می‌کند؟

### توضیح

در v1.0.0، directive های `zen-bind`, `zen-show`, `zen-html`, `zen-html-trusted`, `zen-model` از property diffing استفاده می‌کنند. اگر مقدار Expression با قبلی `===` برابر باشد، DOM mutation skip می‌شود.

### اتوماتیک است

هیچ کاری لازم نیست. این بهینه‌سازی به‌طور خودکار فعال است.

### Benchmark

| Benchmark | v0.6.3 | v1.0.0 | بهبود |
|-----------|--------|--------|-------|
| zen-bind ۱۰k update | ۶۶۲k ops/sec | ۱.۳۵M ops/sec | **۲x** |

### چه زمانی بهینه‌سازی نمی‌کند

اگر در هر effect run یک **object جدید** می‌سازید، diffing کار نمی‌کند:

```typescript
// ❌ diffing کار نمی‌کند — هر بار object جدید
const sig = signal({ active: true });
effect(() => {
  sig.set({ active: Math.random() > 0.5 }); // reference متفاوت
});

// ✅ diffing کار می‌کند — فقط وقتی واقعاً تغییر کند
const sig = signal('hello');
effect(() => {
  if (shouldUpdate) {
    sig.set('world'); // فقط وقتی باید تغییر کند
  }
});
```

---

## ۷. DocumentFragment Batching

### توضیح

در v1.0.0، `zen-for` در initial mount (هم standard و هم static) از DocumentFragment batching استفاده می‌کند. همه‌ی نودهای جدید در یک fragment جمع می‌شوند و یک‌بار insert می‌شوند.

### اتوماتیک است

هیچ کاری لازم نیست. این بهینه‌سازی به‌طور خودکار فعال است.

### نحوه کار

```typescript
// قبل از v1.0.0:
for (let i = 0; i < 10000; i++) {
  parent.insertBefore(node[i], placeholder.nextSibling); // 10000 reflow!
}

// v1.0.0:
const frag = document.createDocumentFragment();
for (let i = 0; i < 10000; i++) {
  frag.appendChild(node[i]); // no reflow (fragment در DOM نیست)
}
parent.insertBefore(frag, placeholder.nextSibling); // 1 reflow!
```

### Caveats

- فقط در **initial mount**. در updates، keyed diffing استفاده می‌شود.
- Transition support preserved: در batch mode، enter transitions بعد از batch insert اجرا می‌شوند.

---

## Benchmark Results

### Chrome Headless (DevTools OFF)

| Benchmark | v0.6.3 | v1.0.0 | بهبود |
|-----------|--------|--------|-------|
| zen-text ۱۰k mount | ۷۱۸ el/sec | ۸۶k el/sec | **۱۲۰x** |
| zen-bind ۱۰k mount | ۵۷۹ el/sec | ۹۷k el/sec | **۱۶۸x** |
| zen-for ۱۰k init | ۱٬۲۲۴ items/sec | ۶۰k items/sec | **۴۹x** |
| zen-bind ۱۰k update | ۶۶۲k ops/sec | ۱.۳۵M ops/sec | **۲x** |
| zen-for zen-static ۱k init | — | ۱۰۱k items/sec | **۱.۹x vs standard** |
| signal.get() | ۶۳M ops/sec | ۱۰۵M ops/sec | **۱.۷x** |
| Memory (per signal) | ۱۷۴ bytes | ۱۷۳ bytes | — |

### مقایسه با سایر فریم‌ورک‌ها

| Benchmark | Zenith v1.0.0 | Vue 3 (est.) | Solid (est.) | Svelte 5 (est.) |
|-----------|---------------|-------------|-------------|-----------------|
| zen-text mount (۱۰k) | **۸۶k el/sec** | ~۵-۱۰k | ~۱۰-۲۰k | ~۵-۱۵k |
| zen-text update (۱۰k) | **۵۶۲k ops/sec** | ~۲۰۰-۴۰۰k | ~۵۰۰-۱۰۰0k | ~۳۰۰-۶۰۰k |
| zen-if toggle (۱۰k) | **۶۹۹k-۱.۵M** | ~۲۰۰-۵۰۰k | ~۵۰۰-۱۰۰0k | ~۳۰۰-۸۰۰k |
| zen-for ۱۰k init | **۶۰k items/sec** | ~۵-۲۰k | ~۱۰-۵۰k | ~۵-۳۰k |

---

## Production Checklist

### الزامی

- [ ] `Zen.start(root, state, { devtools: false })` در production
- [ ] `Resource.destroy()` در unmount/cleanup
- [ ] `process.env.NODE_ENV === 'production'` تنظیم شده

### توصیه می‌شود

- [ ] `zen-static` برای read-only lists
- [ ] `compileExpression` در custom directives
- [ ] `compile: { enabled: true }` در vite-plugin
- [ ] SSR با `AsyncLocalStorage` (اتوماتیک در v1.0.0)

### اختیاری

- [ ] Benchmark با `bench-browser.html` (با `devtools: false`)
- [ ] Memory profiling
- [ ] Bundle size analysis

---

##seealso

- [API Reference v1.0.0](./api-v1.0.md)
- [Migration Guide](./migration-guide.md)
- [Benchmark Results](../BENCHMARKS.md)
- [Security Audit Report](../../tests/v1.0/security-audit/README.md)
