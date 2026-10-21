import { expectTypeOf } from 'vitest';
import { createForm, type FormFieldState, type Validator } from '../src';
expectTypeOf<FormFieldState['value']>().toBeUnknown();
expectTypeOf<Parameters<Validator>[0]>().toBeUnknown();
const form = createForm({ initialValues: { name: 'One', age: 20 }, validation: {
  name: { validate(value) { expectTypeOf(value).toEqualTypeOf<string>(); return true; } },
  age: { validate(value) { expectTypeOf(value).toEqualTypeOf<number>(); return true; } },
} });
expectTypeOf(form.field('name').value.get()).toEqualTypeOf<string>();
expectTypeOf(form.field('age').value.get()).toEqualTypeOf<number>();
expectTypeOf(form.nested('untyped.path').value.get()).toBeUnknown();
// Field writes use the form owner; computed views never implement Signal.set.
// @ts-expect-error The runtime never supplied this mutation capability.
form.field('name').value.set('unchecked');
// @ts-expect-error Readonly errors are changed through setFieldError.
form.field('name').error.update(() => null);
// @ts-expect-error Readonly array items are changed through array operations.
form.array<string>('names').items.set(['unchecked']);
expectTypeOf(form.field('name').value.peek()).toEqualTypeOf<string>();

form.setFieldValue('name', 'Two'); form.setFieldValue('age', 21);
// @ts-expect-error A known numeric field does not accept arbitrary unknown writes.
form.setFieldValue('age', 'unchecked');
// @ts-expect-error Known form state does not advertise undeclared fields.
form.setFieldValue('missing', true);

expectTypeOf(form.dispose).toEqualTypeOf<() => void>();
expectTypeOf(form.nested<{ label: string }>('profile').value.peek()).toEqualTypeOf<{ label: string }>();
expectTypeOf(form.array<{ id: number }>('rows').items.peek()).toEqualTypeOf<{ id: number }[]>();
// @ts-expect-error Caller-declared array item types do not become arbitrary writes.
form.array<{ id: number }>('rows').push({ id: 'wrong' });
