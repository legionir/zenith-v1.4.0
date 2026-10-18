# @zenith/devtools

> Phase 10 — DevTools Hook

پکیج `@zenith/devtools` پل ارتباطی بین فریم‌ورک Zenith و افزونه مرورگر
(Chrome Extension) است. این پکیج یک شیء سراسری روی `window.__ZENITH__`
قرار می‌دهد تا افزونه بتواند State، کامپوننت‌ها، و Timeline تغییرات را
بازرسی کند.

## استفاده

```typescript
import { initDevTools } from '@zenith/devtools';

// در زمان شروع اپلیکیشن (فقط در Development)
initDevTools();
```

سپس در console مرورگر:

```javascript
// دسترسی به Hook
const hook = window.__ZENITH__;

// نسخه‌ی فریم‌ورک
console.log(hook.version); // "1.0.0"

// لیست تمام Signal های فعال
hook.getSignals().forEach((s) => {
  console.log(`Signal #${s.id}:`, s.value, `(${s.subscriberCount} subscribers)`);
});

// Timeline تغییرات State
hook.getTimeline(50).forEach((change) => {
  console.log(`Signal #${change.signalId}: ${change.oldValue} → ${change.newValue}`);
});

// گوش دادن به تغییرات real-time
hook.onStateChange((change) => {
  console.log('State changed:', change);
});
```

## غیرفعال کردن در Production

برای غیرفعال کردن DevTools (مثلاً در production):

```typescript
// قبل از import کردن فریم‌ورک
window.__ZENITH_DEVTOOLS__ = false;
```

یا در HTML:

```html
<script>
  window.__ZENITH_DEVTOOLS__ = false;
</script>
```

## API

### `initDevTools()`

نصب Hook روی `window.__ZENITH__`. این تابع idempotent است.

### `ZenithDevtoolsHook`

شیءای که روی `window.__ZENITH__` قرار می‌گیرد:

| متد/فیلد              | توضیح                                                   |
| --------------------- | ------------------------------------------------------- |
| `version`             | نسخه‌ی فریم‌ورک                                         |
| `getSignals()`        | لیست تمام Signal های فعال                               |
| `getTimeline(limit?)` | Timeline تغییرات State                                  |
| `onStateChange(cb)`   | گوش دادن به تغییرات real-time (برمی‌گرداند unsubscribe) |
| `components`          | Map از کامپوننت‌های ثبت‌شده                             |
| `installedAt`         | زمان نصب Hook                                           |

## Design Notes

### چرا Registry در State؟

در فاز ۱۰، یک State Registry به پکیج `@zenith/state` اضافه شد که تمام
Signal های ساخته‌شده را ردیابی می‌کند. این رجیستری:

- به‌صورت خودکار هر Signal را در constructor ثبت می‌کند.
- هر `set()` را در Timeline ثبت می‌کند.
- اگر DevTools غیرفعال باشد، no-op می‌شود (بدون overhead).

### چرا `__ZENITH_DEVTOOLS__` flag؟

به‌جای `import.meta.env?.DEV` (که فقط در Vite کار می‌کند)، از یک flag
سراسری استفاده می‌کنیم که در هر محیطی کار می‌کند. این به کاربر اجازه
می‌دهد DevTools را حتی در production فعال کند (برای دیباگ) یا در development
غیرفعال کند (برای تست performance).

### Idempotent

`initDevTools` می‌تواند چندبار فراخوانی شود بدون اینکه مشکلی ایجاد کند.
این مهم است چون در HMR، `Zen.start` ممکن است چندبار فراخوانی شود.

## Browser ownership and diagnostic options (unvalidated candidate)

The browser hook owns its exact publication, subscriptions and Document/Window
listeners. Cleanup does not delete a foreign replacement or execute/replace another
subsystem's `__zenCleanupHandlers`. Retained old hooks cannot act on a new install.
Visibility uses its captured Document; pagehide drops subscriptions/data, and Vite
HMR disposal closes its captured installation. Failed setup releases owned work.
No literal zero-instruction overhead or leak-freedom certification is implied.

Canonical diagnostic calls use options:

```ts
// A framework-owned native hook advertises graphProtocolVersion === 2.
hook.addSignal('count', { name: 'count', value: 1 });
hook.addDirective('text', { directiveType: 'zen-text', elementSelector: '#count' });
hook.addStaticFor('items', { expr: '$items', itemCount: 3 });
hook.recordResourceDestroy('users', { url: '/users', stack: 'optional trace' });
recordPanelStateChange('count', { oldValue: 1, newValue: 2 });
```

Old signatures remain deprecated (101–105). Runtime still speaks the old transport
to unmarked foreign hooks; it does not assume an unknown global satisfies a typed
interface. The compatibility event adapter uses arity so options-shaped opaque old
payloads stay real old payloads. Public hook typing/marker and bounded retention are
proposed major contracts, not claims of declaration-identical compatibility.

Native SSR scopes cannot inspect/mutate/publish global graph/hook/panel data, retain
subscriptions or disable outside configuration. Explicit local `new RuntimeGraph`
is different: it remains caller-owned and usable in SSR. Caller-held values/copies
are not revoked. Explicit process reset remains global by design.

Panel readers/listeners are untracked; reset/identity/epoch guards prevent stale
registration and callback ABA. Captured signal metadata no longer retains unused
strong readable refs. Signal/effect metadata and hook static/resource/expression/
store history are bounded to 1000 entries; panel timeline retains its 500 bound.
Snapshots copy metadata, not arbitrary payload objects. Dispose markers cannot
reactivate stopped effects. Each subscription still needs its returned cleanup.

Source, metadata/type, actual browser lifecycle, walker transport and 100 real SSR
prepass/factory fixtures are authored, **unexecuted**. Native HMR behavior, actual
package consumers/size/declarations and release peer floors await final validation.
Direct Errors imports are declared; new internal State consumers require the
proposed State release. Root-public-only migration and external approvals remain
open. No publication or passing gate is claimed.
