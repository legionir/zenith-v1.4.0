# @zenith/form

Advanced reactive form system for Zenith with validation, wizard steps, field arrays, and auto-save.

## Installation

```bash
npm install @zenith/form
```

## Usage

### Simple Form

```typescript
import { createForm } from '@zenith/form';

const loginForm = createForm({
  initialValues: {
    email: '',
    password: '',
    remember: false,
  },
  validate: {
    email: (value) => {
      if (!value) return 'ایمیل الزامی است';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'ایمیل نامعتبر است';
      return true;
    },
    password: (value) => {
      if (!value) return 'رمز عبور الزامی است';
      if (value.length < 8) return 'رمز عبور حداقل ۸ کاراکتر باشد';
      return true;
    },
  },
  onSubmit: async (values) => {
    await api.login(values);
    window.location.href = '/dashboard';
  },
});

// Template usage:
// <input type="email" zen-model="loginForm.values.email" />
// <span zen-if="loginForm.errors.email" zen-text="loginForm.errors.email" class="error"></span>
// <button zen-on:click="loginForm.submit" zen-bind:disabled="!loginForm.valid">ورود</button>
```

### Wizard Form

```typescript
import { createWizardForm } from '@zenith/form';
import { z } from 'zod';

const signupWizard = createWizardForm({
  initialValues: {
    name: '',
    email: '',
    password: '',
    address: '',
    city: '',
    interests: [],
  },
  schema: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    address: z.string().min(10),
    city: z.string(),
    interests: z.array(z.string()),
  }),
  steps: [
    { id: 'account', title: 'اطلاعات حساب', fields: ['name', 'email', 'password'] },
    { id: 'address', title: 'آدرس', fields: ['address', 'city'] },
    { id: 'preferences', title: 'علایق', fields: ['interests'] },
  ],
  onSubmit: async (values) => {
    await api.register(values);
  },
});
```

### Field Arrays

```typescript
const orderForm = createForm({
  initialValues: {
    customer: '',
    items: [{ name: '', quantity: 1, price: 0 }],
  },
  autoSave: {
    enabled: true,
    interval: 3000,
    handler: async (values) => {
      await api.saveDraft(values);
    },
  },
});

const items = orderForm.array('items');
items.push({ name: '', quantity: 1, price: 0 });
items.remove(0);
```

## API Reference

- `createForm(options)` — Create a reactive form
- `createWizardForm(options)` — Create a multi-step wizard form
- `FormStore` — Class-based form with fields, validation, and submit

## Lifecycle (cleanup protocol — #116 / DEC-032)

`FormStore` implements `Disposable` (`@zenith/shared`): `dispose()` releases
validators/effects; idempotent. `destroy()` is a deprecated alias (warns once
with **ZEN-DEPR-022**, removed in 2.0 per DEC-026).

## Shared-API configuration migration candidate (unvalidated)

```ts
validateField(value, { rules: 'required', allValues });
await validateFieldAsync(value, { rules: 'unique', allValues, signal });
await validateFormAsync({ values, rules, signal });
await validateWithLifecycle(values, { rules, lifecycle, async: true });
form.moveItem('rows', { from: 1, to: 0 });
form.addField({ name: 'payload', initial: { initial: 'actual data' }, rules: '' });
```

The corresponding positional forms remain deprecated bridges with once-only
`ZEN-DEPR-095` through `ZEN-DEPR-100` warnings (proposed removal in 2.0).
Canonical configuration is schema checked; positional defaults/native behavior
are kept on a separate evaluator route. Canonical movement indices must be
nonnegative integers. `addField` uses one bag so an old object-valued initial
cannot be confused with configuration. `initial: undefined` and function/object
payloads are supported without cloning or pretending to decode them.

Cross-field values, lifecycle receivers and abort objects retain identity;
canonical rule maps are validated snapshots. Callback signatures/results and
application values are still caller-declared. Async configuration failures are
Promise rejections, not synchronous throws. Internal store/reset/advanced-form
calls use canonical forms and do not emit these migration warnings.

Field/array views are readonly computed capabilities; writes go through the
form owner/array operations. A typed `nested<T>` or `array<T>` call is not runtime
payload validation. No test, declaration, bundle-size or lifecycle acceptance
result is implied by these authored changes.

For a known `T`, `setFieldValue` now requires a known string key and its `T[K]`
value (a source-contract change). Dynamic record forms remain dynamic. This is a
static contract, not runtime validation of JavaScript writes or external data.

## Captured form ownership candidate (2026-10-18; unvalidated)

Advanced forms and wizards now expose an idempotent `dispose()`. They own their
computed views, internal effects and pending autosave timers through a real State
owner, inherited from the creating scope. A standalone form must still be disposed
explicitly. Field/nested/array views requested later are created under that form,
not under the temporary root that happens to call `field()`.

After disposal, form mutation methods do nothing, whole-form validation returns
false, and new view creation throws. Previously initialized computed views keep
their last snapshot; unread disposed views cannot be initialized. Exposed native
signals are not revoked or replaced by proxies: directly mutating them does not
become validated application input or a new supported deep-mutation protocol.
Use immutable value updates through form methods for lifecycle coordination.

Field generations, value snapshots and reset/lifetime versions prevent obsolete
validator results from writing current form state. A requested field-validation
promise can still return its own obsolete result; that is not permission to commit
it. The latest whole-form run clears its busy flag in `finally`, including rejection.
Background validation failures are observed rather than left as unhandled promises.
Submission and autosave ignore late state writes after edit/reset/disposal; already
invoked user callbacks are not undone, and arbitrary user promises are not forcibly
cancelled. Explicit submit failures still reject their caller's promise.

Wizards own their child advanced form and navigation effect. Reset also resets
navigation/completion. Navigation checks its current values/step/run before
advancing, honors `WizardStep.validate`, and cannot advance a disposed wizard.

FormStore registers teardown with the actual creating State owner. Its async
coordinator keeps independent fields active concurrently, derives shared busy
state, passes cancellation to field and whole-form validators, and suppresses
obsolete results after changes/reset/removal/disposal. A later field request owns
its result over an older whole-form request. Timers/subscribers are released even
when a native disposal observer throws. Public validation promises still report
requested work (or its rejection), rather than fabricating abort success as a
current-state guarantee. Typed `undefined` array entries can be moved, and the
store's non-array movement guard checks the original value before spreading it.

Ownership, race fixes, terminal computed behavior, navigation reset and the new
`dispose` interface member are **behavior/source-contract changes**, distinct from
helper extraction. Full generic ergonomics (`Record` constraints, no-initial-value
factory typing), callback/member/export inventory and final consumer/size/runtime
validation remain open. No tests/build/CI were run for this candidate.

## Factory and opaque-value contracts (candidate; 2026-10-18)

Factory moves and the following contract changes are separate proposals, not an
API-identical extraction or evidence of a passing declaration/runtime gate:

- `createReactiveForm({ initialValues })` retains the supplied record's identity
  and its exact field type. If a typed options variable can omit initial data,
  the returned values are `T | Record<string, unknown>`, not a fictitious populated
  `T`. The small reactive API now owns its state and has `dispose()`; its async
  `startSubmit`/`endSubmit` protocol is retained. It still does **not** implement
  the advanced API's validation/autosave feature set.
- `createForm({ initialValues, steps: [] })` returns a real wizard, including for
  an empty step list. A wizard with no initial values, or an advanced form with
  explicit `initialValues: undefined`, starts with a dynamic unknown-valued record.
  Missing-initial configuration is checked through the shared schema engine;
  callback callability is checked, not callback output or application data.
- Known literal field maps without legacy routing-key collisions retain a Store
  return. For runtime/dynamic names, `createForm(fields)` has an honest union
  return. Prefer `new FormStore(fields)` when Store mode is intended, especially
  for fields named `rules`, `initialValues`, `steps`, etc. Schema adapters now use
  this unambiguous constructor path. No new mode-selection API was invented here.

```ts
const store = new FormStore(dynamicFieldDefinitions); // always a Store
const wizard = createForm({ steps: [] });             // dynamic unknown values
const reactive = createReactiveForm({ initialValues: { name: 'one' } });
// reactive.values.get().name is string; remember reactive.dispose().
```

Advanced dirty comparison no longer runs JSON serialization. Plain enumerable
record/array data is compared structurally, including cycles, bigint, undefined
and symbol keys. Functions, class/native objects and accessor-bearing objects use
identity; application getters/toJSON are not invoked by the comparison. Proxy
inspection failure or exhaustion of its 10,000-pair traversal budget conservatively
marks a distinct value dirty. This is not deep domain validation, mutation
observation or equality certification for arbitrary proxies/cross-realm objects.
Array views check actual array shape while their item type remains caller-declared;
undefined entries can be swapped, and restoring initial content can clear dirty.
Manual field errors supersede an older pending validator. Mutation bookkeeping
also avoids continuing after observer-driven reset/disposal/replacement.

The `Record` generic constraint and broader interface-shaped initial-data design
remain a separate review item. All new runtime/type/source-metadata fixtures are
written, not run; no consumer, size, API or whole-28 readiness is asserted.
