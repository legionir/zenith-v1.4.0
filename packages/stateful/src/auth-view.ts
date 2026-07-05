// packages/stateful/src/auth-view.ts
//
// FEATURE (v0.6.0): zen-auth-view — کامپوننت Stateful برای نمایش
// محتوای متمایز بر اساس وضعیت Authentication کاربر.
//
// ── سینتکس ──
//
//   <zen-auth-view config="$auth">
//     <template slot="authenticated">
//       <div>خوش آمدید، <span zen-text="$auth.user.name"></span></div>
//       <button zen-action="authLogout">خروج</button>
//     </template>
//     <template slot="guest">
//       <div>لطفاً وارد شوید</div>
//       <a href="/login">ورود</a>
//     </template>
//   </zen-auth-view>
//
// ─ـ پیش‌نیازها ──
//
//   کاربر باید یک Auth instance در State خود قرار دهد:
//
//   import { createAuth } from '@zenith/auth';
//   const auth = createAuth({ loginUrl: '/api/auth/login', ... });
//   Zen.start(app, { auth });  // ← auth.signal به‌صورت $auth در context
//
// ── رفتار ──
//
//   ۱) یک Effect روی `auth.signal` (یا auth signal ارجاع‌شده) می‌گذارد.
//   ۲) هر بار که `isAuthenticated` تغییر کند:
//      - اگر true → template با `slot="authenticated"` render می‌شود.
//      - اگر false → template با `slot="guest"` render می‌شود.
//   ۳) هنگام transition، محتوای قبلی dispose می‌شود (effectهای فرزندان)
//      و محتوای جدید با walkAndBind پردازش می‌شود.
//
// ── نکات ──
//
//   - کاربر می‌تواند به‌جای Auth instance، مستقیماً Signal<AuthState> هم
//     پاس بدهد. ما هر دو را پشتیبانی می‌کنیم.
//   - اگر هیچ template برای slot فعلی وجود نداشت، محتوای element خالی
//     می‌ماند (نه خطا).
//   - SSR-safe: بدون document، no-op می‌شود.

import { effect, type Signal } from '@zenith/state';
import { walkAndBind } from '@zenith/runtime';
import type { AuthState } from '@zenith/auth';

/**
 * حداقل امضای یک Auth instance.
 * duck typing — به جای import کردن کلاس Auth.
 */
interface AuthLike {
  readonly signal: Signal<AuthState>;
  readonly isAuthenticated: boolean;
}

/**
 * Type guard: بررسی اینکه آیا مقدار یک Auth instance است.
 */
function isAuthLike(value: any): value is AuthLike {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.signal === 'object' &&
    value.signal !== null &&
    typeof value.signal.get === 'function'
  );
}

/**
 * Type guard: بررسی اینکه آیا مقدار یک Signal<AuthState> است.
 */
function isAuthSignal(value: any): value is Signal<AuthState> {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.get === 'function' &&
    typeof value.set === 'function'
  );
}

/**
 * پردازشگر دایرکتیو zen-auth-view.
 *
 * @param el         عنصر <zen-auth-view>.
 * @param configAttr مقدار attribute `config` (مثلاً `"$auth"`).
 * @param context    Context والد.
 * @param state      State اصلی (شامل Auth instance).
 * @returns تابع Dispose.
 */
export function processAuthView(
  el: HTMLElement,
  configAttr: string | null,
  context: Record<string, any>,
  state: Record<string, any>,
): () => void {
  // SSR-safe guard.
  if (typeof document === 'undefined') {
    return () => {};
  }

  // ── ۱. اعتبارسنجی config attribute ──
  if (!configAttr || configAttr.trim().length === 0) {
    console.warn('[zen-auth-view] Missing or empty `config` attribute.');
    return () => {};
  }
  const refName = configAttr.startsWith('$') ? configAttr : `$${configAttr}`;

  // FEATURE (v0.6.0): استخراج Auth از context.
  // کاربر می‌تواند یا Auth instance را در state بگذارد (که به‌صورت plain
  // object در context قرار می‌گیرد) یا Signal<AuthState> را. هر دو را
  // پشتیبانی می‌کنیم.
  const ref = (context as Record<string, any>)[refName];

  let authSignal: Signal<AuthState>;
  if (isAuthLike(ref)) {
    // Auth instance.
    authSignal = ref.signal;
  } else if (isAuthSignal(ref)) {
    // مستقیماً Signal<AuthState>.
    authSignal = ref;
  } else {
    console.warn(
      `[zen-auth-view] Auth "${configAttr}" not found in context or is neither an Auth instance nor a Signal<AuthState>. ` +
      `Example: Zen.start(app, { auth: createAuth({...}) });`,
    );
    return () => {};
  }

  // ─ـ ۲. استخراج templateهای slot ─ـ
  // دو slot داریم: "authenticated" و "guest".
  // کاربر باید <template slot="authenticated"> و <template slot="guest"> قرار دهد.
  const templates = el.querySelectorAll(':scope > template[slot]');
  let authenticatedTemplate: HTMLTemplateElement | null = null;
  let guestTemplate: HTMLTemplateElement | null = null;
  for (const tpl of Array.from(templates)) {
    const slotName = tpl.getAttribute('slot');
    if (slotName === 'authenticated') {
      authenticatedTemplate = tpl as HTMLTemplateElement;
    } else if (slotName === 'guest') {
      guestTemplate = tpl as HTMLTemplateElement;
    }
  }
  // حذف templateها از DOM چون ما خودمان clone می‌کنیم.
  if (authenticatedTemplate) authenticatedTemplate.remove();
  if (guestTemplate) guestTemplate.remove();

  if (!authenticatedTemplate && !guestTemplate) {
    console.warn(
      '[zen-auth-view] No <template slot="authenticated"> or <template slot="guest"> found. ' +
      'Provide at least one:\n' +
      '  <zen-auth-view config="$auth">\n' +
      '    <template slot="authenticated">...</template>\n' +
      '    <template slot="guest">...</template>\n' +
      '  </zen-auth-view>',
    );
    return () => {};
  }

  // ── ۳. آماده‌سازی container ──
  el.innerHTML = '';

  // dispose تابع فعلی (که فرزندان رندرشده را پاکسازی می‌کند).
  let currentDispose: (() => void) | null = null;
  // slot فعلی برای جلوگیری از re-render تکراری.
  let currentSlot: 'authenticated' | 'guest' | null = null;

  /**
   * render کردن یک template خاص با walkAndBind.
   */
  function renderSlot(
    slotName: 'authenticated' | 'guest',
    template: HTMLTemplateElement | null,
  ): void {
    // اگر slot فعلی همان است، کاری نکن (جلوگیری از re-render تکراری).
    if (currentSlot === slotName) return;

    // پاکسازی slot قبلی.
    if (currentDispose) {
      try { currentDispose(); } catch (err) {
        console.error('[zen-auth-view] Error during previous slot dispose:', err);
      }
      currentDispose = null;
    }
    el.innerHTML = '';
    currentSlot = slotName;

    // اگر template نبود، خالی بگذار.
    if (!template) return;

    // clone کردن محتوای template.
    const clone = template.content.cloneNode(true) as DocumentFragment;

    // FEATURE (v0.6.0): walk کردن clone با parent state.
    // نکته: walkAndBind یک context تازه از state می‌سازد. ما state والد را
    // پاس می‌دهیم تا $auth, $user و سایر کلیدها در دسترس باشند.
    // اما چون clone یک DocumentFragment است (نه HTMLElement)، آن را در یک
    // wrapper قرار می‌دهیم.
    const wrapper = document.createElement('div');
    wrapper.className = 'zen-auth-slot';
    wrapper.setAttribute('data-slot', slotName);
    wrapper.appendChild(clone);

    // walk کردن wrapper.
    const childDispose = walkAndBind(wrapper, state);
    el.appendChild(wrapper);

    currentDispose = childDispose;
  }

  // ── ۴. Effect اصلی: watch کردن authSignal ──
  const disposeEffect = effect(() => {
    const authState = authSignal.get();
    if (authState && authState.isAuthenticated) {
      renderSlot('authenticated', authenticatedTemplate);
    } else {
      renderSlot('guest', guestTemplate);
    }
  });

  // ── ۵. تابع Dispose کل ──
  return () => {
    try { disposeEffect(); } catch (err) {
      console.error('[zen-auth-view] Error during effect dispose:', err);
    }
    if (currentDispose) {
      try { currentDispose(); } catch (err) {
        console.error('[zen-auth-view] Error during slot dispose:', err);
      }
      currentDispose = null;
    }
    el.innerHTML = '';
    currentSlot = null;
  };
}
