// #141 / DEC-021 — تست نوع (expectTypeOf، اجرا با vitest typecheck).
//
// الزام DEC-021: «تست نوع ثابت کند `ReadonlySignal`/`Computed` ساختاراً
// `Readable` را برآورده می‌کند». این فایل در `packages/shared/test/*.test-d.ts`
// با `test.typecheck.enabled` در vitest.config اجرا می‌شود؛ اگر برند یا امضای
// get در state تغییر کند و با `Readable` نخواند، CI قرمز می‌شود.
//
// چرا `Readable` ساختاری است (`{ get(): T }`)؟ چون `shared` نمی‌تواند `state`
// را import کند (چرخهٔ `shared ↔ state`). تطابق ساختاری + برند runtime
// (DEC-009، `Symbol.for('zenith.readable')`) دقیقاً همان چیزی است که SPEC بند
// ۲.۱ خواسته است.
import { describe, it, expectTypeOf } from 'vitest';
import { signal, computed } from '@zenith/state';
import type { ReadonlySignal, Readable as StateReadable, MaybeSignal } from '@zenith/state';
import { onGlobalReset } from '@zenith/errors';
import type { Readable, MaybeReactive, Cleanup } from '../src/index';

describe('Readable is structurally satisfied by state containers (DEC-021)', () => {
  it('Signal<T> and ReadonlySignal<T> are Readable<T>', () => {
    const s = signal(1);
    expectTypeOf(s).toMatchTypeOf<Readable<number>>();
    expectTypeOf<ReadonlySignal<number>>().toMatchTypeOf<Readable<number>>();
    expectTypeOf(s.get()).toEqualTypeOf<number>();
  });

  it('computed() (Computed) is Readable<T>', () => {
    const c = computed(() => 2);
    expectTypeOf(c).toMatchTypeOf<Readable<number>>();
    expectTypeOf(c.get()).toEqualTypeOf<number>();
  });

  it('MaybeReactive<T> accepts both a plain value and a Readable<T>', () => {
    expectTypeOf<number>().toMatchTypeOf<MaybeReactive<number>>();
    expectTypeOf<Readable<number>>().toMatchTypeOf<MaybeReactive<number>>();
  });

  it('shared Readable ≡ state Readable و state MaybeSignal ≡ shared MaybeReactive (دوطرفه)', () => {
    // هر دو ساختاری‌اند؛ اگر یکی تغییر کند این قرمز می‌شود (منبع واحد، DEC-021).
    // #119: همین دو تعریف در allowlist «same-meaning» ثبت‌اند
    // (scripts/unique-export-names.allowlist.json) چون یال state→shared ممنوع
    // است (DEC-021/#141) و تایپ باید محلی بماند — این تست قفلِ برابری است:
    // اگر روزی از هم جدا شوند، `npm run typecheck` قرمز می‌شود.
    expectTypeOf<StateReadable<number>>().toMatchTypeOf<Readable<number>>();
    expectTypeOf<Readable<number>>().toMatchTypeOf<StateReadable<number>>();
    expectTypeOf<MaybeSignal<number>>().toMatchTypeOf<MaybeReactive<number>>();
    expectTypeOf<MaybeReactive<number>>().toMatchTypeOf<MaybeSignal<number>>();
  });

  it('onGlobalReset returns a Cleanup — @zenith/errors stays dependency-free (DEC-032/#118)', () => {
    // `@zenith/errors` صفر وابستگی است و `Cleanup` را از shared import نمی‌کند؛
    // به‌جای آن یک alias محلی هم‌ساختار دارد. این تست همان برابری را قفل می‌کند
    // (شرط تأیید مالک برای نگه‌داشتن رجیستری ریست در errors).
    expectTypeOf<ReturnType<typeof onGlobalReset>>().toEqualTypeOf<Cleanup>();
    expectTypeOf<ReturnType<typeof onGlobalReset>>().toMatchTypeOf<Cleanup>();
    expectTypeOf<Cleanup>().toMatchTypeOf<ReturnType<typeof onGlobalReset>>();
  });

  it('onGlobalReset accepts a Cleanup-returning callback as its hook argument', () => {
    // هوک می‌تواند مقدار برگرداند؟ نه — امضای `GlobalResetHook` دقیقاً `() => void`
    // است؛ ولی یک تابع بدون آرگومان با هر خروجی نادیده‌شده سازگار است.
    expectTypeOf(onGlobalReset).parameter(0).toEqualTypeOf<() => void>();
  });
});
