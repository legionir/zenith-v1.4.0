// #142 — انواع @zenith/schema (SPEC §۲.۲).

/** گره‌های schema — union تمیزشده؛ هر سازندهٔ `s.*` یکی می‌سازد. */
export type SchemaNode =
  | { kind: 'string'; min?: number; max?: number; pattern?: string }
  | { kind: 'number'; min?: number; max?: number; int?: boolean }
  | { kind: 'boolean' }
  | { kind: 'enum'; values: readonly unknown[] }
  | { kind: 'duration'; min?: number; max?: number }
  | { kind: 'fn' }
  | { kind: 'signal' }
  | { kind: 'element' }
  | { kind: 'array'; item: SchemaNode }
  | { kind: 'record'; value: SchemaNode }
  | { kind: 'object'; shape: Record<string, SchemaNode> }
  | { kind: 'union'; options: readonly SchemaNode[] }
  | { kind: 'optional'; inner: SchemaNode }
  | { kind: 'default'; inner: SchemaNode; value: unknown }
  | { kind: 'custom'; check: (v: unknown) => boolean; expected: string };

export type SchemaKind = SchemaNode['kind'];

export type IssueCode = 'ZEN-1001' | 'ZEN-1002' | 'ZEN-1004';

/** یک ناکامی اعتبارسنجی با مسیر دقیق (معیار پذیرش: مسیر + انتظار + مقدار). */
export interface Issue {
  readonly path: readonly (string | number)[];
  readonly code: IssueCode;
  readonly expected: string;
  readonly received: string;
  readonly message: string;
}

export type ValidateMode = 'throw' | 'warn' | 'result';

export interface ValidateOptions {
  /** dev: throw، prod: warn — با `__ZENITH_DEV__` (DEC-020 قرارداد). */
  mode?: ValidateMode;
  /** کلید ناشناخته خطا بدهد (پیش‌فرض true — SPEC §۲.۲ «dev: true»). */
  strict?: boolean;
  /** `"5"` → 5، `"true"` → true (پیش‌فرض false؛ attribute مسیرها true می‌دهند). */
  coerce?: boolean;
  /** فقط اولین issue (پیش‌فرض false). */
  abortEarly?: boolean;
  /** نام API برای پیام خطا (مثلاً `zen-chart`). */
  name?: string;
}

export type ResolvedValidateOptions = Required<Omit<ValidateOptions, 'name'>> & {
  name?: string;
};

/** متادیتای یک directive برای `zenith.meta.json` / `html.customData.json`. */
export interface DirectiveMeta {
  readonly name: string; // مثل 'zen-if'
  readonly description: string;
  /** امضای مختصر برای مستندات/ویرایشگر. */
  readonly syntax?: string;
  /** مقدارهای مجاز ساده (تکراری‌ها مثل enum). */
  readonly values?: readonly string[];
  /** زیر-attributeهای اختیاری (مثل zen-if-then). */
  readonly attributes?: readonly string[];
  /** لینک مستندات. */
  readonly docs?: string;
}

/** خروجی JSON Schema (Draft 2020-12) — ساختار باز؛ گیت با meta-schema تست می‌شود. */
export type JsonSchema = Record<string, unknown>;

export type SafeResult<T> = { ok: true; value: T } | { ok: false; issues: readonly Issue[] };
