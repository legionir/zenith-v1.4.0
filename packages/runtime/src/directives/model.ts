// packages/runtime/src/directives/model.ts
//
// دایرکتیو zen-model: Two-way Binding بین Input و State.
//
// کاربرد:
//   <input type="text" zen-model="$user.name">
//   <input type="checkbox" zen-model="$isAgreed">
//   <select zen-model="$selectedOption">
//
// دو جهت اتصال:
//   ۱. State → Input (وقتی Signal.set فراخوانی شود، Input آپدیت شود)
//   ۲. Input → State (وقتی کاربر تایپ کند، Signal آپدیت شود)
//
// چالش:
//   Expression Engine فقط می‌تواند مقدار را بخواند، نه بنویسد.
//   برای نوشتن، باید مسیر `$user.name` را به یک Signal Map کنیم.
//
// راه‌حل:
//   setSignalFromPath() مسیر را تجزیه می‌کند، Signal مربوطه را پیدا می‌کند،
//   و یک کپی جدید (با تغییرات اعمال‌شده) را در Signal می‌نویسد.

import { effect, Signal } from '@zenith/state';
// FEATURE (v1.0.0): compileExpression — compile-once برای Hot Path.
import { compileExpression } from '@zenith/expressions';
import { isSignal } from '../context';

/**
 * تنظیم مقدار جدید در یک Signal از روی مسیر مثل "$user.name".
 *
 * مراحل:
 *   1) مسیر را تجزیه می‌کنیم: ["user", "name"]
 *   2) ابتدا در context جستجو می‌کنیم (برای پشتیبانی از متغیرهای محلی zen-for).
 *   3) اگر در context نبود، در state جستجو می‌کنیم.
 *   4) Signal مربوط به root را پیدا می‌کنیم.
 *   5) اگر فقط یک بخش بود (مثل "$count")، مستقیم signal.set(value) می‌کنیم.
 *   6) اگر چند بخش بود (مثل "$user.name"):
 *      - مقدار فعلی Signal را می‌گیریم
 *      - یک کپی shallow از آن می‌سازیم (و از intermediate objects هم)
 *      - مقدار جدید را در آخرین بخش می‌نویسیم
 *      - Signal.set(newCopy) می‌کنیم (تا reference جدید باشد و Effectها trigger شوند)
 *
 * @param state   آبجکت State اصلی (شامل Signalها).
 * @param path    مسیر Expression (مثل "$user.name").
 * @param value   مقدار جدید.
 * @param context Context فعلی (برای جستجوی متغیرهای محلی مثل zen-for).
 * @returns true در صورت موفقیت، false در صورت خطا.
 */
/**
 * Parse یک مسیر Expression به بخش‌ها، با پشتیبانی از dot و bracket notation.
 *
 * مثال‌ها:
 *   "$user.name"           → ["user", "name"]
 *   "$list[0].name"        → ["list", "0", "name"]
 *   "$data['key'].value"   → ["data", "key", "value"]
 *   "$items[$index].name"  → ["items", "$index", "name"]  (نکته: $index به‌صورت رشته)
 *
 * محدودیت: nested brackets پشتیبانی نمی‌شوند (مثل a[b[c]]).
 */
function parsePath(path: string): string[] {
  // حذف $ ابتدای مسیر
  const cleaned = path.replace(/^\$/, '');
  const parts: string[] = [];
  let current = '';
  let inBracket = false;
  let bracketContent = '';

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (char === '.' && !inBracket) {
      if (current) {
        parts.push(current);
        current = '';
      }
    } else if (char === '[' && !inBracket) {
      if (current) {
        parts.push(current);
        current = '';
      }
      inBracket = true;
      bracketContent = '';
    } else if (char === ']' && inBracket) {
      // حذف کوتیشن‌های اطراف bracket content (مثل 'key' یا "key")
      let content = bracketContent.trim();
      if (
        (content.startsWith("'") && content.endsWith("'")) ||
        (content.startsWith('"') && content.endsWith('"'))
      ) {
        content = content.slice(1, -1);
      }
      parts.push(content);
      inBracket = false;
    } else if (inBracket) {
      bracketContent += char;
    } else {
      current += char;
    }
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

function setSignalFromPath(
  state: Record<string, any>,
  path: string,
  value: any,
  context?: Record<string, any>,
): boolean {
  // پارس مسیر با پشتیبانی از dot و bracket notation.
  const parts = parsePath(path);

  if (parts.length === 0) return false;

  // BUG FIX (BUG-04): resolve runtime variables like $index / $item در مسیرهای
  // bracket notation مثل `$items[$index].name`. parsePath فقط مسیر را tokenize
  // می‌کند و `$index` را به‌عنوان یک رشته برمی‌گرداند — اما ما به مقدار واقعی
  // آن در context نیاز داریم. این حلقه تمام بخش‌هایی که با `$` شروع می‌شوند
  // را در context جستجو می‌کند و با مقدار واقعی (به‌صورت رشته) جایگزین می‌کند.
  // اگر متغیر در context نبود یا null/undefined بود، بخش بدون تغییر باقی می‌ماند.
  const resolvedParts = parts.map(part => {
    if (part.startsWith('$') && context) {
      try {
        const val = (context as any)[part];
        if (val !== undefined && val !== null) return String(val);
      } catch {}
    }
    return part;
  });

  const rootKey = resolvedParts[0]!;

  // ── ۱. ابتدا در context جستجو کنیم (برای پشتیبانی از متغیرهای محلی) ──
  // در zen-for، متغیرهای محلی (مثل `item`) به‌صورت getter در context تعریف می‌شوند
  // که از یک Signal محلی می‌خوانند. ما نیاز داریم به خود Signal دسترسی پیدا کنیم.
  //
  // نکته: در context، `$item` یک getter است که مقدار را برمی‌گرداند، نه خود Signal.
  // برای پشتیبانی از set کردن، باید Signal پشت getter را پیدا کنیم.
  // در نسخه فعلی، context محلی zen-for یک ویژگی اضافی `__zenith_signals__` دارد
  // که Map از نام متغیر به Signal است.
  if (context) {
    // بررسی اینکه آیا context دارای signals map است (برای متغیرهای محلی)
    const localSignals = (context as any).__zenith_signals__ as
      | Map<string, Signal<any>>
      | undefined;
    if (localSignals && localSignals.has(rootKey)) {
      const localSignal = localSignals.get(rootKey)!;
      return setSignalValue(localSignal, resolvedParts, value);
    }
  }

  // ── ۲. جستجو در state ──
  const signal = state[rootKey];

  if (!isSignal(signal)) {
    console.warn(
      `[zen-model] Cannot find signal for path: ${path}. ` +
      `If this is inside zen-for, use $item (with $ prefix) instead of item.`,
    );
    return false;
  }

  return setSignalValue(signal as Signal<any>, resolvedParts, value);
}

/**
 * تنظیم مقدار یک Signal با مسیر داده‌شده.
 *
 * @param signal Signal هدف.
 * @param parts  بخش‌های مسیر (مثل ["user", "name"]).
 * @param value  مقدار جدید.
 * @returns true در صورت موفقیت.
 */
function setSignalValue(
  signal: Signal<any>,
  parts: string[],
  value: any,
): boolean {
  if (parts.length === 1) {
    // مسیر ساده: signal.set(value) مستقیم
    signal.set(value);
    return true;
  }

  // مسیر تو در تو: باید یک کپی جدید بسازیم تا Reference تغییر کند
  // و Effectها trigger شوند.
  const currentValue = signal.get();
  // BUG-2 FIX (v1.2.2): array corruption — `{ ...currentValue }` روی آرایه یک
  // آبجکت می‌سازد (با indexed keys) نه یک آرایه. این باعث می‌شد مقدار جدید
  // به‌جای Array، Object باشد و همه‌ی Array methods از کار بیفتند.
  // راه‌حل: تشخیص نوع و استفاده از spread مناسب (array spread برای آرایه،
  // object spread برای آبجکت). برای nested levels هم همین منطق اعمال می‌شود.
  const newValue: any = Array.isArray(currentValue)
    ? [...currentValue]
    : { ...currentValue };

  let target: any = newValue;
  for (let i = 1; i < parts.length - 1; i++) {
    const key = parts[i]!;
    if (target[key] === null || target[key] === undefined) {
      target[key] = {};
    } else {
      // BUG-2 FIX (v1.2.2): برای nested levels هم از همان منطق array-aware
      // استفاده می‌کنیم تا آرایه‌های تودرته خراب نشوند.
      target[key] = Array.isArray(target[key]) ? [...target[key]] : { ...target[key] };
    }
    target = target[key];
  }
  target[parts[parts.length - 1]!] = value;

  signal.set(newValue);
  return true;
}

/**
 * تشخیص نوع Input برای انتخاب Event و رفتار مناسب.
 */
function getInputConfig(el: HTMLElement): {
  eventName: string;
  readValue: () => any;
} {
  const tagName = el.tagName;
  const type = (el as HTMLInputElement).type;

  if (type === 'checkbox') {
    return {
      eventName: 'change',
      readValue: () => (el as HTMLInputElement).checked,
    };
  }

  if (tagName === 'SELECT') {
    return {
      eventName: 'change',
      readValue: () => (el as HTMLSelectElement).value,
    };
  }

  if (type === 'number' || type === 'range') {
    return {
      eventName: 'input',
      readValue: () => {
        const raw = (el as HTMLInputElement).value;
        return raw === '' ? null : Number(raw);
      },
    };
  }

  // پیش‌فرض: input متنی
  return {
    eventName: 'input',
    readValue: () => (el as HTMLInputElement).value,
  };
}

/**
 * پردازش دایرکتیو zen-model روی یک Input.
 *
 * @param el عنصر Input.
 * @param expr رشته‌ی Expression (مسیری به یک Signal).
 * @param context آبجکت Context (برای Expression Engine).
 * @param state آبجکت State اصلی (برای setSignalFromPath).
 * @returns تابع Dispose برای پاکسازی.
 */
export function processModel(
  el: HTMLElement,
  expr: string,
  context: Record<string, any>,
  state: Record<string, any>,
): () => void {
  // FEATURE (v1.0.0): compile-once — expr فقط یک‌بار parse می‌شود.
  const evalFn = compileExpression(expr);

  // ── ۱. State → Input (One-way binding از سیگنال به Input) ──
  // FEATURE (v1.0.0): Property Diffing — اگر value با قبلی برابر است، skip کن.
  // این کار از نوشتن غیرضروری `.value` جلوگیری می‌کند.
  let prevValue: any = undefined;
  let isFirstRun = true;

  const disposeEffect = effect(() => {
    const value = evalFn(context);

    // FEATURE (v1.0.0): Property Diffing
    if (!isFirstRun && prevValue === value) return;
    prevValue = value;
    isFirstRun = false;

    // برای checkbox از property `checked` استفاده می‌کنیم نه `value`
    if ((el as HTMLInputElement).type === 'checkbox') {
      (el as HTMLInputElement).checked = Boolean(value);
    } else {
      (el as HTMLInputElement).value = value === null || value === undefined ? '' : String(value);
    }
  });

  // ── ۲. Input → State (Event Listener) ──
  const config = getInputConfig(el);

  const eventListener = (event: Event) => {
    // BUG-3 FIX (v1.2.2): stopPropagation رویداد را از رسیدن به delegated
    // event listeners (که در document level ثبت شده‌اند) بازمی‌داشت. این
    // باعث می‌شد zen-action و سایر directiveهای delegated روی parentها کار
    // نکنند. خط کاملاً حذف شد.
    const newValue = config.readValue();
    // context را هم به setSignalFromPath می‌دهیم تا متغیرهای محلی zen-for
    // (که در context هستند) هم پشتیبانی شوند.
    setSignalFromPath(state, expr, newValue, context);
  };

  el.addEventListener(config.eventName, eventListener);

  // ── ۳. تابع Dispose برای پاکسازی ──
  return () => {
    disposeEffect();
    el.removeEventListener(config.eventName, eventListener);
  };
}
