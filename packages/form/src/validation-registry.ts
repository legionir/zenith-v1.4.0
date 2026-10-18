import type { FieldValidationRule, AsyncFieldValidationRule } from './validation-types';
export const customRules = new Map<string, FieldValidationRule>();
export const asyncRules = new Map<string, AsyncFieldValidationRule>();

/** @public */
export function defineRule(name: string, fn: FieldValidationRule): void {
  customRules.set(name, fn);
}

/** ثبت یک قانون async (مثل بررسی uniqueness از سرور). * @public
 */
export function defineAsyncRule(name: string, fn: AsyncFieldValidationRule): void {
  asyncRules.set(name, fn);
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

