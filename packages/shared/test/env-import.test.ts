// #141 — هیچ دسترسی به window/document هنگام import (تست در Node خالص).
//
// معیار پذیرش: «هیچ دسترسی به `window/document` هنگام import نیست». این فایل
// در environment پیش‌فرض node اجرا می‌شود (بدون jsdom). اگر src/index.ts در
// سطح ماژول به window/document دست بزند، اینجا ReferenceError می‌گیرد.
//
// نکته: jsdom در ورک‌اسپیس پکیج `virtual-list` و ... فعال است ولی هر فایل
// test مستقل environment خودش را دارد؛ این فایل @vitest-environment ندارد ⇒
// node خالص.
import { describe, it, expect } from 'vitest';

describe('@zenith/shared import in pure Node (#141)', () => {
  it('imports without touching window/document at module load', async () => {
    // window/document در environment node تعریف‌شده نیستند.
    expect(typeof globalThis).toBe('object');
    // dynamic import: اگر اثر جانبیِ DOM-محور داشته باشد اینجا می‌شکند.
    const mod = await import('../src/index');
    expect(typeof mod.mergeOptions).toBe('function');
    expect(typeof mod.parseDuration).toBe('function');
    expect(typeof mod.createDisposer).toBe('function');
    expect(typeof mod.secureId).toBe('function');
    expect(typeof mod.invariant).toBe('function');
    // isServer در نبود window/document باید true گزارش دهد (محیت سرور).
    expect(mod.isServer()).toBe(true);
    expect(mod.hasDOM()).toBe(false);
    expect(mod.hasWindow()).toBe(false);
  });
});
