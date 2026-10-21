// packages/ssr/src/server-component-inline.ts
//
// جایگزینی تگ‌ها با HTML رندرشده — استخراج مکانیکی از server-component.ts،
// بدون تغییر رفتار (#40).

import { renderServerComponent } from './server-component-render';
import { findServerComponentTags, parseServerComponentAttrs } from './server-component-parser';


// ── INLINE PASS ──

/**
 * یک pass تکی روی HTML: پیدا کردن تمام تگ‌های <zen-server-component> در
 * HTML فعلی و جایگزینی آن‌ها با HTML رندرشده‌ی کامپوننت.
 *
 * این تابع async است چون render ممکن است async باشد. تمام کامپوننت‌ها
 * به‌صورت موازی (Promise.all) رندر می‌شوند تا latency کاهش یابد.
 *
 * @param html   HTML ورودی این pass.
 * @param tags   تگ‌های پیدا شده (با findServerComponentTags).
 * @param state  آبجکت state برای resolve کردن $ expressions در props.
 * @returns HTML با تگ‌های این pass جایگزین‌شده.
 */
async function singlePass(
  html: string,
  tags: FoundTag[],
  state: Record<string, unknown>,
): Promise<string> {
  // رندر موازی همه‌ی کامپوننت‌ها.
  const rendered = await Promise.all(
    tags.map(async (tag) => {
      const { name, props } = parseServerComponentAttrs(tag.attrs, state);
      // اگر تگ non-self-closing باشد، inner content به‌عنوان prop `children`
      // پاس داده می‌شود (مثل React).
      if (tag.inner !== undefined) {
        props.children = tag.inner;
      }
      return renderServerComponent(name, props);
    }),
  );

  // ساخت HTML نهایی: از انتها به ابتدا جایگزین کن تا اندیسها ثابت بمانند.
  // tags به ترتیب document مرتب هستند (از کم به زیاد).
  let result = html;
  for (let i = tags.length - 1; i >= 0; i--) {
    const tag = tags[i]!;
    const replacement = rendered[i];
    if (typeof replacement !== 'string') continue;
    result = result.slice(0, tag.start) + replacement + result.slice(tag.end);
  }

  return result;
}

/**
 * پیدا کردن تمام تگ‌های <zen-server-component> در HTML و جایگزینی
 * آن‌ها با HTML رندرشده‌ی کامپوننت.
 *
 * FEATURE (v0.5.0): Nested Server Components — اگر خروجی render یک
 * کامپوننت خودش شامل تگ‌های <zen-server-component> باشد، آن‌ها به‌صورت
 * بازگشتی رندر می‌شوند. این کار با یک حلقه انجام می‌شود که در هر pass
 * یک سطح از nesting را حل می‌کند. MAX_PASSES=10 برای جلوگیری از loop
 * بی‌نهایت (مثلاً اگر کامپوننتی خودش را فراخوانی کند).
 *
 * @param html   HTML ورودی.
 * @param state  آبجکت state برای resolve کردن $ expressions در props.
 * @returns HTML با تمام تگ‌های (شامل nested) جایگزین‌شده. اگر تگی پیدا
 *          نشود، html اصلی بدون تغییر برگردانده می‌شود.
 */
export async function inlineServerComponents(
  html: string,
  state: Record<string, unknown> = {},
): Promise<string> {
  let result = html;
  let MAX_PASSES = 10;
  while (MAX_PASSES-- > 0) {
    const tags = findServerComponentTags(result);
    if (tags.length === 0) break;
    result = await singlePass(result, tags, state);
  }
  return result;
}
