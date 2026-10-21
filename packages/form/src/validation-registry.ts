import { onGlobalReset } from '@zenith/errors';
import type { Cleanup } from '@zenith/shared';
import type { FieldValidationRule, AsyncFieldValidationRule } from './validation-types';
export const customRules = new Map<string, FieldValidationRule>();
export const asyncRules = new Map<string, AsyncFieldValidationRule>();

/** @public */
export function defineRule(name: string, fn: FieldValidationRule): Cleanup {
  customRules.set(name, fn);
  let done = false;
  return () => {
    if (done) return;
    done = true;
    // فقط اگر همان entry باشد (تا define پس از re-define گیج نشود)
    if (customRules.get(name) === fn) customRules.delete(name);
  };
}

/** ثبت یک قانون async (مثل بررسی uniqueness از سرور). * @public
 */
export function defineAsyncRule(name: string, fn: AsyncFieldValidationRule): Cleanup {
  asyncRules.set(name, fn);
  let done = false;
  return () => {
    if (done) return;
    done = true;
    if (asyncRules.get(name) === fn) asyncRules.delete(name);
  };
}

/** @public */
export function getRule(name: string): FieldValidationRule | undefined {
  return customRules.get(name);
}

/** @public */
export function hasRule(name: string): boolean {
  return customRules.has(name);
}

/** @public */
export function listRules(): string[] {
  return [...customRules.keys()];
}

/** @public */
export function unregisterRule(name: string): boolean {
  return customRules.delete(name);
}

/** @public */
export function getAsyncRule(name: string): AsyncFieldValidationRule | undefined {
  return asyncRules.get(name);
}

/** @public */
export function hasAsyncRule(name: string): boolean {
  return asyncRules.has(name);
}

/** @public */
export function listAsyncRules(): string[] {
  return [...asyncRules.keys()];
}

/** @public */
export function unregisterAsyncRule(name: string): boolean {
  return asyncRules.delete(name);
}

/** @public */
export function parseRules(rulesStr: string): Array<{ name: string; param?: string }> {
  return rulesStr
    .split(',')
    .map((r) => r.trim())
    .filter((r) => r.length > 0)
    .map((r) => {
      const [name, ...rest] = r.split(':');
      return { name: (name ?? '').trim(), param: rest.join(':') || undefined };
    });
}

/** @public */
export function clearCustomRules(): void {
  customRules.clear();
  asyncRules.clear();
}

// ============================================================
// Global reset (#118) — no cross-test leaks
// ============================================================

/* @__PURE__ */ onGlobalReset(clearCustomRules);
