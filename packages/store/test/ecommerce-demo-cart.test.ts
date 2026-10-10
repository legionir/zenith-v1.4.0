// @vitest-environment jsdom
//
// #145 — «مصرف در … سبد دمو» (SPEC §۲.۵ «مهاجرت»): ecommerce-demo دیگر
// localStorage خام ندارد؛ store.ts از createStorage + persistStore با
// namespace '' (کلید دقیق 'zenith_cart') استفاده می‌کند، دادهٔ میراث
// (آرایۀ خام JSON) به‌عنوان version 0 پذیرفته و backfill می‌شود و
// hydrate خودکار دارد (restoreCart دستی هرگز صدا زده نمی‌شد).
//
// ماژول دمو در هر تست با resetModules از نو ارزیابی می‌شود تا storage/
// store singleton بین تست‌ها شریک نشود.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const KEY = 'zenith_cart';
const LEGACY = JSON.stringify([{ id: 7, title: 'کتاب', price: 120000 }]);

async function loadDemo() {
  vi.resetModules();
  return import('../../../ecommerce-demo/src/store.js');
}

describe('ecommerce-demo cart on @zenith/storage (#145)', () => {
  beforeEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('adopts legacy raw-array zenith_cart: hydrates and backfills a v1 record under the exact key', async () => {
    localStorage.setItem(KEY, LEGACY);
    const { store } = await loadDemo();

    // hydrate همگام است (persistStore هنگام attach مقدار را $patch می‌کند).
    expect(store.state.cart).toHaveLength(1);
    expect(store.state.cart[0]!.id).toBe(7);

    // دادهٔ میراث adopt شده: رکورد {v,t,e,d} زیر همان کلید دقیق (بدون پیشوند).
    const rec = JSON.parse(localStorage.getItem(KEY) as string);
    expect(rec.v).toBe(1);
    expect(typeof rec.t).toBe('number');
    expect(rec.e).toBeNull();
    expect(rec.d).toEqual({ cart: [{ id: 7, title: 'کتاب', price: 120000 }] });
  });

  it('persists cart mutations through storage (debounced) instead of raw localStorage writes', async () => {
    const { store } = await loadDemo();

    // API دستی قدیم حذف شده است (actionها مستقیم روی store می‌نشینند).
    const acts = store as unknown as Record<string, unknown>;
    expect(acts['persistCart']).toBeUndefined();
    expect(acts['restoreCart']).toBeUndefined();

    vi.useFakeTimers();
    store.addToCart(1, 'هدفون', 500000);
    // debounce ۳۰۰ms ⇒ هنوز چیزی نوشته نشده
    expect(localStorage.getItem(KEY)).toBeNull();
    vi.advanceTimersByTime(350);

    const written = JSON.parse(localStorage.getItem(KEY) as string);
    expect(written.v).toBe(1);
    expect(written.d.cart).toEqual([{ id: 1, title: 'هدفون', price: 500000 }]);

    store.removeFromCart(1);
    vi.advanceTimersByTime(350);
    expect(JSON.parse(localStorage.getItem(KEY) as string).d.cart).toEqual([]);
  });

  it('survives corrupt data under zenith_cart (ZEN-1104 purge) and rewrites from scratch', async () => {
    localStorage.setItem(KEY, '{not json');
    const { store } = await loadDemo();

    // دادهٔ خراب پذیرفته/پرتاب نمی‌شود؛ پاک و از نو نوشته می‌شود.
    expect(localStorage.getItem(KEY)).toBeNull();
    vi.useFakeTimers();
    store.addToCart(2, 'ماوس', 300000);
    vi.advanceTimersByTime(350);
    const rec = JSON.parse(localStorage.getItem(KEY) as string);
    expect(rec.d.cart).toEqual([{ id: 2, title: 'ماوس', price: 300000 }]);
  });
});
