import type { Walk } from './walk-types';
import { processIfChain } from './if-chain';
import { processNodeDirectives } from './node-directives';
import { trackDirective } from './walker-telemetry';
import { getCustomDirectiveRegistration } from './custom-directives';
import { processVirtualRepeat } from './directives/virtual-repeat';
import { processFor } from './directives/for';
import { processIf } from './directives/if';
import { processMemo } from './directives/memo';
import { processIsland } from './directives/island';
import { processStatefulButton } from './directives/stateful-button';
import { processDatePicker } from './directives/date-picker';
import { processShow } from './directives/show';
import { processAnimate } from '@zenith/transition';
import { processResource } from '@zenith/resource';
import { processFetch } from '@zenith/data';
import { processRouter } from '@zenith/router';
import { processSuspense } from '@zenith/suspense';
import { processErrorBoundary } from '@zenith/error-boundary';
import { isComponent, processComponent } from '@zenith/components';
function walk(
  node: Node,
  context: Record<string, unknown>,
  state: Record<string, unknown>,
  disposes: (() => void)[],
): void {
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const el = node as HTMLElement;

  if (el.hasAttribute('zen-virtual')) {
    // zen-virtual می‌تواند به‌تنهایی (با forExpr درون خودش) یا همراه با zen-for
    // بیاید. در هر دو حالت، processVirtualRepeat را فراخوانی می‌کنیم.
    const virtualExpr = el.getAttribute('zen-virtual')!;
    const forExpr = el.getAttribute('zen-for') || virtualExpr;

    const processChildren = (
      newNode: HTMLElement,
      localContext: Record<string, unknown>,
      itemDisposes: (() => void)[],
    ): void => {
      processNodeDirectives(newNode, { context: localContext, state, disposes: itemDisposes });
      for (const child of Array.from(newNode.children)) {
        walk(child, localContext, state, itemDisposes);
      }
    };

    disposes.push(processVirtualRepeat(el, forExpr, context, processChildren));
    return; // بقیه دایرکتیوها (از جمله zen-for) روی این عنصر پردازش نمی‌شوند.
  }

  if (el.hasAttribute('zen-for')) {
    const forExpr = el.getAttribute('zen-for')!;

    // processChildren callback: وقتی یک آیتم جدید ساخته می‌شود، فراخوانی می‌شود.
    // این callback باید فرزندان نود تازه‌ساخته‌شده را با context محلی walk کند
    // و disposes آن‌ها را در آرایه‌ی اختصاصی همان آیتم جمع کند.
    //
    // نکته: خود نود آیتم (مثل <li>) هم باید walk شود چون ممکن است روی خودش
    // دایرکتیوهایی مثل zen-bind:class یا zen-text داشته باشد. اما چون فرزندان
    // نود آیتم در walker معمول بررسی می‌شوند، کافی است خود نود و سپس فرزندانش
    // walk شوند.
    const processChildren = (
      newNode: HTMLElement,
      localContext: Record<string, unknown>,
      itemDisposes: (() => void)[],
    ): void => {
      // ابتدا دایرکتیوهای روی خود نود آیتم (مثل zen-text, zen-bind:*) را process کن.
      // این کد شبیه بخش‌های ۲-۴ در walk معمول است اما با localContext.
      processNodeDirectives(newNode, { context: localContext, state, disposes: itemDisposes });

      // سپس فرزندان را walk کن.
      for (const child of Array.from(newNode.children)) {
        walk(child, localContext, state, itemDisposes);
      }
    };

    disposes.push(processFor(el, forExpr, context, processChildren));
    return; // بقیه دایرکتیوها روی خود el پردازش نمی‌شوند.
  }

  if (el.hasAttribute('zen-if')) {
    const expr = el.getAttribute('zen-if')!;

    // IMPROVEMENT-05 (v1.0.1): بررسی zen-else-if و zen-else در sibling ها
    // اگر زنجیره if-else-if-else وجود دارد، از processIfChain استفاده می‌کنیم.
    const nextSibling = el.nextElementSibling as HTMLElement | null;
    const hasElseChain =
      nextSibling &&
      (nextSibling.hasAttribute('zen-else-if') || nextSibling.hasAttribute('zen-else'));

    if (hasElseChain) {
      // پردازش زنجیره if-else-if-else
      disposes.push(processIfChain(el, { expression: expr, context, state, walk }));
      // عناصر else-if و else توسط processIfChain مدیریت می‌شوند — از walk حذف می‌کنیم
      // با marking آنها
      let next: HTMLElement | null = nextSibling;
      while (next) {
        if (next.hasAttribute('zen-else-if') || next.hasAttribute('zen-else')) {
          next.setAttribute('data-zenith-else-handled', 'true');
          if (next.hasAttribute('zen-else')) break;
          next = next.nextElementSibling as HTMLElement | null;
        } else {
          break;
        }
      }
      // FIX (v1.2.8): P0-1 — processIfChain اکنون همه‌ی عناصر زنجیره را با
      // comment placeholder جایگزین می‌کند و فقط branch فعال را mount می‌کند.
      // نباید walk(el) را اینجا صدا بزنیم چون el دیگر در DOM نیست (با placeholder
      // جایگزین شده) و mountBranch داخل processIfChain هنگام فعال شدن branch،
      // walk را با disposes array اختصاصی آن branch صدا می‌زند. مدیریت children
      // کاملاً به processIfChain سپرده شده است.
      return;
    }

    // manageChildren یک closure است که وقتی zen-if true شود فراخوانی می‌شود.
    const manageChildren = (): (() => void)[] => {
      const childDisposes: (() => void)[] = [];
      walk(el, context, state, childDisposes);
      return childDisposes;
    };

    disposes.push(processIf(el, expr, context, manageChildren));
    return;
  }

  if (el.hasAttribute('data-zenith-else-handled')) {
    el.removeAttribute('data-zenith-else-handled');
    // FIX (v1.2.8): P0-1 — این عنصر توسط processIfChain مدیریت می‌شود و
    // احتمالاً از DOM حذف شده (با placeholder جایگزین شده). children آن توسط
    // mountBranch در processIfChain walk می‌شوند وقتی branch فعال می‌شود.
    // بنابراین اینجا فقط return می‌کنیم و چیزی walk نمی‌کنیم.
    return;
  }
  if (el.hasAttribute('zen-else') || el.hasAttribute('zen-else-if')) {
    // orphan else — نادیده بگیر و children را walk کن
    walkChildren(el, context, state, disposes);
    return;
  }

  if (isComponent(el.tagName)) {
    processComponent(
      el,
      context,
      // processChildren callback:
      // برای هر فرزند، walk را با Context مناسب فراخوانی می‌کند.
      // - isSlotContent=true → parentContext (محل استفاده)
      // - isSlotContent=false → localContext (داخل قالب کامپوننت)
      (childNode, childContext, childDisposes, _isSlotContent) => {
        walk(childNode, childContext, state, childDisposes);
      },
      disposes,
    );
    return; // فرزندان کامپوننت درون processComponent پردازش می‌شوند.
  }

  if (el.tagName.toLowerCase() === 'zen-router') {
    processRouter(
      el,
      // processChildren callback:
      // وقتی HTML جدید لود شد، فرزندان آن را با context والد walk می‌کند.
      // نکته: از walk روی خود childNode استفاده می‌کنیم (نه فقط فرزندانش)
      // تا دایرکتیوهای structural مثل zen-if روی childNode هم پردازش شوند.
      (childNode, childDisposes) => {
        walk(childNode, context, state, childDisposes);
      },
      disposes,
    );
    return;
  }

  if (el.tagName.toLowerCase() === 'zen-suspense') {
    processSuspense(
      el,
      // processChildren callback:
      (childNode, childContext, childDisposes) => {
        walk(childNode, childContext, state, childDisposes);
      },
      context,
      disposes,
    );
    return;
  }

  if (el.hasAttribute('zen-error')) {
    processErrorBoundary(
      el,
      (childNode, childDisposes) => {
        walk(childNode, context, state, childDisposes);
      },
      disposes,
    );
    return;
  }

  if (el.hasAttribute('zen-memo')) {
    const memoExpr = el.getAttribute('zen-memo')!;
    disposes.push(
      processMemo(el, memoExpr, context, (nodeEl, nodeCtx, nodeDisposes) => {
        processNodeDirectives(nodeEl, { context: nodeCtx, state, disposes: nodeDisposes });
        for (const child of Array.from(nodeEl.children)) {
          walk(child, nodeCtx, state, nodeDisposes);
        }
      }),
    );
    return;
  }

  if (el.tagName.toLowerCase() === 'zen-date-picker') {
    disposes.push(processDatePicker(el, context));
    // نیازی به return نیست؛ فرزندان (در صورت وجود) به‌صورت عادی walk می‌شوند.
  }

  if (el.hasAttribute('zen-island')) {
    const hydrateMode = el.getAttribute('zen-island') || 'load';
    disposes.push(
      processIsland(el, hydrateMode, context, (nodeEl, nodeCtx, nodeDisposes) => {
        processNodeDirectives(nodeEl, { context: nodeCtx, state, disposes: nodeDisposes });
        for (const child of Array.from(nodeEl.children)) {
          walk(child, nodeCtx, state, nodeDisposes);
        }
      }),
    );
    return;
  }

  if (el.hasAttribute('zen-button')) {
    const actionName = el.getAttribute('zen-button') || '';
    const loadingText = el.getAttribute('data-loading-text');
    disposes.push(processStatefulButton(el, actionName, loadingText, context));
    return;
  }

  const customReg = getCustomDirectiveRegistration(el.tagName.toLowerCase());
  if (customReg) {
    const configAttrValue = el.getAttribute(customReg.attributeName);
    disposes.push(customReg.handler(el, configAttrValue, context, state));
    return; // فرزندان توسط handler خودش مدیریت می‌شوند.
  }

  if (el.hasAttribute('zen-resource')) {
    const resourceExpr = el.getAttribute('zen-resource')!;
    processResource(
      el,
      resourceExpr,
      context,
      (childNode, childContext, childDisposes) => {
        walk(childNode, childContext, state, childDisposes);
      },
      disposes,
    );
    return;
  }

  if (el.hasAttribute('zen-fetch')) {
    const fetchExpr = el.getAttribute('zen-fetch')!;
    processFetch(
      el,
      fetchExpr,
      context,
      // processChildren callback:
      // فرزندان با Context محلی (شامل $<stateName>) walk می‌شوند.
      // نکته: از walk روی خود childNode استفاده می‌کنیم (نه فقط فرزندانش)
      // تا دایرکتیوهای structural مثل zen-if روی childNode هم پردازش شوند.
      (childNode, childContext, childDisposes) => {
        walk(childNode, childContext, state, childDisposes);
      },
      disposes,
    );
    return;
  }

  if (el.hasAttribute('zen-show')) {
    const showExpr = el.getAttribute('zen-show')!;
    disposes.push(processShow(el, showExpr, context));
    // FEATURE (v0.4.0): ثبت در گراف DevTools (zero-cost وقتی غیرفعال).
    trackDirective(el, { directiveType: 'show', expression: showExpr });
  }

  if (el.hasAttribute('zen-animate')) {
    const animateAttr = el.getAttribute('zen-animate')!;
    disposes.push(processAnimate(el, animateAttr, context));
    // FEATURE (v0.4.0): ثبت در گراف DevTools (zero-cost وقتی غیرفعال).
    trackDirective(el, { directiveType: 'animate', expression: animateAttr });
  }

  processNodeDirectives(el, { context, state, disposes });

  walkChildren(el, context, state, disposes);
}

function walkChildren(
  el: HTMLElement,
  context: Record<string, unknown>,
  state: Record<string, unknown>,
  disposes: (() => void)[],
): void {
  // Array.from برای جلوگیری از تغییر Collection در حین iteration
  // (مثلاً وقتی zen-if یک عنصر را اضافه/حذف می‌کند)
  for (const child of Array.from(el.children)) {
    walk(child, context, state, disposes);
  }
}

/** Return the same recursive traversal; no public root or new global registry. @internal */
export function createTreeWalker(): Walk { return walk; }
