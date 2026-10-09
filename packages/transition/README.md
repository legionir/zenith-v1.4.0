# @zenith/transition

سیستم انیمیشن enter/leave (فاز ۱۱) — hook کلاس CSS برای `zen-if` و `zen-for`، به‌علاوهٔ API دست‌کاری `zenAnimate` با presetها.

## نصب

```bash
npm install @zenith/transition
```

## استفاده

```typescript
import { enterTransition, leaveTransition, zenAnimate, ANIMATE_PRESETS } from '@zenith/transition';

await zenAnimate(el, 'fadeIn', { duration: 250 });
```

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
