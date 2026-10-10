# @zenith/transition

سیستم انیمیشن enter/leave (فاز ۱۱) — hook کلاس CSS برای `zen-if` و `zen-for`، به‌علاوهٔ API دست‌کاری `zenAnimate` با presetها.

## نصب

```bash
npm install @zenith/transition
```

## استفاده

```typescript
import { createTransition, zenAnimate, ANIMATE_PRESETS } from '@zenith/transition';

// API مبنا (#47): enter/leave با کنترلر قابل‌استفادهٔ مجدد
const fade = createTransition('fade', { duration: 300 });
await fade.enter(el).finished; // fade.leave(el) برای خروج؛ fade.dispose() پاک‌سازی

await zenAnimate(el, ANIMATE_PRESETS.fadeIn, { duration: 250 });
```

> `enterTransition` / `leaveTransition` / `animateGroup` در این نسخه فقط wrapper روی
> `createTransition` هستند و در محیط dev یک‌بار هشدار `ZEN-DEPR-002/003/004` می‌دهند؛
> حذف در major بعدی (#47، سیاست #58). `zenAnimate`/`zen-animate` (Web Animations API)
> مسیر مجزای keyframes جاوااسکریپتی است و منسوخ نشده.

```html
<div zen-if="$visible" zen-transition="fade">...</div>
```

> احترام به `prefers-reduced-motion` و transition مسیر روت در issue #133 دنبال می‌شود.

مشخصات کامل: [docs/packages/transition.md](../../docs/packages/transition.md)

## مستندات مرتبط

- [ARCHITECTURE.md §۳](../../ARCHITECTURE.md)
- [README ریشه](../../README.md)

## مجوز

MIT
