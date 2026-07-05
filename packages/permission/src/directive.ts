// packages/permission/src/directive.ts
//
// دایرکتیوهای zen-permission و zen-role.
//
// این دایرکتیوها عناصر را بر اساس دسترسی کاربر نمایش/پنهان می‌کنند.
// اگر کاربر دسترسی نداشته باشد، عنصر از DOM حذف می‌شود.
//
// سینتکس:
//   <button zen-permission="users:delete">Delete</button>
//   <div zen-role="admin">Admin Panel</div>
//
// با fallback:
//   <div zen-permission="users:edit">
//     <button>Edit</button>
//     <template zen-fallback>
//       <p>شما دسترسی ویرایش ندارید</p>
//     </template>
//   </div>

import { effect } from '@zenith/state';
import { getPermissionManager } from './permission';
// SEC FIX (v1.2.6): SEC-A12 — sanitize the fallback template's innerHTML before
// injecting it. The fallback content comes from the same DOM tree the
// directive walks (so it's trusted-author markup), but if an attacker ever
// manages to inject a `<template zen-fallback>` into the page (e.g. via an
// unsanitized user-content render path), the previous code would have copied
// that markup verbatim into a live div — XSS at denial time. @zenith/security
// has no runtime imports, so this does not create a circular dependency.
import { sanitizeHTML } from '@zenith/security';

/**
 * پردازش دایرکتیو zen-permission.
 *
 * @param el    عنصر.
 * @param expr  Expression دسترسی (مثل "users:delete" یا "any:a,b").
 * @returns تابع dispose.
 */
export function processPermission(
  el: HTMLElement,
  expr: string,
): () => void {
  // FIX (v1.2.3): جایگزینی `display:none` با DOM removal واقعی.
  // قبلاً برای deny فقط `el.style.display = 'none'` ست می‌شد که عنصر را در DOM
  // نگه می‌داشت (و باعث می‌شد Effectها/Event Listenerهای داخلی همچنان فعال
  // بمانند). حالا children را در یک DocumentFragment ذخیره می‌کنیم و آن‌ها را
  // از DOM حذف می‌کنیم. هنگام grant، از همان Fragment restore می‌کنیم.
  const fallbackTemplate = el.querySelector(':scope > template[zen-fallback]') as HTMLTemplateElement | null;
  let fallbackEl: HTMLElement | null = null;
  if (fallbackTemplate) {
    fallbackEl = document.createElement('div');
    fallbackEl.style.display = 'none';
    // SEC FIX (v1.2.6): SEC-A12 — sanitize fallback markup before injecting.
    fallbackEl.innerHTML = sanitizeHTML(fallbackTemplate.innerHTML);
    el.appendChild(fallbackEl);
    fallbackTemplate.remove();
  }

  // FIX (v1.2.3): DocumentFragment برای ذخیره‌ی children هنگام deny.
  // شامل همه‌ی child node ها (Element + Text + Comment) به‌جز fallbackEl.
  let savedFragment: DocumentFragment | null = null;
  const collectChildren = (): DocumentFragment => {
    const frag = document.createDocumentFragment();
    // Array.from چون NodeList زنده است و هنگام append تغییر می‌کند.
    const nodes = Array.from(el.childNodes).filter(n => n !== fallbackEl);
    for (const n of nodes) frag.appendChild(n);
    return frag;
  };
  const restoreChildren = (frag: DocumentFragment): void => {
    el.appendChild(frag);
  };

  const dispose = effect(() => {
    const manager = getPermissionManager();
    // SEC FIX (v1.2.6): SEC-A5 — fail-closed when no manager is registered.
    // Previously `manager ? … : true` granted access to everyone if the
    // directive ran before createPermissionManager() (or after the registry
    // was cleared). Now we deny and show the fallback, matching the new
    // createGuard() default.
    const hasAccess = manager ? manager.checkPermission(expr) : false;
    if (!manager) {
      console.error('[Zenith Permission] zen-permission directive: no PermissionManager registered — failing closed (showing fallback).');
    }

    if (hasAccess) {
      // نمایش محتوای اصلی، پنهان کردن fallback.
      // FIX (v1.2.3): اگر قبلاً children را در Fragment ذخیره کرده‌ایم، restore کن.
      if (savedFragment) {
        restoreChildren(savedFragment);
        savedFragment = null;
      }
      if (fallbackEl) fallbackEl.style.display = 'none';
    } else {
      // FIX (v1.2.3): DOM removal به‌جای display:none.
      // children را در DocumentFragment ذخیره کن تا بعداً بتوانیم restore کنیم.
      if (!savedFragment) {
        savedFragment = collectChildren();
      }
      if (fallbackEl) fallbackEl.style.display = '';
    }
  });

  return dispose;
}

/**
 * پردازش دایرکتیو zen-role.
 *
 * @param el    عنصر.
 * @param expr  Expression role (مثل "admin" یا "any:admin,editor").
 * @returns تابع dispose.
 */
export function processRole(
  el: HTMLElement,
  expr: string,
): () => void {
  // FIX (v1.2.3): جایگزینی `display:none` با DOM removal واقعی (همانند processPermission).
  const fallbackTemplate = el.querySelector(':scope > template[zen-fallback]') as HTMLTemplateElement | null;
  let fallbackEl: HTMLElement | null = null;
  if (fallbackTemplate) {
    fallbackEl = document.createElement('div');
    fallbackEl.style.display = 'none';
    // SEC FIX (v1.2.6): SEC-A12 — sanitize fallback markup before injecting.
    fallbackEl.innerHTML = sanitizeHTML(fallbackTemplate.innerHTML);
    el.appendChild(fallbackEl);
    fallbackTemplate.remove();
  }

  // FIX (v1.2.3): DocumentFragment برای ذخیره‌ی children هنگام deny.
  let savedFragment: DocumentFragment | null = null;
  const collectChildren = (): DocumentFragment => {
    const frag = document.createDocumentFragment();
    const nodes = Array.from(el.childNodes).filter(n => n !== fallbackEl);
    for (const n of nodes) frag.appendChild(n);
    return frag;
  };
  const restoreChildren = (frag: DocumentFragment): void => {
    el.appendChild(frag);
  };

  const dispose = effect(() => {
    const manager = getPermissionManager();
    // SEC FIX (v1.2.6): SEC-A5 — fail-closed when no manager is registered.
    const hasAccess = manager ? manager.checkRole(expr) : false;
    if (!manager) {
      console.error('[Zenith Permission] zen-role directive: no PermissionManager registered — failing closed (showing fallback).');
    }

    if (hasAccess) {
      // FIX (v1.2.3): restore children از DocumentFragment.
      if (savedFragment) {
        restoreChildren(savedFragment);
        savedFragment = null;
      }
      if (fallbackEl) fallbackEl.style.display = 'none';
    } else {
      // FIX (v1.2.3): DOM removal به‌جای display:none.
      if (!savedFragment) {
        savedFragment = collectChildren();
      }
      if (fallbackEl) fallbackEl.style.display = '';
    }
  });

  return dispose;
}
