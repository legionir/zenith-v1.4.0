# @zenith/events

> Phase 4 — Event Delegation & Modifiers

پکیج `@zenith/events` **Event Delegation** را در سطح `document` پیاده‌سازی می‌کند.
به‌جای ثبت یک Event Listener برای هر دکمه/اینپوت، فقط **یک Listener برای هر نوع
رویداد** (`click`, `input`, `change`, `submit`, `keydown`, `keyup`) ثبت می‌شود.

## ایده‌ی Event Delegation

```
传统: N button → N listeners (O(N) memory)
Zenith: 1 listener per event type on document (O(1) memory)
```

وقتی کلیکی رخ می‌دهد:
1. `event.target` را می‌گیریم.
2. با `target.closest('[zen-action],[zen-action\\:click]')` اولین عنصر منطبق را پیدا می‌کنیم.
3. با `findBinding` نام اکشن و modifier ها را استخراج می‌کنیم.
4. شرط‌های کیبورد را بررسی می‌کنیم.
5. رفتارهای پیش‌فرض (`prevent`, `stop`) را اعمال می‌کنیم.
6. اکشن را از `@zenith/actions` می‌گیریم و اجرا می‌کنیم.

## Modifier ها

پشتیبانی از پسوندها در HTML:

```html
<!-- رفتار -->
<button zen-action:click.prevent="save">       <!-- preventDefault -->
<button zen-action:click.stop="save">          <!-- stopPropagation -->
<button zen-action:click.immediate="save">     <!-- stopImmediatePropagation -->

<!-- کلیدها (فقط رویدادهای keydown / keyup) -->
<input zen-action:keydown.enter="submit">
<input zen-action:keydown.escape="cancel">
<input zen-action:keydown.tab="next">
<input zen-action:keydown.space="play">
<input zen-action:keydown.backspace="delete">
<input zen-action:keydown.del="delete">
<input zen-action:keydown.up="selectPrev">
<input zen-action:keydown.down="selectNext">
<input zen-action:keydown.left="prev">
<input zen-action:keydown.right="next">

<!-- ترکیبی -->
<input zen-action:keydown.enter.shift="submitAll">
<input zen-action:keydown.ctrl.s="save">
```

## API

```typescript
import {
  initEventDelegation,
  parseBinding,
  checkKeyboardModifiers,
  applyBehaviorModifiers,
  DELEGATED_EVENTS,
} from '@zenith/events';

// شروع Event Delegation
const teardown = initEventDelegation(state);

// بعداً (مثلاً در Zen.stop)
teardown();
```

### `parseBinding(raw: string)`

```typescript
parseBinding('click')             → { eventName: 'click',   modifiers: [] }
parseBinding('click.prevent')     → { eventName: 'click',   modifiers: ['prevent'] }
parseBinding('keydown.enter')     → { eventName: 'keydown', modifiers: ['enter'] }
parseBinding('keydown.shift.enter') → { eventName: 'keydown', modifiers: ['shift', 'enter'] }
```

### `initEventDelegation(state)`

یک تابع teardown برمی‌گرداند که تمام Listenerهای روی `document` را حذف می‌کند.

```typescript
const teardown = initEventDelegation(state);
// ...
teardown();  // حذف همه‌ی Listenerها
```

## Design Notes

- **چرا `closest` به‌جای بررسی فقط `event.target`؟**
  چون ممکن است روی یک `<span>` داخل `<button>` کلیک شود. `closest` به سمت بالا
  می‌رود تا اولین عنصر با `zen-action` را پیدا کند.
- **چرا attribute تکرار می‌کنیم به‌جای `getAttribute`؟**
  چون نام attribute می‌تواند `zen-action:keydown.enter` باشد و ما نمی‌دانیم
  دقیقاً کدام پسوندها را دارد. باید روی `el.attributes` بچرخیم.
- **چرا `try/catch` در اجرای Action؟**
  تا خطای یک Action کل Event Delegation را متوقف نکند. بقیه‌ی رویدادها باید
  همچنان کار کنند.
- **چرا `useCapture: false`؟**
  چون رویدادهای پشتیبانی‌شده (click, input, …) همگی bubble می‌شوند. در آینده
  اگر `focus` / `blur` اضافه شد، باید `useCapture: true` برای آن‌ها تنظیم شود.
