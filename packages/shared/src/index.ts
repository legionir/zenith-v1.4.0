// packages/shared/src/index.ts
//
// #141 — @zenith/shared: لایهٔ L0 (SPEC §۲.۱). نوع‌ها و ابزارهای خالصی که
// در پکیج‌ها تکرار شده بودند؛ صفر اثر جانبی، isomorphic، وابستگی فقط errors.
//
// قواعد لایه (گیت: test/layering.test.ts):
//   • هرگز @zenith/state یا @zenith/scheduler import نمی‌شود (چرخهٔ L0 ممنوع؛
//     Readable ساختاری است — DEC-021).
//   • import در سطح ماژول به window/document دست نمی‌زند (تست: env-import).
//   • بودجه ≤ ۲KB gzip (گیت: size-budget + .size-limit.json).

// نوع‌ها (Disposable/Cleanup/Readable/MaybeReactive/ZenithGlobals)
export type { Disposable, Cleanup, Readable, MaybeReactive, ZenithGlobals } from './types';

// واکنش‌گری ساختاری
export { isReadable, toValue, createDisposer, type Disposer } from './reactive';

// گزینه‌ها و attribute
export {
  mergeOptions,
  defineDefaults,
  parseDuration,
  parseBooleanAttr,
  parseNumberAttr,
} from './options';

// محیط (isomorphic — فقط هنگام فراخوانی بررسی می‌کنند)
export { isServer, hasDOM, hasWindow } from './env';

// شناسه‌ها: قطعی غیرامنیتی + CSPRNG امنیتی (#64)
export { createId, resetIdCounter, secureId } from './id';

// assertion ساختارمند با کد رزورشدهٔ ZEN-1090 (#171)
export { invariant, type InvariantFn } from './assert';
