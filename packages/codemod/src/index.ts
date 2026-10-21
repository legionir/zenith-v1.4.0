// packages/codemod/src/index.ts — ورودی اصلی (`@zenith/codemod`)
/** @public */
export type {
  CodemodReport,
  FileResult,
  ManualItem,
  RunCodemodsOptions,
  TextResult,
  TransformId,
} from './types';
/** @public */
export { CodemodError } from './errors';
/** @public */
export { TRANSFORMS, transformById } from './registry';
/** @public */
export { transformText, runCodemods, resolveTransforms } from './runner';
/** @public */
export { isTestFile } from './transforms/clear-to-reset';
/** @public */
export { FORM_CREATORS } from './transforms/form-unify';
