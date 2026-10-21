// packages/components/src/processor-slots.ts
//
// جمع‌آوری و پر کردن slotهای کامپوننت — استخراج مکانیکی از processor.ts
// بدون تغییر رفتار (#40، code-first: نوشته‌شده، اجرا نشده).

import { logger } from '@zenith/logger';


/**
 * پر کردن slotهای داخل قالب کامپوننت با محتوای تگ کامپوننت.
 *
 * الگوریتم:
 *   1) محتوای داخل تگ کامپوننت را به دو گروه تقسیم می‌کنیم:
 *        - عناصر با `slot="name"` → برای slot نام‌گذاری شده.
 *        - سایر عناصر → برای slot پیش‌فرض.
 *   2) داخل قالب کامپوننت، تمام <slot> را پیدا می‌کنیم.
 *   3) هر <slot> را با محتوای مربوطه جایگزین می‌کنیم.
 *
 * نکته‌ی مهم: محتوای slot باید به همان Context والد متروج شود، نه Context
 * محلی کامپوننت. این منطق در `processChildren` callback پیاده‌سازی می‌شود
 * (walker والد آن را فراخوانی می‌کند).
 *
 * @param content      DocumentFragment کلون‌شده از قالب کامپوننت.
 * @param slotContents محتوای slotها (از buildSlotContents).
 */
export function fillSlots(content: DocumentFragment, slotContents: Map<string, HTMLElement[]>): void {
  const slots = content.querySelectorAll('slot');
  // اگر هیچ slotی در قالب نبود، چیزی برای پر کردن نیست.
  if (slots.length === 0) return;

  slots.forEach((slotEl) => {
    const slotName = slotEl.getAttribute('name') || 'default';
    const replacements = slotContents.get(slotName) || [];

    if (replacements.length > 0) {
      const parent = slotEl.parentNode;
      if (!parent) {
        logger.warn('[Zenith] <slot> has no parent node — cannot fill.');
        return;
      }
      // درج محتوا قبل از <slot>، به ترتیب.
      for (const rep of replacements) {
        parent.insertBefore(rep, slotEl);
      }
    }
    // حذف تگ <slot> (چه پر شد، چه نشد).
    slotEl.remove();
  });
}

/**
 * جمع‌آوری محتوای slot از داخل تگ کامپوننت.
 *
 * این تابع فرزندان تگ کامپوننت را به دو دسته تقسیم می‌کند:
 *   - عناصر با `slot="name"` → لیست برای slot نام‌گذاری شده.
 *   - سایر عناصر → لیست برای slot پیش‌فرض.
 *
 * نکته: این تابع فرزندان را از تگ کامپوننت جدا (detach) نمی‌کند — این کار
 * بعداً توسط insertBefore در fillSlots انجام می‌شود (وقتی به parent جدید
 * منتقل می‌شوند، خودکار از parent قبلی detach می‌شوند).
 *
 * @param el تگ کامپوننت.
 * @returns Map از نام slot به آرایه‌ی عناصر.
 */
export function buildSlotContents(el: HTMLElement): Map<string, HTMLElement[]> {
  const slotContents = new Map<string, HTMLElement[]>();
  // مقدار اولیه برای slot پیش‌فرض (حتی اگر خالی باشد).
  slotContents.set('default', []);

  for (const child of Array.from(el.children)) {
    const slotName = (child as HTMLElement).getAttribute('slot') || 'default';
    if (!slotContents.has(slotName)) {
      slotContents.set(slotName, []);
    }
    slotContents.get(slotName)!.push(child as HTMLElement);
  }

  return slotContents;
}