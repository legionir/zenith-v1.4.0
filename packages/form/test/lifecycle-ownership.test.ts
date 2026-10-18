import { afterEach, expect, it, vi } from 'vitest';
import { createRoot, getOwner, setOwner, setSignalObserver } from '@zenith/state';
import { clearScheduler, flushSync } from '@zenith/scheduler';
import { createAdvancedForm, createWizardForm, FormStore, defineAsyncRule, clearCustomRules } from '../src';

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
afterEach(() => { clearScheduler(); clearCustomRules(); vi.useRealTimers(); setOwner(null); });

it('binds fields created later to the form, not the temporary caller root', () => {
  const owned = createRoot(dispose => ({ form: createAdvancedForm({ initialValues: { name: 'one', profile: { age: 1 }, rows: [1] }, validateOnChange: false }), dispose }));
  const views = createRoot(dispose => {
    const caller = getOwner();
    const field = owned.form.field('name'), nested = owned.form.nested<number>('profile.age'), array = owned.form.array<number>('rows');
    field.value.get(); nested.value.get(); array.items.get(); array.length.get();
    expect(getOwner()).toBe(caller); dispose();
    return { field, nested, array };
  });
  try {
    owned.form.setFieldValue('name', 'two'); owned.form.setFieldValue('profile', { age: 2 }); views.array.push(2); flushSync();
    expect(views.field.value.get()).toBe('two'); expect(views.nested.value.get()).toBe(2); expect(views.array.length.get()).toBe(2);
    expect(owned.form.values.subscriberCount).toBe(4);
    owned.dispose(); expect(owned.form.values.subscriberCount).toBe(0);
    expect(views.field.value.get()).toBe('two');
    owned.form.setFieldValue('name', 'ignored'); expect(owned.form.values.peek().name).toBe('two');
    expect(() => owned.form.field('name')).toThrow(/disposed/i);
  } finally { owned.dispose(); }
});

it('explicit dispose cancels timers even without an outer root', async () => {
  vi.useFakeTimers();
  const save = vi.fn();
  const form = createAdvancedForm({ initialValues: { name: 'one' }, autoSave: { enabled: true, interval: 20, handler: save } });
  form.dispose(); form.dispose(); await vi.advanceTimersByTimeAsync(30);
  expect(save).not.toHaveBeenCalled(); expect(form.values.subscriberCount).toBe(0);
});

it('ignores a rejected autosave after reset, replacement or disposal', async () => {
  vi.useFakeTimers();
  const first = deferred<void>(), save = vi.fn(() => first.promise);
  const form = createAdvancedForm({ initialValues: { name: 'one' }, autoSave: { enabled: true, interval: 20, handler: save } });
  try {
    await vi.advanceTimersByTimeAsync(20); expect(save).toHaveBeenCalledTimes(1);
    form.reset(); first.reject(new Error('old save')); await Promise.resolve(); await Promise.resolve();
    expect(form.formError.peek()).toBeNull();
    form.dispose(); await vi.advanceTimersByTimeAsync(40); expect(save).toHaveBeenCalledTimes(1);
  } finally { form.dispose(); }
});

it('only commits the latest field validation, preserving each requested promise result', async () => {
  const older = deferred<boolean | string>(), newer = deferred<boolean | string>();
  let calls = 0;
  const form = createAdvancedForm({ initialValues: { name: 'one' }, validateOnChange: false, validate: { name: () => (++calls === 1 ? older.promise : newer.promise) } });
  try {
    const first = form.validateField('name'), second = form.validateField('name');
    newer.resolve(true); expect(await second).toBeNull();
    older.resolve('obsolete'); expect(await first).toBe('obsolete'); expect(form.errors.peek().name).toBeNull();
  } finally { form.dispose(); }
});

it('does not commit validation failures after edits, reset or owner disposal', async () => {
  const pending = deferred<boolean | string>();
  const owned = createRoot(dispose => ({ form: createAdvancedForm({ initialValues: { name: 'one' }, validateOnChange: false, validate: { name: () => pending.promise } }), dispose }));
  const work = owned.form.validateField('name');
  owned.form.setFieldValue('name', 'two'); owned.form.reset(); owned.dispose();
  pending.resolve('obsolete'); await work;
  expect(owned.form.errors.peek()).toEqual({}); expect(owned.form.validating.peek()).toBe(false);
});

it('clears the latest validating flag on rejection without allowing an older finally to clear a newer run', async () => {
  const old = deferred<boolean | string>(), latest = deferred<boolean | string>(); let calls = 0;
  const form = createAdvancedForm({ initialValues: { name: 'one' }, validate: { name: () => (++calls === 1 ? old.promise : latest.promise) } });
  try {
    const first = form.validate(), second = form.validate();
    old.resolve(true); expect(await first).toBe(false); expect(form.validating.peek()).toBe(true);
    latest.reject(new Error('validator')); await expect(second).rejects.toThrow('validator'); expect(form.validating.peek()).toBe(false);
  } finally { form.dispose(); }
});

it('consumes background validator rejection and reports it only to the live form', async () => {
  const pending = deferred<boolean | string>();
  const form = createAdvancedForm({ initialValues: { name: 'one' }, validate: { name: () => pending.promise } });
  try {
    form.setFieldValue('name', 'two'); pending.reject(new Error('offline'));
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(form.formError.peek()).toBe('offline');
  } finally { form.dispose(); }
});

it('does not invoke submission after validation goes stale, or mutate reset state after a late submit failure', async () => {
  const validation = deferred<boolean | string>(), submitted = deferred<void>();
  const handler = vi.fn(() => submitted.promise);
  const form = createAdvancedForm({ initialValues: { name: 'one' }, validateOnChange: false, validate: { name: () => validation.promise }, onSubmit: handler });
  try {
    const obsolete = form.submit(); form.setFieldValue('name', 'two'); validation.resolve(true); await obsolete;
    expect(handler).not.toHaveBeenCalled();
    const current = form.submit();
    // Resolve the already-settled validation through its async coordinator.
    for (let i = 0; i < 8; i++) await Promise.resolve();
    expect(handler).toHaveBeenCalledTimes(1); expect(form.submitting.peek()).toBe(true);
    form.reset(); submitted.reject(new Error('obsolete submit'));
    await expect(current).rejects.toThrow('obsolete submit'); expect(form.formError.peek()).toBeNull(); expect(form.submitting.peek()).toBe(false);
  } finally { form.dispose(); }
});

it('prevents stale wizard advancement and resets navigation as one owned operation', async () => {
  const validation = deferred<boolean | string>();
  const form = createWizardForm({ initialValues: { name: 'one' }, validateOnChange: false, validate: { name: () => validation.promise }, steps: [{ id: 'one', title: 'One', fields: ['name'] }, { id: 'two', title: 'Two', fields: [] }] });
  try {
    const next = form.next(); form.reset(); validation.resolve(true); await next;
    expect(form.currentStep.peek()).toBe(0); expect(form.isStepComplete(0)).toBe(false);
    await form.next(); expect(form.currentStep.peek()).toBe(1); expect(form.isStepComplete(0)).toBe(true);
    form.reset(); expect(form.currentStep.peek()).toBe(0); expect(Reflect.get(form, 'completedSteps')).toBeUndefined();
    form.dispose(); form.goToStep(1); expect(form.currentStep.peek()).toBe(0);
  } finally { form.dispose(); }
});

it('honors a wizard step validator and owns its pending continuation', async () => {
  const step = deferred<boolean>(), validate = vi.fn(() => step.promise);
  const form = createWizardForm({ initialValues: { name: 'one' }, steps: [{ id: 'one', title: 'One', fields: [], validate }, { id: 'two', title: 'Two', fields: [] }] });
  const next = form.next(); await Promise.resolve(); expect(validate).toHaveBeenCalledTimes(1);
  form.dispose(); step.resolve(true); await next;
  expect(form.currentStep.peek()).toBe(0); expect(form.canGoNext.subscriberCount).toBe(0);
});

it('moves actual undefined array payloads rather than mistaking them for missing entries', () => {
  const form = createAdvancedForm({ initialValues: { rows: [undefined, 'two'] } });
  try { form.array<string | undefined>('rows').move(0, 1); expect(form.values.peek().rows).toEqual(['two', undefined]); }
  finally { form.dispose(); }
});

it('keeps independent FormStore field validation alive concurrently and derives the shared busy flag', async () => {
  const a = deferred<{ valid: boolean; error: string | null }>(), b = deferred<{ valid: boolean; error: string | null }>();
  defineAsyncRule('ownedA', () => a.promise); defineAsyncRule('ownedB', () => b.promise);
  const form = new FormStore({ a: { initial: 1, rules: 'ownedA' }, b: { initial: 2, rules: 'ownedB' } });
  try {
    const first = form._validateFieldAsync('a'), second = form._validateFieldAsync('b');
    a.resolve({ valid: false, error: 'a invalid' }); await first;
    expect(form.signal.peek().validating).toBe(true); expect(form.signal.peek().fields.a?.validating).toBe(false);
    b.resolve({ valid: true, error: null }); await second;
    expect(form.signal.peek().validating).toBe(false); expect(form.signal.peek().fields.a?.validation.error).toBe('a invalid'); expect(form.isValid()).toBe(false);
  } finally { form.dispose(); }
});

it('owns FormStore teardown through the actual caller and suppresses late whole-form results', async () => {
  const work = deferred<{ valid: boolean; error: string | null }>(); defineAsyncRule('ownedStore', () => work.promise);
  const owned = createRoot(dispose => ({ form: new FormStore({ name: { initial: 'one', rules: 'ownedStore' } }), dispose }));
  const pending = owned.form.validateAsync(); owned.form.reset(); owned.dispose();
  const snapshot = owned.form.signal.peek(); work.resolve({ valid: false, error: 'obsolete' }); await pending;
  expect(owned.form.signal.peek()).toBe(snapshot); expect(snapshot.validating).toBe(false);
  owned.form.setValue('name', 'ignored'); expect(owned.form.getValue('name')).toBe('one');
});

it('releases FormStore timers and subscribers even if a disposal observer throws', () => {
  vi.useFakeTimers();
  const form = new FormStore({ name: { initial: 'one' } });
  form.setValue('name', 'two');
  const count = vi.getTimerCount(); expect(count).toBeGreaterThan(0);
  // A native observer is allowed to fail, not to retain the form's timer lease.
  const off = setSignalObserver({ onDispose: () => { throw new Error('observer teardown'); } });
  try {
    expect(() => form.dispose()).toThrow('observer teardown'); expect(vi.getTimerCount()).toBe(0);
    expect(form.signal.subscriberCount).toBe(0); expect(() => form.dispose()).not.toThrow();
  } finally { off(); }
});

it('retains NaN field values while completing their async validation lease', async () => {
  const result = deferred<{ valid: boolean; error: string | null }>(); defineAsyncRule('ownedNaN', () => result.promise);
  const form = new FormStore({ value: { initial: NaN, rules: 'ownedNaN' } });
  try {
    const pending = form._validateFieldAsync('value'); result.resolve({ valid: true, error: null }); await pending;
    expect(form.signal.peek().validating).toBe(false); expect(form.getValue('value')).toBeNaN();
  } finally { form.dispose(); }
});

it('does not let an older whole-form result overwrite a newer field decision', async () => {
  const older = deferred<{ valid: boolean; error: string | null }>(), latest = deferred<{ valid: boolean; error: string | null }>(); let runs = 0;
  defineAsyncRule('ownedInterleaved', () => (++runs === 1 ? older.promise : latest.promise));
  const form = new FormStore({ name: { initial: 'one', rules: 'ownedInterleaved' } });
  try {
    const all = form.validateAsync(), field = form._validateFieldAsync('name');
    latest.resolve({ valid: false, error: 'latest field' }); await field;
    older.resolve({ valid: true, error: null }); await all;
    expect(form.signal.peek().fields.name?.validation.error).toBe('latest field'); expect(form.isValid()).toBe(false); expect(form.signal.peek().validating).toBe(false);
  } finally { form.dispose(); }
});
