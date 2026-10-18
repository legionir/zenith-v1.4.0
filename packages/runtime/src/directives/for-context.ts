import type { Signal } from '@zenith/state';
import { reportError } from '@zenith/error-boundary';

/** Private loop context/key helper, retaining inherited getters. @internal */
export function createLoopContext(parentContext: Record<string, unknown>, input: { itemName: string; indexName: string; itemSignal: Signal<unknown>; indexSignal: Signal<number>; }): Record<string, unknown> {
  const { itemName, indexName, itemSignal, indexSignal } = input;
  // یک آبجکت جدید با prototype = parentContext.
  // به این ترتیب تمام کلیدهای والد (از جمله getter های `$user` و غیره)
  // به ارث می‌رسند و هنوز reactive می‌مانند.
  const child: Record<string, unknown> = Object.create(parentContext);

  // تعریف getter برای `$item` و `item` (هر دو به itemSignal).
  // این getter ها Signal.get() را فراخوانی می‌کنند تا dependency tracking
  // فعال شود.
  const itemKey = `$${itemName}`;
  const itemKeyBare = itemName;
  Object.defineProperty(child, itemKey, {
    get: () => itemSignal.get(),
    enumerable: true,
    configurable: true,
  });
  // فقط اگر نام bare با چیزی در parent تداخل نداشت (جلوگیری از override
  // متغیرهای والد). در حالت عادی، parent context فقط `$xxx` دارد، پس
  // `item` و `index` آزاد هستند.
  if (!(itemKeyBare in parentContext)) {
    Object.defineProperty(child, itemKeyBare, {
      get: () => itemSignal.get(),
      enumerable: true,
      configurable: true,
    });
  }

  // تعریف getter برای `$index` و `index`.
  const indexKey = `$${indexName}`;
  const indexKeyBare = indexName;
  Object.defineProperty(child, indexKey, {
    get: () => indexSignal.get(),
    enumerable: true,
    configurable: true,
  });
  if (!(indexKeyBare in parentContext)) {
    Object.defineProperty(child, indexKeyBare, {
      get: () => indexSignal.get(),
      enumerable: true,
      configurable: true,
    });
  }

  // ── ثبت reference به Signal های محلی (برای zen-model) ──
  // این کار به zen-model اجازه می‌دهد در داخل zen-for، Signal محلی item
  // را پیدا کرده و set کند. بدون این، zen-model روی متغیرهای محلی کار نمی‌کند.
  //
  // ساختار: { itemName → itemSignal, indexName → indexSignal }
  // نکته: اگر parentContext هم signals map داشت، آن را به ارث می‌بریم.
  const parentSignals = parentContext.__zenith_signals__ as
    Map<string, Signal<unknown>> | undefined;
  const signalsMap = parentSignals ? new Map(parentSignals) : new Map<string, Signal<unknown>>();
  signalsMap.set(itemName, itemSignal);
  signalsMap.set(indexName, indexSignal as Signal<unknown>);
  // non-enumerable تا در iteration ظاهر نشود.
  Object.defineProperty(child, '__zenith_signals__', {
    value: signalsMap,
    enumerable: false,
    configurable: true,
    writable: false,
  });

  return child;
}

/** Private loop context/key helper, retaining inherited getters. @internal */
export function createStaticLoopContext(parentContext: Record<string, unknown>, input: { itemName: string; indexName: string; item: unknown; index: number; }): Record<string, unknown> {
  const { itemName, indexName, item, index } = input;
  const child: Record<string, unknown> = Object.create(parentContext);

  // $item و item — مقادیر مستقیم (نه getter).
  Object.defineProperty(child, `$${itemName}`, {
    value: item,
    enumerable: true,
    configurable: true,
  });
  if (!(itemName in parentContext)) {
    Object.defineProperty(child, itemName, {
      value: item,
      enumerable: true,
      configurable: true,
    });
  }

  // $index و index — مقادیر مستقیم.
  Object.defineProperty(child, `$${indexName}`, {
    value: index,
    enumerable: true,
    configurable: true,
  });
  if (!(indexName in parentContext)) {
    Object.defineProperty(child, indexName, {
      value: index,
      enumerable: true,
      configurable: true,
    });
  }

  return child;
}

/** Private loop context/key helper, retaining inherited getters. @internal */
export function computeKey(keyEvalFn: ((ctx: object) => unknown) | null, input: { item: unknown; index: number; parentContext: Record<string, unknown>; itemName: string; indexName: string; }): string {
  const { item, index, parentContext, itemName, indexName } = input;
  if (!keyEvalFn) {
    return String(index);
  }
  // برای ارزیابی expression کلید، یک context موقت می‌سازیم که item و index
  // مقادیر ثابت (نه Signal) داشته باشند. این کار باعث می‌شود ارزیابی key
  // وابستگی به Signalهای محلی ایجاد نکند.
  const tempContext: Record<string, unknown> = Object.create(parentContext);
  // $item و item
  Object.defineProperty(tempContext, `$${itemName}`, {
    value: item,
    enumerable: true,
    configurable: true,
  });
  if (!(itemName in parentContext)) {
    Object.defineProperty(tempContext, itemName, {
      value: item,
      enumerable: true,
      configurable: true,
    });
  }
  // $index و index
  Object.defineProperty(tempContext, `$${indexName}`, {
    value: index,
    enumerable: true,
    configurable: true,
  });
  if (!(indexName in parentContext)) {
    Object.defineProperty(tempContext, indexName, {
      value: index,
      enumerable: true,
      configurable: true,
    });
  }
  let key: unknown;
  try {
    key = keyEvalFn(tempContext);
  } catch (err) {
    reportError(err as Error, 'expression', { expression: 'zen-key' });
    return String(index);
  }
  return key === null || key === undefined ? String(index) : String(key);
}
