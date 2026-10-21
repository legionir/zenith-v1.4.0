import type { Dependency } from '@zenith/dependency-graph';
import type { TemplateStateTypes } from './template-typecheck';
/** @public */
export interface CompiledTemplate {
  /** کد JavaScript تولیدشده. */
  code: string;
  /** وابستگی‌های استخراج‌شده. */
  dependencies: Dependency[];
  /** تعداد عناصر. */
  elementCount: number;
  /** تعداد Effect های تولیدشده. */
  effectCount: number;
  /** آیا قالب static است (هیچ Effect ندارد)؟ */
  isStatic: boolean;
  /**
   * لیست directiveهایی که compiler نتوانست compile کند و به runtime سپرده‌اند.
   * هر مورد شامل: { directive, value, elementPath }
   *
   * اگر این لیست خالی نباشد، generated module باید runtime walker را
   * پس از render() فراخوانی کند تا این directiveها پردازش شوند.
   */
  runtimeDirectives: Array<{ directive: string; value: string; elementPath: string }>;
  /**
   * Warningهای تولیدشده در حین compile (مثلاً syntax error در expression).
   */
  warnings: string[];
}

/** @public */
export interface CompilerOptions {
  /**
   * اگر true، در صورت وجود directive پشتیبانی‌نشده خطا پرتاب کند.
   * اگر false (پیش‌فرض)، warning چاپ کند و directive را به runtime بسپارد.
   */
  strict?: boolean;
  /**
   * قرارداد اختیاری نوع state برای type-safe opt-in (#111).
   *
   * غایب = حالت legacy (بدون هیچ تحلیلی). حاضر = موتور مشترک
   * `analyzeTemplateTypes` روی template اجرا می‌شود؛ یافته‌ها (ZEN-502)
   * در حالت عادی به `warnings` می‌روند و در حالت `strict` build را
   * می‌شکنند (throw). کلیدها با/بدون `$` پذیرفته‌اند.
   */
  stateTypes?: TemplateStateTypes;
}

/** @public @deprecated Use CompilerOptions. */
export type CompileOptions = CompilerOptions;
