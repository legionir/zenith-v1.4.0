# `@zenith/transition`

ابزارهای transition برای ورود و خروج عناصر DOM. این پکیج برای transitionهای CSS در کنار `zen-if` و `zen-for` و برای استفادهٔ برنامه‌نویسی‌شده طراحی شده است.

> برای animationهای مبتنی بر Web Animations API و presetها از `zenAnimate` و directive `zen-animate` استفاده کنید.

## نصب

```ts
import {
  createTransition,
  enterTransition,
  leaveTransition,
} from '@zenith/transition';
```

## `createTransition`

یک کنترلر قابل‌استفادهٔ مجدد می‌سازد. کنترلر transitionهای فعال را نگه می‌دارد و با `dispose()` آن‌ها را پاکسازی می‌کند.

```ts
const fade = createTransition('fade', {
  duration: 300,
  onAfterEnter: (element) => console.log('entered', element),
  onAfterLeave: (element) => console.log('left', element),
});

const run = fade.enter(panel);
await run.finished;
```

### API کنترلر

| متد | خروجی | توضیح |
|---|---|---|
| `enter(element)` | `TransitionRun` | transition ورود را اجرا می‌کند. |
| `leave(element)` | `TransitionRun` | transition خروج را اجرا می‌کند. |
| `dispose()` | `void` | تمام transitionهای فعال این کنترلر را لغو می‌کند. بعد از dispose، اجرای جدید یک no-op است. |

`TransitionRun` دو عضو دارد:

```ts
interface TransitionRun {
  finished: Promise<void>;
  cancel(): void;
}
```

`finished` هم بعد از پایان طبیعی و هم پس از لغو resolve می‌شود؛ بنابراین هیچ `await`ای معلق نمی‌ماند.

```ts
const run = fade.leave(panel);

setTimeout(() => run.cancel(), 100);
await run.finished;
```

اگر یک transition جدید با همان کنترلر روی همان element اجرا شود، transition قبلی ابتدا لغو می‌شود.

## گزینه‌ها

```ts
interface TransitionOptions {
  duration?: number;
  classes?: TransitionClasses;
  onBeforeEnter?: (element: HTMLElement) => void;
  onAfterEnter?: (element: HTMLElement) => void;
  onBeforeLeave?: (element: HTMLElement) => void;
  onAfterLeave?: (element: HTMLElement) => void;
}

interface TransitionClasses {
  enterFrom?: string;
  enterActive?: string;
  enterTo?: string;
  leaveFrom?: string;
  leaveActive?: string;
  leaveTo?: string;
}
```

`duration` fallback پایان animation است؛ اگر `transitionend` یا `animationend` زودتر رخ دهد، transition همان زمان کامل می‌شود.

کلاس‌های پیش‌فرض:

```text
zen-enter-from
zen-enter-active
zen-enter-to
zen-leave-from
zen-leave-active
zen-leave-to
```

نامی که به `createTransition` می‌دهید نیز در زمان اجرا به element اضافه می‌شود. برای نمونه، transition با نام `fade` هم‌زمان کلاس `fade` را می‌افزاید.

### CSS پیش‌فرض

```css
.fade.zen-enter-from {
  opacity: 0;
}

.fade.zen-enter-active,
.fade.zen-leave-active {
  transition: opacity 0.3s ease;
}

.fade.zen-enter-to {
  opacity: 1;
}

.fade.zen-leave-from {
  opacity: 1;
}

.fade.zen-leave-to {
  opacity: 0;
}
```

### کلاس‌های سفارشی

```ts
const modalTransition = createTransition('modal-transition', {
  duration: 200,
  classes: {
    enterFrom: 'modal-hidden',
    enterActive: 'modal-opening',
    enterTo: 'modal-visible',
    leaveFrom: 'modal-visible',
    leaveActive: 'modal-closing',
    leaveTo: 'modal-hidden',
  },
});
```

## استفاده با directiveها

برای نمایش یا حذف reactive یک element، `zen-if` مسئول mount/unmount و `zen-transition` مسئول animation است:

```html
<div zen-if="isVisible" zen-transition="fade">
  محتوای پنل
</div>
```

```css
.fade.zen-enter-from { opacity: 0; }
.fade.zen-enter-to { opacity: 1; transition: opacity 0.3s ease; }
.fade.zen-leave-from { opacity: 1; }
.fade.zen-leave-to { opacity: 0; transition: opacity 0.3s ease; }
```

`zen-transition:name="state"` و `zen-transition-options` بخشی از API فعلی نیستند.

## API ساده و سازگار با نسخه‌های قبل

این توابع برای یک اجرای منفرد باقی مانده‌اند و یک تابع لغو برمی‌گردانند:

```ts
const cancelEnter = enterTransition(panel, 'fade', 300, () => {
  console.log('enter complete');
});

const cancelLeave = leaveTransition(panel, 'fade', 300);

cancelEnter();
cancelLeave();
```

همچنین:

```ts
isTransitioning(panel); // boolean
cancelTransition(panel); // حذف classهای transition پیش‌فرض
```

## محدودیت‌های فعلی

- `out-in` و `in-out` به هماهنگی میان دو element نیاز دارند و جزو API کنترلر تک‌element نیستند.
- `toggle(element, visible)` عمداً وجود ندارد؛ visibility و mount/unmount باید در state برنامه یا `zen-if` مدیریت شود.
- برای keyframe، delay، iteration و animationهای صرفاً WAAPI از `zenAnimate` یا `zen-animate` استفاده کنید.
