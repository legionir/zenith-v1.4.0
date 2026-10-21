// packages/codemod/src/registry.ts — رجیستری نه transform (#167)
import { destroyToDispose } from './transforms/destroy-to-dispose';
import { processToBind } from './transforms/process-to-bind';
import { clearToReset } from './transforms/clear-to-reset';
import { formUnify } from './transforms/form-unify';
import { errorClass } from './transforms/error-class';
import { consoleToLogger } from './transforms/console-to-logger';
import { cacheUnify } from './transforms/cache-unify';
import { i18nJalali } from './transforms/i18n-jalali';
import { runtimeImports } from './transforms/runtime-imports';
import type { Transform } from './transform';
import type { TransformId } from './types';

/**
 * هر نه transform جدا اجراشونده (SPEC §۴.۷)، به‌ترتیب جدول spec.
 *
 * @public
 */
export const TRANSFORMS: readonly Transform[] = [
  destroyToDispose,
  processToBind,
  clearToReset,
  formUnify,
  errorClass,
  consoleToLogger,
  cacheUnify,
  i18nJalali,
  runtimeImports,
];

/** @public یافتن transform با شناسه (ناشناس ⇒ undefined). */
export function transformById(id: TransformId): Transform | undefined {
  return TRANSFORMS.find((transform) => transform.id === id);
}
