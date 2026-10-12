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
import type { Readable, MaybeReactive } from '../src/index';

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
    expectTypeOf<StateReadable<number>>().toMatchTypeOf<Readable<number>>();
    expectTypeOf<Readable<number>>().toMatchTypeOf<StateReadable<number>>();
    expectTypeOf<MaybeSignal<number>>().toMatchTypeOf<MaybeReactive<number>>();
    expectTypeOf<MaybeReactive<number>>().toMatchTypeOf<MaybeSignal<number>>();
  });
});
