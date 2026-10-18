import { logger } from '@zenith/logger';
import type { FormStore } from './form-store';
  /** Push یک آیتم به فیلد از نوع array. */
export function pushItem(this: FormStore, fieldName: string, item: unknown): void {
    const arr = this.getValue(fieldName);
    if (!Array.isArray(arr)) return;
    this.setValue(fieldName, [...arr, item]);
  }

  /** Remove یک آیتم از فیلد array. */
export function removeItem(this: FormStore, fieldName: string, index: number): void {
    const arr = this.getValue(fieldName);
    if (!Array.isArray(arr)) {
      logger.error(`[Zenith] removeItem: "${fieldName}" is not an array`);
      return;
    }
    // FIX (BUG-FRM-03): اعتبارسنجی index.
    if (index < 0 || index >= arr.length) {
      logger.error(
        `[Zenith] removeItem: index ${index} out of bounds for "${fieldName}" (length=${arr.length})`,
      );
      return;
    }
    this.setValue(
      fieldName,
      arr.filter((_, i) => i !== index),
    );
  }

  /** Move یک آیتم در array. */
export function moveItem(this: FormStore, fieldName: string, from: number, to: number): void {
    const value = this.getValue(fieldName);
    if (!Array.isArray(value)) {
      logger.error(`[Zenith] moveItem: "${fieldName}" is not an array`);
      return;
    }
    const arr: unknown[] = [...value];
    // FIX (BUG-FRM-03): اعتبارسنجی indexها با خطای مشخص.
    if (from < 0 || from >= arr.length || to < 0 || to >= arr.length) {
      logger.error(
        `[Zenith] moveItem: index out of bounds for "${fieldName}" (length=${arr.length}, from=${from}, to=${to})`,
      );
      return;
    }
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    this.setValue(fieldName, arr);
  }

