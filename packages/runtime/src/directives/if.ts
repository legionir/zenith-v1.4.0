// packages/runtime/src/directives/if.ts
//
// دایرکتیو zen-if: شرطی کردن نمایش یک عنصر.
//
// کاربرد:
//   <div zen-if="$isLoggedIn">Welcome, $user.name</div>
//   <span zen-if="$count > 0">$count items</span>
//
// چالش اصلی:
//   اگر فقط `display: none` کنیم:
//     - Event Listenerها هنوز فعال‌اند
//     - Inputها هنوز focus می‌گیرند
//     - Performance بدتر است (browser باید layout را محاسبه کند)
//
// راه‌حل استاندارد:
//   1) عنصر را با یک Comment Node جایگزین می‌کنیم (کاملاً از DOM حذف می‌شود).
//   2) وقتی شرط true شد، عنصر را بعد از comment درج می‌کنیم.
//   3) وقتی شرط false شد، عنصر را دوباره از DOM حذف می‌کنیم.
//
// Memory Leak Prevention:
//   وقتی عنصر unmount می‌شود، تمام Effectهایی که روی فرزندانش
//   تنظیم شده‌اند باید dispose شوند. walker این کار را با
//   callback manageChildren انجام می‌دهد.

import { effect } from '@zenith/state';
// FEATURE (v1.0.0): compileExpression — compile-once برای Hot Path.
import { compileExpression } from '@zenith/expressions';
import { reportError } from '@zenith/error-boundary';
// #47: مصرف‌کنندهٔ داخلی باید روی API مبنا کار کند — enterTransition/
// leaveTransition تنها wrapperهای deprecated برای کاربر نهایی‌اند و مصرف
// آن‌ها در فریم‌ورک، هشدار ZEN-DEPR را برای برنامهٔ کاربر تولید می‌کرد.
import { createTransition, type TransitionController } from '@zenith/transition';

/**
 * پردازش دایرکتیو zen-if روی یک عنصر.
 *
 * @param el عنصر HTML (که باید zen-if داشته باشد).
 * @param expr رشته‌ی Expression شرط.
 * @param context آبجکت Context.
 * @param manageChildren تابعی برای mount/unmount فرزندان.
 *        این تابع یک آرایه از dispose functions برمی‌گرداند.
 * @returns تابع Dispose برای پاکسازی خود دایرکتیو.
 */
export function processIf(
  el: HTMLElement,
  expr: string,
  context: Record<string, any>,
  manageChildren: () => (() => void)[],
): () => void {
  // FEATURE (v1.0.0): compile-once — expr فقط یک‌بار parse می‌شود.
  const evalFn = compileExpression(expr);

  const placeholder = document.createComment('zen-if');
  const parent = el.parentElement;

  if (!parent) {
    reportError(new Error('[zen-if] Element must have a parent node.'), 'directive', {
      expression: expr,
      element: el,
    });
    return () => {}; // no-op dispose
  }

  // ── حذف zen-if attribute ──
  // نکته‌ی مهم: اگر این کار را نکنیم، وقتی walker بعداً
  // (مثلاً بعد از re-mount) عنصر را دوباره walk می‌کند، دوباره
  // zen-if را می‌بیند و processIf را فراخوانی می‌کند که منجر به
  // ایجاد Effectهای duplicate می‌شود.
  el.removeAttribute('zen-if');

  // Warning: zen-if on parent of zen-for can cause issues.
  // BUG-4 FIX (v1.2.2): قبلاً فقط direct children بررسی می‌شدند و zen-for
  // در nested levels (مثلاً داخل یک <div> میانی) نادیده گرفته می‌شد. حالا
  // با querySelectorAll('[zen-for]') کل زیردرخت بررسی می‌شود.
  const hasForChild = el.querySelectorAll('[zen-for]').length > 0;
  if (hasForChild) {
    console.warn(
      '[Zenith] ⚠️ zen-if on parent of zen-for may cause context loss on re-mount.\n' +
        '  Problem: <div zen-if="$show"><li zen-for="...">  ← مشکل‌ساز\n' +
        '  Fix 1:   <div zen-bind:class="{hidden: !$show}"><li zen-for="...">  ← توصیه‌شده\n' +
        '  Fix 2:   <li zen-for="..." zen-if="$show && condition">  ← اگر شرط روی هر آیتم است',
    );
    // BUG FIX (BUG-02): fallback به display:none برای جلوگیری از context loss
    // روی zen-for. mount/remount باعث می‌شود فرزندان zen-for دوباره ساخته شوند
    // و context/signals محلی از دست برود. راه‌حل امن: el.style.display را
    // toggle کن و فقط یک‌بار manageChildren را فراخوانی کن.
    // FIX (v1.2.4): Removed reportError() here — this is a benign, expected
    // fallback path, not an error. The console.warn above is sufficient for
    // developer visibility. Spamming reportError pollutes error-boundary logs.

    // ── جایگزینی اولیه با Comment (مانند مسیر اصلی) ──
    parent.replaceChild(placeholder, el);

    // mount اولیه: عنصر را در DOM قرار بده و children را یک‌بار process کن.
    parent.insertBefore(el, placeholder.nextSibling);
    const childDisposes: (() => void)[] = manageChildren();

    // effect فقط display را toggle می‌کند (بدون unmount/remount).
    const dispose = effect(() => {
      let condition: boolean;
      try {
        condition = Boolean(evalFn(context));
      } catch (err) {
        reportError(err as Error, 'expression', { expression: expr, element: el });
        return;
      }
      el.style.display = condition ? '' : 'none';
    });

    return () => {
      childDisposes.forEach((d) => d());
      childDisposes.length = 0;
      dispose();
      if (el.parentNode === parent) {
        parent.removeChild(el);
      }
      if (placeholder.parentNode === parent) {
        parent.removeChild(placeholder);
      }
    };
  }

  // ── جایگزینی اولیه با Comment ──
  parent.replaceChild(placeholder, el);

  let isMounted = false;
  let childDisposes: (() => void)[] = [];

  // BUG FIX (BUG-01/05): نگه‌داشتن تابع cancel برای leave در حال انجام.
  // اگر zen-if سریع toggle شود یا Zen.stop در حین leave فراخوانی شود،
  // این تابع راف‌ها/تایمر/listener/کلاس‌های transition را پاک می‌کند.
  let cancelLeave: (() => void) | null = null;

  // #47: کنترلر transition روی API مبنا (createTransition) ساخته می‌شود؛
  // یک کنترلر برای هر نام transitionِ attribute (معمولاً یکی) و در انتها
  // dispose می‌شود تا listenerها/تایمرها آزاد شوند.
  let transitionName: string | null = el.getAttribute('zen-transition');
  let transitionCtl: TransitionController | null = null;
  const getTransitionController = (): TransitionController | null => {
    transitionName = el.getAttribute('zen-transition');
    if (!transitionName) {
      transitionCtl?.dispose();
      transitionCtl = null;
      return null;
    }
    if (!transitionCtl || transitionCtlName !== transitionName) {
      transitionCtl?.dispose();
      transitionCtl = createTransition(transitionName);
      transitionCtlName = transitionName;
    }
    return transitionCtl;
  };
  let transitionCtlName: string | null = transitionName;

  const dispose = effect(() => {
    let condition: boolean;
    try {
      condition = Boolean(evalFn(context));
    } catch (err) {
      reportError(err as Error, 'expression', { expression: expr, element: el });
      return;
    }

    if (condition && !isMounted) {
      // ── شرط true شد: mount ──
      //
      // BUG FIX (BUG-01/05): اگر در حال leave بود (race در toggle سریع)،
      // آن را cancel کن. اگر این کار را نکنیم، callback.leave بعداً
      // element را از DOM حذف می‌کند در حالی که ما آن را mount کرده‌ایم.
      if (cancelLeave) {
        cancelLeave();
        cancelLeave = null;
      }

      // کلاس‌های zen-enter-from و zen-enter-active را **قبل** از اضافه
      // شدن به DOM ست می‌کنیم (این‌طور اولین paint مرورگر حالت "from" است).
      // #47: موتور مبنا (createTransition) این کلاس‌ها را idempotent خودش
      // ست و در دو rAF به enter-to سوییچ می‌کند؛ پیش‌ست‌کردن اینجا فقط
      // برای حذف پرش بین insert و اولین rAF است.
      const controller = getTransitionController();
      if (transitionName && controller) {
        el.classList.add(transitionName);
        el.classList.add('zen-enter-from');
        el.classList.add('zen-enter-active');
      }

      parent.insertBefore(el, placeholder.nextSibling);
      isMounted = true;
      childDisposes = manageChildren();

      if (transitionName && controller) {
        controller.enter(el);
      }
    } else if (!condition && isMounted) {
      // ── شرط false شد: unmount ──
      const controller = getTransitionController();

      if (transitionName && controller) {
        // BUG FIX (BUG-01/05): isMounted را **قبل** از شروع leave
        // false می‌کنیم (نه در callback). این کار از race conditionها
        // جلوگیری می‌کند: اگر condition دوباره true شد قبل از پایان
        // انیمیشن، branch mount اجرا نمی‌شود چون cancelLeave قبلاً
        // leave را لغو کرده است. تابع cancel برگشتی را در cancelLeave
        // ذخیره می‌کنیم تا dispose/باز-mount بتواند آن را فراخوانی کند.
        isMounted = false;
        let leaveSettled = false;
        // #47: روی API مبنا — finished هم در پایان طبیعی و هم در cancel
        // resolve می‌شود؛ با flag تمایز می‌دهیم که children فقط پس از
        // پایان طبیعی dispose شوند (رفتار قبلی leaveTransition).
        const run = controller.leave(el);
        void run.finished.then(() => {
          if (leaveSettled) return;
          leaveSettled = true;
          // وقتی leave تمام شد (بدون cancel)، children را dispose کن
          // و عنصر را از DOM حذف کن.
          cancelLeave = null;
          childDisposes.forEach((d) => d());
          childDisposes = [];
          if (el.parentNode === parent) {
            parent.removeChild(el);
          }
        });
        cancelLeave = () => {
          leaveSettled = true;
          run.cancel();
        };
      } else {
        // Without transition: immediate removal.
        childDisposes.forEach((d) => d());
        childDisposes = [];
        if (el.parentNode === parent) {
          parent.removeChild(el);
        }
        isMounted = false;
      }
    }
  });

  // برگرداندن تابعی که هم Effect اصلی و هم Effectهای فرزندان فعلی را dispose می‌کند.
  // BUG FIX (BUG-01/05): ابتدا cancelLeave را فراخوانی کن تا اگر leave
  // در حال انجام است، راف‌ها/تایمر/listener/کلاس‌ها پاک شوند.
  return () => {
    if (cancelLeave) {
      cancelLeave();
      cancelLeave = null;
    }
    // #47: آزادکردن کنترلر transition (runهای فعال + listenerها).
    transitionCtl?.dispose();
    transitionCtl = null;
    childDisposes.forEach((d) => d());
    childDisposes = [];
    dispose();
  };
}
