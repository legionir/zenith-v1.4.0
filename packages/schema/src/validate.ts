// #142 — موتور اعتبارسنجی (SPEC §۲.۲): validate/safeValidate/defineOptions/
// parseConfigAttr با کدهای رزورشده ZEN-1001/1002/1003/1004 (کاتالوگ #171).
//
// سیاست L0 (گیت layering): بدون console در src — مسیر `mode:'warn'` از یک
// reporter تزریق‌شده عبور می‌کند (الگوی duck-seam DEC-021؛ مصرف‌کننده مثل
// runtime می‌تواند آن را به @zenith/logger وصل کند). پیش‌فرض reporter هیچ
// کاری نمی‌کند تا prod ساکت بماند.

export { type WarnReporter, setSchemaWarnReporter } from './validate-reporter';
export { safeValidate, validate } from './validate-engine';
export { type DefinedOptions, defineOptions } from './validate-options';
export { parseConfigAttr } from './validate-attr';
