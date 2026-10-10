// @vitest-environment jsdom
//
// #19 — اجرای callbackهای کاربر داخل effect نباید وابستگی reactive بسازد.
//   * سیگنالی که فقط در `renderItem` خوانده می‌شود نباید `update()` را دوباره اجرا کند.
//   * سیگنالی که در `onVisibleRangeChange` نوشته می‌شود نباید حلقه بسازد (سقف اجرا).
//   * وابستگی effect باید فقط `items` باشد (chg. آیتم → رندر دوباره).
import { describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { createVirtualList } from '../src/controller';

interface Row {
  id: number;
  label: string;
}

const rows = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, label: `R${i + 1}` }));

function makeContainer(height = 100) {
  document.body.innerHTML = '<div id="c" style="height:100px"></div>';
  const container = document.getElementById('c')!;
  Object.defineProperty(container, 'clientHeight', { value: height, configurable: true });
  return container;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('virtual-list controller: user callbacks are untracked (#19)', () => {
  it('a signal read only inside renderItem does not re-run update()', () => {
    const container = makeContainer();
    const external = signal('light');
    let keyCalls = 0;
    let renderCalls = 0;

    const api = createVirtualList<Row>({
      items: rows(50),
      itemSize: 10,
      container,
      getItemKey: (r) => {
        keyCalls++;
        return r.id;
      },
      renderItem: (item) => {
        renderCalls++;
        // خواندن سیگنال بیرونی: نباید effect را دوباره اجرا کند
        const el = document.createElement('div');
        el.textContent = `${item.label}:${external.get()}`;
        return el;
      },
    });

    const initialRenders = renderCalls;
    expect(initialRenders).toBeGreaterThan(0);
    keyCalls = 0;
    renderCalls = 0;

    external.set('dark');
    flushSync();
    flushSync();

    expect(keyCalls).toBe(0); // update() اصلاً اجرا نشده → بازسازی کامل لیست رخ نمی‌دهد
    expect(renderCalls).toBe(0); // نودهای کش‌شده دوباره ساخته نشده‌اند
    api.dispose();
  });

  it('a signal read inside onVisibleRangeChange / onScroll is not an effect dependency', () => {
    const container = makeContainer();
    const watched = signal(0);
    let keyCalls = 0;

    const api = createVirtualList<Row>({
      items: rows(30),
      itemSize: 10,
      container,
      getItemKey: (r) => {
        keyCalls++;
        return r.id;
      },
      renderItem: (item) => {
        const el = document.createElement('div');
        el.textContent = item.label;
        return el;
      },
      onVisibleRangeChange: () => {
        void watched.get();
      },
      onScroll: () => {
        void watched.get();
      },
    });

    keyCalls = 0;
    watched.set(1);
    flushSync();
    flushSync();
    expect(keyCalls).toBe(0);
    api.dispose();
  });

  it('writing a signal from onVisibleRangeChange does not create an update loop', () => {
    const container = makeContainer(1000);
    // آیتم‌سایز به flip وابسته است و callback بازه flip را می‌نویسد؛ اگر
    // خواندن itemSize داخل effect track می‌شد، هر نوشتن دوباره رندر را
    // روشن می‌کرد و حلقه تا سقف CAP ادامه می‌یافت.
    const flip = signal(0);
    let rangeCallbacks = 0;
    const CAP = 25; // سقف اجرا: از بی‌نهایت‌شدن تست جلوگیری می‌کند

    const api = createVirtualList<Row>({
      items: rows(100),
      itemSize: () => (flip.get() % 2 === 0 ? 10 : 100),
      container,
      getItemKey: (r) => r.id,
      renderItem: (item) => {
        const el = document.createElement('div');
        el.textContent = item.label;
        return el;
      },
      onVisibleRangeChange: () => {
        rangeCallbacks++;
        if (rangeCallbacks < CAP) flip.set(flip.get() + 1);
      },
    });

    expect(rangeCallbacks).toBeLessThan(CAP); // init حلقه نساخته است
    const before = rangeCallbacks;

    api.items.set(rows(100).map((r) => ({ ...r, label: `${r.label}!` })));
    flushSync();
    const after = rangeCallbacks;
    expect(after).toBeLessThan(CAP);
    expect(after - before).toBeLessThanOrEqual(2); // حداکثر اجرای مشروعِ وابسته به items

    flushSync();
    flushSync();
    expect(rangeCallbacks).toBe(after); // state ساکن شده؛ هیچ cascade ادامه ندارد
    api.dispose();
  });

  it('still re-renders when the items signal changes (no over-untracking)', () => {
    const container = makeContainer();
    const items = signal(rows(20));
    let renderCalls = 0;

    const api = createVirtualList<Row>({
      items,
      itemSize: 10,
      container,
      getItemKey: (r) => r.id,
      renderItem: (item) => {
        renderCalls++;
        const el = document.createElement('div');
        el.textContent = item.label;
        return el;
      },
    });

    expect(renderCalls).toBeGreaterThan(0);
    renderCalls = 0;

    items.set(Array.from({ length: 20 }, (_, i) => ({ id: 100 + i, label: `N${i}` })));
    flushSync();
    flushSync();

    expect(renderCalls).toBeGreaterThan(0); // وابستگی اصلی حفظ شده است
    api.dispose();
  });
});
