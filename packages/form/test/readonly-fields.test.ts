import { expect, it } from 'vitest';
import { createRoot } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { createForm } from '../src';
it('uses real readonly computed views and routes writes through the form owner', () => {
  createRoot(dispose => {
    const form = createForm({ initialValues: { name: 'One' }, validateOnChange: false, validateOnBlur: false }), field = form.field('name');
    try {
      expect(field.value.peek()).toBe('One'); expect(Reflect.get(field.value, 'set')).toBeUndefined(); expect(Reflect.get(field.error, 'update')).toBeUndefined();
      form.setFieldValue('name', 'Two'); form.setFieldError('name', 'required'); form.setFieldTouched('name'); flushSync();
      expect(field.value.get()).toBe('Two'); expect(field.error.get()).toBe('required'); expect(field.touched.get()).toBe(true); expect(field.dirty.get()).toBe(true);
    } finally { dispose(); }
  });
});
it('preserves nested caller-declared payloads without pretending computed views are writable Signals', () => {
  createRoot(dispose => {
    const form = createForm({ initialValues: { profile: { name: 'One' } } }), nested = form.nested<string>('profile.name');
    try {
      expect(nested.value.peek()).toBe('One'); expect(Reflect.get(nested.value, 'set')).toBeUndefined();
      form.setFieldValue('profile', { name: 'Two' }); flushSync(); expect(nested.value.get()).toBe('Two');
    } finally { dispose(); }
  });
});
it('keeps array operations writable through their owner while items and length remain readonly', () => {
  createRoot(dispose => {
    const form = createForm({ initialValues: { rows: ['one'] } }), rows = form.array<string>('rows');
    try {
      expect(rows.items.peek()).toEqual(['one']); expect(rows.length.peek()).toBe(1); expect(Reflect.get(rows.items, 'update')).toBeUndefined();
      rows.push('two'); flushSync(); expect(rows.items.get()).toEqual(['one', 'two']); expect(rows.length.get()).toBe(2);
      rows.remove(0); flushSync(); expect(rows.items.get()).toEqual(['two']); rows.clear(); flushSync(); expect(rows.length.get()).toBe(0);
    } finally { dispose(); }
  });
});
