import { effect, signal, type Signal } from '@zenith/state';
import { compileExpression } from '@zenith/expressions';
import { reportError } from '@zenith/error-boundary';
import { logger } from '@zenith/logger';
import { zenForNoZenKeyError, ZenithError, ErrorCode } from '@zenith/errors';
import { parseForSyntax } from './for-syntax';
import { createLoopContext, createStaticLoopContext, computeKey } from './for-context';

interface LoopItem {
  node: HTMLElement;
  itemSignal?: Signal<unknown>;
  indexSignal?: Signal<number>;
  disposes: (() => void)[];
}

/** Keyed/static list binding; child context is dynamic and caller-owned. @public */
export function processFor(
  el: HTMLElement,
  expr: string,
  context: Record<string, unknown>,
  processChildren: (
    node: HTMLElement,
    localContext: Record<string, unknown>,
    disposes: (() => void)[],
  ) => void,
): () => void {
  // ── ۱. پارس کردن سینتکس ──
  const { itemName, indexName, listExpr } = parseForSyntax(expr);

  // FEATURE (v1.0.0): compile-once — listExpr فقط یک‌بار parse می‌شود.
  const listEvalFn = compileExpression(listExpr);

  // ── ۲. ذخیره zen-key قبل از هر تغییری ──
  const keyExpr = el.getAttribute('zen-key');
  // FEATURE (v1.0.0): compile-once — keyExpr فقط یک‌بار parse می‌شود (اگر وجود دارد).
  const keyEvalFn = keyExpr ? compileExpression(keyExpr) : null;

  // FEATURE (v1.0.0): zen-static — Fast Path برای لیست‌های فقط‌خواندنی.
  // وقتی attribute `zen-static` وجود دارد:
  //   - per-item Signal (itemSignal/indexSignal) ساخته نمی‌شود.
  //   - createLoopContext (که ۴ defineProperty + signalsMap می‌سازد) اجرا نمی‌شود.
  //   - به جای آن، یک Context ساده با مقادیر مستقیم (نه getter) ساخته می‌شود.
  //   - در تغییر لیست: full re-render (همه dispose + rebuild) به جای keyed diffing.
  // Tradeoff: mount سریع‌تر (۲-۵ برابر)، اما update کندتر (full rebuild).
  // مناسب برای لیست‌های ایستا مثل منوها، جدول‌های read-only، نتایج جستجوی static.
  const isStatic = el.hasAttribute('zen-static');

  // اگر zen-key وجود نداشت، هشدار بده (اما ادامه بده با fallback به index).
  if (!keyExpr) {
    // FEATURE (v1.0.0): پیام هشدار بهبودیافته با مثال از کتابخانه‌ی خطاها.
    // #39: لاگر مرکزی — ZenithError مستقیم به logger سپرده می‌شود تا
    // code+message+suggestion با فرمت یکپارچه چاپ شود (به‌جای toUserString دستی).
    logger.warn(zenForNoZenKeyError(expr));
  }

  // ── ۳. ساخت Template ──
  // عنصر اصلی را clone می‌کنیم و zen-for / zen-key را از clone برمی‌داریم.
  // هر آیتم لیست یک نسخه از این template می‌گیرد.
  const template = el.cloneNode(true) as HTMLElement;
  template.removeAttribute('zen-for');
  template.removeAttribute('zen-key');
  // FEATURE (v1.0.0): zen-static را هم از template حذف کن تا روی cloneها نباشد.
  template.removeAttribute('zen-static');

  // ── ۴. جایگزینی عنصر اصلی با Comment placeholder ──
  // این comment به عنوان anchor برای insert/move/delete عمل می‌کند.
  const parent = el.parentElement;
  if (!parent) {
    throw new ZenithError({
      code: ErrorCode.RUNTIME_ZEN_FOR_NO_PARENT,
      category: 'Runtime',
      message: 'Element must have a parent node.',
      suggestion:
        'عنصر zen-for باید فرزند یک element باشد؛ روی ریشهٔ مستقیم از zen-for استفاده نکنید.',
    });
  }
  const placeholder = document.createComment(`zen-for: ${listExpr}`);
  parent.replaceChild(placeholder, el);

  // ── ۵. نگه‌داشتن ردیابی آیتم‌های رندرشده ──
  // Map از key به LoopItem. هر key یک DOM node نگه می‌دارد.
  const itemsByKey = new Map<string, LoopItem>();

  // FEATURE (v1.0.0): در حالت zen-static، همه آیتم‌ها در یک آرایه ساده نگه‌داری
  // می‌شوند (نه Map با key). روی تغییر لیست، همه dispose + rebuild می‌شوند.
  const staticItems: LoopItem[] = [];

  // ── ۶. Effect اصلی: هر بار که آرایه تغییر کند، این تابع اجرا می‌شود ──
  const disposeEffect = effect(() => {
    // FEATURE (v1.0.0): compile-once — listEvalFn فقط evaluate می‌کند.
    const list = listEvalFn(context);
    const arr: unknown[] = Array.isArray(list) ? list : [];

    // ── FEATURE (v1.0.0): Fast Path (zen-static) ──
    // در حالت static، روی تغییر لیست، همه آیتم‌های قبلی dispose + remove می‌شوند
    // و همه آیتم‌های جدید از ابتدا ساخته می‌شوند. این کار keyed diffing را skip
    // می‌کند اما per-item Signal/Context creation را هم ساده‌تر می‌کند.
    if (isStatic) {
      // پاکسازی همه‌ی آیتم‌های قبلی.
      for (const it of staticItems) {
        for (const d of it.disposes) {
          try {
            d();
          } catch (e) {
            logger.error(
              `[zen-for] static dispose failed: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        }
        it.disposes.length = 0;
        if (it.node.parentNode === parent) parent.removeChild(it.node);
      }
      staticItems.length = 0;

      // FEATURE (v1.0.0): DocumentFragment batching — همه‌ی نودهای جدید را در
      // یک fragment جمع می‌کنیم و یک‌بار insert می‌کنیم. این کار از ۱۰۰۰۰
      // insertBefore جداگانه به ۱ insertBefore کاهش می‌یابد — سرعت mount
      // به‌طور قابل توجهی بالاتر می‌رود.
      const frag = document.createDocumentFragment();

      for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        const newNode = template.cloneNode(true) as HTMLElement;

        // Context ساده با مقادیر مستقیم (بدون Signal، بدون getter).
        const localContext = createStaticLoopContext(context, { itemName, indexName, item, index: i });

        const disposes: (() => void)[] = [];
        processChildren(newNode, localContext, disposes);

        const loopItem: LoopItem = { node: newNode, disposes };
        staticItems.push(loopItem);
        frag.appendChild(newNode);
      }

      // یک‌بار insert کردن fragment بعد از placeholder.
      parent.insertBefore(frag, placeholder.nextSibling);
      return;
    }

    // ── Standard Path (keyed diffing) ──
    // کلیدهایی که در این اجرا استفاده شده‌اند (برای detect حذف‌ها).
    const usedKeys = new Set<string>();

    // FEATURE (v1.0.0): DocumentFragment batching برای initial mount.
    // اگر itemsByKey خالی است (initial mount)، همه‌ی نودهای جدید را در یک
    // fragment جمع می‌کنیم و یک‌بار insert می‌کنیم.
    const isInitialMount = itemsByKey.size === 0;
    const batchFrag: DocumentFragment | null = isInitialMount
      ? document.createDocumentFragment()
      : null;

    // آیتم‌های جدید را به ترتیب در DOM قرار می‌دهیم.
    let prevNode: Node = placeholder;

    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];

      // محاسبه‌ی کلید این آیتم.
      const key = computeKey(keyEvalFn, { item, index: i, parentContext: context, itemName, indexName });

      // BUG FIX (BUG-08): کلیدهای index همیشه یکتا هستند (i یکتا است)،
      // پس این بررسی برای حالت !keyExpr مرده بود. اما برای zen-key،
      // کلیدهای تکراری معنادار هستند و نشان‌دهنده‌ی باگ در داده‌های کاربر
      // هستند — هشدار می‌دهیم تا DOM نادرست رندر نشود.
      if (keyExpr && usedKeys.has(key)) {
        logger.warn(
          `[zen-for] Duplicate key "${key}" detected. Keys must be unique. DOM may render incorrectly.`,
        );
      }

      usedKeys.add(key);

      // آیا این کلید از قبل در DOM وجود دارد؟
      let loopItem = itemsByKey.get(key);

      if (loopItem) {
        // ── آپدیت آیتم موجود ──
        // فقط مقادیر Signalهای محلی را set می‌کنیم.
        if (loopItem.itemSignal) loopItem.itemSignal.set(item);
        if (loopItem.indexSignal) loopItem.indexSignal.set(i);

        // در حالت batch (initial mount)، این شاخه اجرا نمی‌شود چون itemsByKey خالی است.
        if (batchFrag) {
          // اگر در حال batch هستیم ولی این آیتم از قبل وجود داشت (نباید در initial mount
          // رخ دهد)، آن را به fragment اضافه کن.
          batchFrag.appendChild(loopItem.node);
        } else {
          const expectedNext = prevNode.nextSibling;
          if (loopItem.node !== expectedNext) {
            parent.insertBefore(loopItem.node, expectedNext);
          }
        }
      } else {
        // ── ساخت آیتم جدید ──
        const newNode = template.cloneNode(true) as HTMLElement;

        // Signalهای محلی برای این آیتم.
        const itemSignal = signal(item);
        const indexSignal = signal(i);

        // Context محلی که $item و $index روی آن تعریف شده‌اند.
        const localContext = createLoopContext(context, { itemName, indexName, itemSignal, indexSignal });

        const disposes: (() => void)[] = [];
        processChildren(newNode, localContext, disposes);

        loopItem = { node: newNode, itemSignal, indexSignal, disposes };
        itemsByKey.set(key, loopItem);

        if (batchFrag) {
          batchFrag.appendChild(newNode);
        }
      }

      if (!batchFrag) {
        const expectedNext = prevNode.nextSibling;
        if (loopItem.node !== expectedNext) {
          parent.insertBefore(loopItem.node, expectedNext);
        }
      }
      prevNode = loopItem.node;
    }

    // FEATURE (v1.0.0): اگر در حالت batch بودیم، حالا fragment را یک‌بار insert کن.
    if (batchFrag && batchFrag.childNodes.length > 0) {
      parent.insertBefore(batchFrag, placeholder.nextSibling);
    }

    // ── ۷. پاکسازی آیتم‌های حذفشده ──
    for (const [key, loopItem] of itemsByKey.entries()) {
      if (!usedKeys.has(key)) {
        for (const dispose of loopItem.disposes) {
          try {
            dispose();
          } catch (err) {
            logger.error(
              `[zen-for] Error during dispose of removed item: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
        loopItem.disposes.length = 0;

        if (loopItem.node.parentNode === parent) {
          parent.removeChild(loopItem.node);
        }
        itemsByKey.delete(key);
      }
    }
  });

  // ── ۸. تابع Dispose کل zen-for ──
  // این تابع توسط walker هنگام teardown کل اپ (Zen.stop) فراخوانی می‌شود.
  return () => {
    // Effect اصلی را dispose کن.
    disposeEffect();

    // FEATURE (v1.0.0): پاکسازی آیتم‌های static (اگر در حالت zen-static بود).
    for (const loopItem of staticItems) {
      for (const dispose of loopItem.disposes) {
        try {
          dispose();
        } catch (err) {
          logger.error(
            `[zen-for] Error during teardown dispose: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
      loopItem.disposes.length = 0;
      if (loopItem.node.parentNode === parent) {
        parent.removeChild(loopItem.node);
      }
    }
    staticItems.length = 0;

    // همه‌ی آیتم‌های باقی‌مانده (keyed path) را unmount کن.
    for (const [, loopItem] of itemsByKey.entries()) {
      for (const dispose of loopItem.disposes) {
        try {
          dispose();
        } catch (err) {
          logger.error(
            `[zen-for] Error during teardown dispose: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
      loopItem.disposes.length = 0;
      if (loopItem.node.parentNode === parent) {
        parent.removeChild(loopItem.node);
      }
    }
    itemsByKey.clear();

    // placeholder هم حذف کن.
    if (placeholder.parentNode === parent) {
      parent.removeChild(placeholder);
    }
  };
}
