// @vitest-environment jsdom
//
// #145 — دایرکتیو `zen-persist` (SPEC §۲.۵ «attributeها … برای المان‌های
// دارای zen-model»): مقدار zen-model زیر کلید `zen-persist="key"` در
// @zenith/storage ذخیره می‌شود؛ هنگام mount دادهٔ ذخیره‌شده hydrate می‌شود؛
// sub-attributeها: zen-persist-driver (local/session/indexeddb)،
// zen-persist-ttl (never)، zen-persist-version (1)، zen-persist-debounce (300ms).
// ورودی نامعتبر ⇒ هشدار و بی‌عمل (نه throw) — قرارداد parsePersistAttr.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';

async function start(root: HTMLElement, state: Record<string, unknown>) {
  const { Zen } = await import('../src/index');
  Zen.start(root, state as never);
  flushSync();
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.useRealTimers();
});

describe('zen-persist (#145)', () => {
  it('hydrates the model value from storage and writes input changes back (debounce 0)', async () => {
    // رکورد v1 زیر ns کلید پیش‌فرض 'zen' (SPEC §۲.۵).
    localStorage.setItem('zen:cart.user', JSON.stringify({ v: 1, t: 1, e: null, d: 'زهرا' }));
    document.body.innerHTML =
      '<div id="app"><input id="f" zen-model="$form.user" zen-persist="cart.user" zen-persist-debounce="0"></div>';
    const form = signal({ user: 'ali' });
    await start(document.getElementById('app')!, { form });

    // hydrate: هم DOM و هم signal باید مقدار ذخیره‌شده را بگیرند
    expect((document.getElementById('f') as HTMLInputElement).value).toBe('زهرا');
    expect(form.get()).toEqual({ user: 'زهرا' });

    // نوشتن مجدد: تایپ ⇒ ذخیره (debounce 0 ⇒ همگام)
    const el = document.getElementById('f') as HTMLInputElement;
    el.value = 'محمد';
    el.dispatchEvent(new Event('input'));
    expect(JSON.parse(localStorage.getItem('zen:cart.user') as string).d).toBe('محمد');
    expect(form.get()).toEqual({ user: 'محمد' });
  });

  it('honours zen-persist-driver="session" and zen-persist-ttl (record e = t + ttl)', async () => {
    document.body.innerHTML =
      '<div id="app"><input id="s" zen-model="$q" zen-persist="quick.q" zen-persist-driver="session" zen-persist-ttl="1h" zen-persist-debounce="0"></div>';
    const q = signal('پیش‌فرض');
    await start(document.getElementById('app')!, { q });

    // بدون دادهٔ ذخیره‌شده، مقدار فعلی بایدها حفظ شود (hydrate نکند به undefined)
    expect((document.getElementById('s') as HTMLInputElement).value).toBe('پیش‌فرض');

    const el = document.getElementById('s') as HTMLInputElement;
    el.value = 'جستجو';
    el.dispatchEvent(new Event('input'));
    const raw = sessionStorage.getItem('zen:quick.q');
    expect(raw).not.toBeNull();
    const rec = JSON.parse(raw as string);
    expect(rec.d).toBe('جستجو');
    expect(rec.e - rec.t).toBe(3_600_000); // ۱ ساعت
    expect(localStorage.getItem('zen:quick.q')).toBeNull(); // در local نوشته نشد
  });

  it('debounces writes by default (300ms) — one write for rapid keystrokes', async () => {
    document.body.innerHTML =
      '<div id="app"><input id="d" zen-model="$note" zen-persist="note"></div>';
    const note = signal('');
    await start(document.getElementById('app')!, { note });

    vi.useFakeTimers();
    const el = document.getElementById('d') as HTMLInputElement;
    el.value = 'a';
    el.dispatchEvent(new Event('input'));
    el.value = 'ab';
    el.dispatchEvent(new Event('input'));
    expect(localStorage.getItem('zen:note')).toBeNull();
    vi.advanceTimersByTime(350);
    expect(JSON.parse(localStorage.getItem('zen:note') as string).d).toBe('ab');
    vi.useRealTimers();
  });

  it('invalid attributes warn and no-op (never throw, never write)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    document.body.innerHTML =
      '<div id="app"><input id="b" zen-model="$x" zen-persist="k1" zen-persist-driver="s3"></div>';
    const x = signal('v');
    await start(document.getElementById('app')!, { x });

    const el = document.getElementById('b') as HTMLInputElement;
    el.value = 'w';
    el.dispatchEvent(new Event('input'));
    expect(localStorage.getItem('zen:k1')).toBeNull(); // راندمان invalid ⇒ بی‌عمل
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('requires zen-model on the element; without it the directive is a warned no-op', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    document.body.innerHTML = '<div id="app"><input id="n" zen-persist="orphan"></div>';
    await start(document.getElementById('app')!, {});
    const el = document.getElementById('n') as HTMLInputElement;
    el.value = 'zz';
    el.dispatchEvent(new Event('input'));
    expect(localStorage.getItem('zen:orphan')).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('reflects a cross-tab write (storage event) into the input and the signal', async () => {
    document.body.innerHTML =
      '<div id="app"><input id="t" zen-model="$city" zen-persist="addr.city" zen-persist-debounce="0"></div>';
    const city = signal('تهران');
    await start(document.getElementById('app')!, { city });

    // تب دیگر: همان کلید با wrapper درست، سپس StorageEvent (localWrite نمی‌شود)
    localStorage.setItem('zen:addr.city', JSON.stringify({ v: 1, t: 1, e: null, d: 'شیراز' }));
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'zen:addr.city',
        newValue: localStorage.getItem('zen:addr.city'),
      }),
    );
    flushSync();
    expect(city.get()).toBe('شیراز');
    expect((document.getElementById('t') as HTMLInputElement).value).toBe('شیراز');
  });
});
