// #142 — @zenith/schema (SPEC §۲.۲): اعتبارسنجی گزینه‌ها/config با خطای
// ZEN-1xxx + تولید متادیتا برای ابزارها. استخراج از `form` (fromZod/
// fromJsonSchema) + منطق تازه.
//
// قوانین لایه (گیت: test/layering.test.ts):
//   • وابستگی فقط errors + shared؛ zod/ajv هیچ‌وقت runtime dep نیستند
//     (zod دونگی‌شود — DEC-021؛ ajv فقط devDependency برای تست meta-schema).
//   • بدون console در src (دروازهٔ no-console؛ حالت warn از reporter
//     تزریق‌شدهٔ setSchemaWarnReporter عبور می‌کند).
//   • ESM-only از تولد 1.5.0 (DEC-027)؛ زیرمسیرهای /zod و /json-schema.

export type {
  SchemaNode,
  SchemaKind,
  Issue,
  IssueCode,
  ValidateMode,
  ValidateOptions,
  ResolvedValidateOptions,
  DirectiveMeta,
  JsonSchema,
  SafeResult,
} from './types';

export { s, isSchemaNode, type Schema, type Infer, type ShapeOf } from './s';

export {
  validate,
  safeValidate,
  defineOptions,
  parseConfigAttr,
  setSchemaWarnReporter,
  type WarnReporter,
  type DefinedOptions,
} from './validate';

export { toJsonSchema, fromJsonSchema } from './json-schema';

// آداپتور zod فقط از زیرمسیر /zod در دسترس است (SPEC §۲.۲)؛ re-export در barrel
// نبود تا باندل main سبک بماند (بودجهٔ ۴KB) — form از @zenith/schema/zod
// import می‌کند.

export {
  defineDirectiveMeta,
  getRegisteredDirectiveMetas,
  toDirectiveManifest,
  toHtmlCustomData,
  type ZenithMetaDoc,
  type HtmlCustomData,
} from './manifest';
