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

## Modifier ها (مرجع کامل — `#136`)

شکل کلی: `zen-action:<event>.<modifier>[.<modifier>…]="actionName"`. modifierها ترتیب‌پذیر
نیستند (مجموعه‌اند)، به‌جز عدد زمان‌بندی که بعد از `debounce`/`throttle` می‌آید. مجموعهٔ رسمی در
`BUILTIN_MODIFIERS` است و **قابل override نیست**؛ modifierهای سفارشی با `registerEventModifier`.
هر modifier زیر دست‌کم یک تست واحد (jsdom) و یک تست مرورگری (Chromium/Firefox/WebKit) دارد:
`packages/events/test/modifiers-matrix.test.ts` و `e2e/events.spec.ts`.

### رفتار

| modifier     | اثر                                                                     | مثال                                            |
| ------------ | ----------------------------------------------------------------------- | ----------------------------------------------- |
| `.prevent`   | `event.preventDefault()` (روی listenerهای passive اثری ندارد، پایین‌تر) | `<a href="/x" zen-action:click.prevent="open">` |
| `.stop`      | `event.stopPropagation()` (جلوی رسیدن به عناصر بالاتر از root)          | `<button zen-action:click.stop="save">`         |
| `.immediate` | `event.stopImmediatePropagation()` (listenerهای بعدیِ همان root هم)     | `<button zen-action:click.immediate="save">`    |
| `.self`      | فقط اگر `event.target` خود عنصر باشد (نه فرزندش)                        | `<div zen-action:click.self="closeModal">`      |
| `.once`      | فقط یک‌بار؛ سپس attribute حذف و timerهای معلق پاک می‌شوند               | `<button zen-action:click.once="track">`        |

ترتیب اعمال: `self` → `prevent` → `stop` → `immediate` → modifierهای سفارشی.

### گزینه‌های listener: `.passive` و `.capture`

- **`.capture`**: اکشن در فاز capture اجرا می‌شود، یعنی **پیش از** listenerهای بومیِ فرزندان؛
  `.capture.stop` مانع رسیدن رویداد به فرزندان می‌شود. هر binding دقیقاً یک‌بار اجرا می‌شود
  (`.capture` فقط در فاز capture، بقیه فقط در bubble). نزدیک‌ترین binding هر فاز برنده است.

  ```html
  <div zen-action:click.capture.stop="audit"><button>…</button></div>
  ```

- **`.passive`**: قول می‌دهد `preventDefault()` هرگز صدا زده نشود؛ ترکیب `.passive.prevent`
  `preventDefault` را اجرا **نمی‌کند** (و یک‌بار هشدار می‌دهد) تا مرورگر خطای
  «Unable to preventDefault inside passive event listener» ندهد.
- **رویدادهای scroll-blocking** (`wheel`, `touchstart`, `touchmove`, `scroll`) روی root همیشه
  `passive: true` ثبت می‌شوند (همان پیش‌فرض پلتفرم برای document؛ اسکرول نرم و بدون
  هشدار «non-passive listener»). `.prevent` روی آن‌ها نادیده گرفته می‌شود — برای مهار اسکرول از CSS
  (`overscroll-behavior` / `touch-action`) استفاده کنید. `scroll` bubble نمی‌کند و از طریق
  listener فاز capture دیده می‌شود.

  ```html
  <div zen-action:touchmove="track"></div>
  <div zen-action:wheel.passive="onWheel"></div>
  ```

### زمان‌بندی

| modifier              | رفتار                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------- |
| `.debounce.NNN`       | پس از `NNN` میلی‌ثانیه سکوت، **یک** فراخوانی (trailing)                                       |
| `.throttle.NNN`       | فراخوانی اول فوری، میانهٔ burst حذف، **آخرین** رویداد پس از پایان بازهٔ `NNN` (leading+trailing) |

`teardown` (خروجی `initEventDelegation`) و `.once` تمام timerهای معلق را لغو (cancel) می‌کنند؛
بعد از teardown هیچ اکشن معلقی اجرا نمی‌شود.

```html
<input zen-action:input.debounce.300="search" />
<div zen-action:pointerdown.throttle.100="draw"></div>
```

### کلیدها (روی `keydown` / `keyup`)

| modifier     | مقدار `event.key`                  |
| ------------ | ---------------------------------- |
| `.enter`     | `Enter`                            |
| `.escape`    | `Escape`, `Esc`                    |
| `.tab`       | `Tab`                              |
| `.space`     | `' '`, `Space`, `Spacebar`         |
| `.backspace` | `Backspace`                        |
| `.del`       | `Delete`, `Del`                    |
| `.up`        | `ArrowUp`, `Up`                    |
| `.down`      | `ArrowDown`, `Down`                |
| `.left`      | `ArrowLeft`, `Left`                |
| `.right`     | `ArrowRight`, `Right`              |

چند کلید در یک binding **OR** هستند (`.enter.escape`). کلیدهای تغییردهنده `.shift`, `.ctrl`,
`.alt`, `.meta` باید **همه** فعال باشند (AND) و با یک کلید ترکیب می‌شوند:

```html
<input zen-action:keydown.enter="submit" />
<input zen-action:keydown.ctrl.enter="submitAll" />
<input zen-action:keydown.shift.tab="focusPrev" />
```

> `s` و حروف دیگر modifier کلید نیستند؛ `keydown.ctrl.s` ⇒ `s` نادیده گرفته می‌شود و روی هر
> `Ctrl+کلید` اجرا می‌شود. برای حروف از یک modifier سفارشی (`registerEventModifier`) استفاده کنید.

### رویدادهای delegate‌شده

`click`, `dblclick`, `contextmenu`, `input`, `change`, `submit`, `keydown`, `keyup`, `focusin`,
`focusout`, `wheel`, `pointerdown`, `pointerup`, `touchstart`, `touchmove`, `touchend`, `scroll`.

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
teardown(); // حذف همه‌ی Listenerها
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
