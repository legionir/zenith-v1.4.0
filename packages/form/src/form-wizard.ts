import { effect, computed } from '@zenith/state';
import { createAdvancedForm } from './form-advanced';
import { createFormScope, createFormSignal, type FormScope } from './form-scope';
import type { AdvancedFormOptions, WizardStep, WizardFormApi } from './form-types';
/** @public */
export function createWizardForm<T extends Record<string, unknown>>(
  options: AdvancedFormOptions<T> & { steps: WizardStep[] },
): WizardFormApi<T> {
  const scope = createFormScope();
  try { return scope.run(() => buildWizard(options, scope)); }
  catch (error) { scope.dispose(); throw error; }
}

function buildWizard<T extends Record<string, unknown>>(options: AdvancedFormOptions<T> & { steps: WizardStep[] }, scope: FormScope): WizardFormApi<T> {
  const form = createAdvancedForm(options);
  const currentStep = createFormSignal(scope, 0);
  const steps = createFormSignal(scope, options.steps);
  const completedSteps = createFormSignal(scope, new Set<number>());
  const canGoBack = computed(() => currentStep.get() > 0);
  const canGoNext = createFormSignal(scope, false);
  let navigationRun = 0;
  effect(() => {
    const step = steps.get()[currentStep.get()];
    const errors = form.errors.get();
    canGoNext.set(!!step && step.fields.every(field => !errors[field]));
  });
  scope.onDispose(() => { navigationRun++; });

  async function next() {
    if (scope.disposed) return;
    const run = ++navigationRun, version = scope.version;
    const stepIndex = currentStep.peek(), allSteps = steps.peek();
    const step = allSteps[stepIndex], snapshot = form.values.peek();
    if (!step) return;
    const current = () => !scope.disposed && scope.version === version && run === navigationRun && currentStep.peek() === stepIndex && steps.peek() === allSteps && allSteps[stepIndex] === step && form.values.peek() === snapshot;
    const results = await Promise.all(step.fields.map(field => form.validateField(field)));
    if (!current() || !results.every(result => result === null)) return;
    if (step.validate) {
      const valid = await step.validate();
      if (!current() || !valid) return;
    }
    completedSteps.set(new Set([...completedSteps.peek(), stepIndex]));
    if (stepIndex < allSteps.length - 1) currentStep.set(stepIndex + 1);
    else await form.submit();
  }

  function previous() {
    if (scope.disposed) return;
    navigationRun++;
    if (currentStep.peek() > 0) currentStep.set(currentStep.peek() - 1);
  }
  function goToStep(index: number) {
    if (scope.disposed) return;
    navigationRun++;
    if (index >= 0 && index < steps.peek().length) currentStep.set(index);
  }
  function reset(values?: T) {
    if (scope.disposed) return;
    navigationRun++; scope.invalidate();
    form.reset(values);
    currentStep.set(0); completedSteps.set(new Set());
  }
  return {
    ...form,
    currentStep, steps, canGoNext, canGoBack,
    next, previous, goToStep,
    isStepComplete: index => completedSteps.peek().has(index),
    reset,
    dispose: () => scope.dispose(),
  };
}
