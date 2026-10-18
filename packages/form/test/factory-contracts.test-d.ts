import { expectTypeOf } from 'vitest';
import {
  createForm, createReactiveForm, FormStore, type FormOptions, type AdvancedFormApi,
  type WizardFormApi, type ReactiveFormApi, type FormFieldDefinitions,
} from '../src';
const initial = { name: 'one', count: 1 };
const reactive = createReactiveForm({ initialValues: initial });
expectTypeOf(reactive).toEqualTypeOf<ReactiveFormApi<typeof initial>>();
expectTypeOf(reactive.values.get().count).toEqualTypeOf<number>();
// @ts-expect-error A supplied record does not become an arbitrary-field object.
reactive.values.set({ surprise: true });
const optional: FormOptions<typeof initial> = {};
const uncertain = createReactiveForm(optional);
expectTypeOf(uncertain.values.get().name).toBeUnknown();
const empty = createReactiveForm({});
expectTypeOf(empty.values.get()).toEqualTypeOf<Record<string, unknown>>();
const emptyWizard = createForm({ initialValues: initial, steps: [] });
expectTypeOf(emptyWizard).toEqualTypeOf<WizardFormApi<typeof initial>>();
const uninitializedWizard = createForm({ steps: [] });
expectTypeOf(uninitializedWizard.values.get()).toEqualTypeOf<Record<string, unknown>>();
expectTypeOf(uninitializedWizard.values.get().missing).toBeUnknown();
const uninitialized = createForm({ initialValues: undefined });
expectTypeOf(uninitialized).toEqualTypeOf<AdvancedFormApi<Record<string, unknown>>>();
const literal = createForm({ name: { initial: 'one' } });
expectTypeOf(literal).toEqualTypeOf<FormStore>();
const dynamic: FormFieldDefinitions = {};
const uncertainFactory = createForm(dynamic);
expectTypeOf(uncertainFactory).toEqualTypeOf<FormStore | AdvancedFormApi<Record<string, unknown>> | WizardFormApi<Record<string, unknown>>>();
// @ts-expect-error Dynamic names can choose legacy options routing, so narrow first.
uncertainFactory.getValues();
if (uncertainFactory instanceof FormStore) expectTypeOf(uncertainFactory.getValues()).toEqualTypeOf<Record<string, unknown>>();
// @ts-expect-error Missing initial values cannot promise a concrete wizard payload.
const fabricated: WizardFormApi<typeof initial> = createForm({ steps: [] });
void fabricated;
// @ts-expect-error A concrete typed factory cannot advertise nonexistent initial fields.
createForm<typeof initial>({ steps: [] });
