import type { Dependency } from '@zenith/dependency-graph';
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
}

/** @public @deprecated Use CompilerOptions. */
export type CompileOptions = CompilerOptions;
