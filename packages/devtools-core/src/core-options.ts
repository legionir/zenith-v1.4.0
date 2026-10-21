// packages/devtools-core/src/core-options.ts
//
// گزینه‌های پیکربندی هستهٔ DevTools — استخراج مکانیکی از index.ts بدون
// تغییر رفتار (#40، code-first: نوشته‌شده، اجرا نشده).

import { s, defineOptions } from '@zenith/schema';


/** @public */
export const DEVTOOLS_HOOK_VERSION = '1.5.0';

const DEFAULT_REDACT_KEYS = ['token', 'password', 'authorization', 'secret', 'cookie'] as const;

/** @public */
export interface DevtoolsCoreOptions {
  /** فعال بودن ردیابی؛ پیش‌فرض: `__ZENITH_DEV__ !== false`. */
  enabled?: boolean;
  /** حداکثر تعداد رخدادهای Timeline؛ پیش‌فرض: `1000`. */
  maxTimelineEntries?: number;
  /** کلیدهایی که در مقادیر آبجکت پوشیده می‌شوند. */
  redact?: string[];
  /** نرخ نمونه‌برداری تغییرات (۰..۱)؛ پیش‌فرض: `1`. */
  sampleRate?: number;
  /** آیا مقدار کامل ذخیره شود (`true`) یا خلاصهٔ نوع/اندازه (`false`)؟ */
  captureValues?: boolean;
}

/** Source integration helper; root bridge awaits public-only export migration. @internal */
export const devtoolsCoreOptions = defineOptions<Required<DevtoolsCoreOptions>>(
  'DevtoolsCoreOptions',
  s.object({
    enabled: s.default(s.boolean(), true),
    maxTimelineEntries: s.default(s.number({ int: true, min: 1 }), 1000),
    redact: s.default(s.array(s.string({ min: 1 })), [...DEFAULT_REDACT_KEYS]),
    sampleRate: s.default(s.number({ min: 0, max: 1 }), 1),
    captureValues: s.default(s.boolean(), true),
  }),
);

/** @public */
export const DEVTOOLS_CORE_DEFAULTS = devtoolsCoreOptions.DEFAULTS;
/** @public */
export const devtoolsCoreOptionsSchema = devtoolsCoreOptions.schema;
/** @public */
export const resolveDevtoolsCoreOptions = (opts?: unknown): Required<DevtoolsCoreOptions> =>
  devtoolsCoreOptions.resolve(opts);