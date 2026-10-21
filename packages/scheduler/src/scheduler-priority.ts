// packages/scheduler/src/scheduler-priority.ts
//
// اولویت‌ها و ثابت‌های scheduler — استخراج مکانیکی از scheduler.ts،
// بدون تغییر رفتار (#40).


/**
 * سطح اولویت یک Effect — عدد پایین‌تر = اولویت بالاتر.
 */
export enum Priority {
  urgent = 0,
  high = 1,
  normal = 2,
  low = 3,
  idle = 4,
}

/**
 * ورودی اولویت — هم enum و هم رشته‌ی legacy پشتیبانی می‌شود.
 */
export type PriorityInput = Priority | 'urgent' | 'high' | 'normal' | 'low' | 'idle';

const PRIORITY_STRING_MAP: Record<string, Priority> = {
  urgent: Priority.urgent,
  high: Priority.high,
  normal: Priority.normal,
  low: Priority.low,
  idle: Priority.idle,
};

/**
 * نرخ Aging — هر چند ثانیه یک اولویت بالا می‌رود.
 */
export const PRIORITY_AGING_RATE = 0.5;

/**
 * حداقل زمان قبل از اعمال Aging (میلی‌ثانیه).
 */
export const AGING_THRESHOLD = 1000;

/**
 * حداکثر تعداد Effectهای مجاز در یک flush.
 */
export const MAX_FLUSH_ITERATIONS = 100;

/**
 * تبدیل ورودی اولویت به عدد.
 */
export function normalizePriority(p: PriorityInput): Priority {
  if (typeof p === 'number') return p;
  return PRIORITY_STRING_MAP[p] ?? Priority.normal;
}
