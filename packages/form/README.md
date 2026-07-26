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
    remember: false
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
    }
  },
  onSubmit: async (values) => {
    await api.login(values);
    window.location.href = '/dashboard';
  }
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
    interests: []
  },
  schema: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    address: z.string().min(10),
    city: z.string(),
    interests: z.array(z.string())
  }),
  steps: [
    { id: 'account', title: 'اطلاعات حساب', fields: ['name', 'email', 'password'] },
    { id: 'address', title: 'آدرس', fields: ['address', 'city'] },
    { id: 'preferences', title: 'علایق', fields: ['interests'] }
  ],
  onSubmit: async (values) => {
    await api.register(values);
  }
});
```

### Field Arrays

```typescript
const orderForm = createForm({
  initialValues: {
    customer: '',
    items: [{ name: '', quantity: 1, price: 0 }]
  },
  autoSave: {
    enabled: true,
    interval: 3000,
    handler: async (values) => {
      await api.saveDraft(values);
    }
  }
});

const items = orderForm.array('items');
items.push({ name: '', quantity: 1, price: 0 });
items.remove(0);
```

## API Reference

- `createForm(options)` — Create a reactive form
- `createWizardForm(options)` — Create a multi-step wizard form
- `FormStore` — Class-based form with fields, validation, and submit
