# Form API

APIهای مدیریت فرم، اعتبارسنجی و schema binding.

---

## `createForm()`

یک فرم واکنش‌گرا با اعتبارسنجی sync/async ایجاد می‌کند.

### Type Signature
```typescript
function createForm<T extends Record<string, any>>(
  schema: FormSchema<T>
): FormStore<T>;
```

### مثال‌ها
```typescript
import { createForm } from '@zenith/form';

const form = createForm({
  name: { value: '', validators: [required(), minLength(2)] },
  age: { value: 0, validators: [required(), min(18)] }
});

form.fields.name.set('Ali');
console.log(form.valid); // true / false
```

> مستندات کامل Form API به زودی تکمیل می‌شود.
