// packages/components/src/registry.ts
import { developerError, ErrorCode, deprecate, onGlobalReset } from '@zenith/errors';
//
// Component Registry — ثبت و بازیابی قالب‌های کامپوننت‌ها.
//
// ایده:
//   کاربر در HTML تعریف می‌کند:
//     <zen-component name="app-product-card">
//       <template> ... </template>
//     </zen-component>
//   سپس در همان HTML از تگ <app-product-card> استفاده می‌کند.
//   در زمان Zen.start، تابع loadComponents تمام تعاریف را پیدا کرده و
//   قالب‌های (HTMLTemplateElement) آن‌ها را در این Registry ذخیره می‌کند.
//
// نکته‌ی مهم: ما از Light DOM استفاده می‌کنیم (نه Shadow DOM) چون:
//   1) Event Delegation روی document به درستی کار می‌کند.
//   2) استایل‌های global CSS روی محتوای کامپوننت اعمال می‌شوند.
//   3) ساده‌تر و سریع‌تر است.

/**
 * قالب یک کامپوننت.
 *
 * ما فقط HTMLTemplateElement را نگه می‌داریم چون:
 *   - content آن در DocumentFragment است (در DOM فعلی نیست).
 *   - هر بار که کامپوننت استفاده می‌شود، content.cloneNode(true) یک کپی
 *     تازه به ما می‌دهد که می‌توانیم بدون تأثیر روی قالب اصلی، آن را
 *     تغییر دهیم (پر کردن slotها، اضافه کردن Props و …).
 *
 * IMP-COM-01 (v1.3.0): Added TypeScript generics for strong-typed
 * component definitions. Users can now use:
 *   type ProductCardProps = { productId: number; theme?: string };
 *   const def: ComponentDefinition<ProductCardProps> = { ... };
 */
export interface ComponentDefinition<TProps extends Record<string, any> = Record<string, any>> {
  /** نام کامپوننت (lowercase). مثلا "app-product-card". */
  name: string;
  /** قالب HTML کامپوننت. */
  template: HTMLTemplateElement;
  /** (اختیاری) Props پیش‌فرض برای تایپ‌سیفتی در زمان استفاده. */
  props?: TProps;
}

// ── مخزن داخلی کامپوننت‌ها ──
//
// چرا Map و نه Plain Object؟
//   - کلیدها می‌توانند هر رشته‌ای باشند (حتی "__proto__").
//   - API واضح‌تر است (has/get/set/delete).
//   - در آینده می‌توانیم metadata بیشتری ذخیره کنیم.
//
// نکته (فاز ۱۰): این Map به‌صورت export شده تا DevTools بتواند آن را بازرسی کند.
export const componentRegistry = new Map<string, HTMLTemplateElement>();

/**
 * #92 — ایزولاسیون رجیستری کامپوننت‌ها در SSR هم‌زمان.
 * اگر provider توسط `@zenith/ssr` نصب شده باشد و یک Map مخصوص درخواست جاری
 * برگرداند، عملیات ثبت/حذف/پاکسازی روی همان Map درخواست انجام می‌شود و
 * خواندن (`getComponent`/`isComponent`) ابتدا Map درخواست و سپس
 * `componentRegistry` سراسری را بررسی می‌کند.
 */
let _componentStoreProvider: (() => Map<string, HTMLTemplateElement> | null) | null = null;

export function setComponentRegistryStore(
  provider: (() => Map<string, HTMLTemplateElement> | null) | null,
): void {
  _componentStoreProvider = provider;
}

function getActiveComponentMap(): Map<string, HTMLTemplateElement> {
  return _componentStoreProvider?.() ?? componentRegistry;
}

/**
 * Type guard برای تشخیص HTMLTemplateElement.
 *
 * از instanceof استفاده نمی‌کنیم چون:
 *   - در محیط‌های غیر مرورگر (Node.js + jsdom)، HTMLTemplateElement ممکن
 *     است روی window جsdوم تعریف شده باشد اما روی global نباشد.
 *   - instanceof در چند realm (مثلاً main + iframe) هم می‌تواند false برگرداند.
 *
 * Duck typing: یک HTMLTemplateElement ویژگی `content` (DocumentFragment) دارد
 * و nodeName آن 'TEMPLATE' است.
 */
function isHTMLTemplateElement(value: any): value is HTMLTemplateElement {
  return (
    value !== null &&
    typeof value === 'object' &&
    value.nodeName === 'TEMPLATE' &&
    'content' in value
  );
}

/**
 * ثبت یک کامپوننت.
 *
 * نام به‌صورت خودکار lowercase می‌شود چون HTML تگ‌ها را case-insensitive می‌کند.
 * اگر کامپوننت با همین نام از قبل ثبت شده بود، بدون هشدار overwrite می‌شود
 * (این رفتار برای HMR مطلوب است).
 *
 * @param name     نام کامپوننت (مثلا "app-product-card").
 * @param template قالب HTML کامپوننت.
 * @returns #116 cleanup protocol: یک `Cleanup` idempotent که فقط در صورتی
 *           نام را حذف می‌کند که همان template هنوز ثبت باشد.
 */
export function registerComponent(name: string, template: HTMLTemplateElement): () => void {
  if (typeof name !== 'string' || name.length === 0) {
    throw developerError(
      `Component name must be a non-empty string. Received: ${String(name)}`,
      ErrorCode.INTERNAL_DEVELOPER_ERROR,
    );
  }
  if (!isHTMLTemplateElement(template)) {
    throw developerError(
      `Component "${name}" requires an HTMLTemplateElement.`,
      ErrorCode.RUNTIME_COMPONENT_NOT_FOUND,
    );
  }
  const key = name.toLowerCase();
  const targetMap = getActiveComponentMap();
  targetMap.set(key, template);
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    if (targetMap.get(key) === template) {
      targetMap.delete(key);
    }
  };
}

/**
 * حذف یک کامپوننت از Registry.
 */
export function unregisterComponent(name: string): boolean {
  return getActiveComponentMap().delete(name.toLowerCase());
}

/**
 * دریافت قالب یک کامپوننت.
 *
 * @returns قالب یا `undefined` اگر ثبت نشده باشد.
 */
export function getComponent(name: string): HTMLTemplateElement | undefined {
  const key = name.toLowerCase();
  const scoped = _componentStoreProvider?.();
  if (scoped && scoped.has(key)) {
    return scoped.get(key);
  }
  return componentRegistry.get(key);
}

/**
 * بررسی اینکه آیا یک تگ به‌عنوان کامپوننت ثبت شده است.
 *
 * این تابع توسط walker استفاده می‌شود تا تشخیص دهد آیا تگ فعلی (مثلا
 * <app-product-card>) یک کامپوننت است یا یک تگ HTML معمولی.
 */
export function isComponent(name: string): boolean {
  const key = name.toLowerCase();
  const scoped = _componentStoreProvider?.();
  if (scoped && scoped.has(key)) {
    return true;
  }
  return componentRegistry.has(key);
}

/** #118: بررسی وجود کامپوننت ثبت‌شده (`hasX`). */
export function hasComponent(name: string): boolean {
  return isComponent(name);
}

/** #118: فهرست نام تمام کامپوننت‌های ثبت‌شده (`listXs`). */
export function listComponents(): string[] {
  const keys = new Set<string>(componentRegistry.keys());
  const scoped = _componentStoreProvider?.();
  if (scoped) {
    for (const k of scoped.keys()) keys.add(k);
  }
  return Array.from(keys);
}

/**
 * پاکسازی کل Registry (فقط برای تست‌ها و teardown کامل).
 *
 * ⚠️ در Production استفاده نکنید.
 */
export function clearComponents(): void {
  deprecate('ZEN-DEPR-055', 'clearComponents', 'resetForTesting() (@zenith/testing)');
  clearComponentsInternal();
}

/**
 * #118: پاک‌سازی داخلی بدون هشدار (هوک ریست سراسری).
 */
export function clearComponentsInternal(): void {
  getActiveComponentMap().clear();
}

/* @__PURE__ */ onGlobalReset(clearComponentsInternal);

// ─────────────────────────────────────────────────────────────────────────
// BUG-COM-01 (v1.3.0): Component Lifecycle Tracking with MutationObserver
// ─────────────────────────────────────────────────────────────────────────
//
// Previously, when a component element was removed from the DOM (e.g. by an
// zen-if toggle, a route change, or manual DOM manipulation), the component's
// internal state (effects, signal subscriptions, event listeners) was never
// cleaned up. This led to memory leaks: the component's closure stayed alive
// through signal subscriptions, and the effects continued running even though
// the DOM was gone.
//
// The fix uses a MutationObserver on document.body (if available) to detect
// removed component elements and call their registered dispose function
// automatically. The WeakMap ensures no strong reference is kept to the
// element, so the GC can collect it normally.

const componentDisposes = new WeakMap<HTMLElement, () => void>();
let _lifecycleObserver: MutationObserver | null = null;

/**
 * Track a component element so its dispose function is called when it
 * leaves the DOM. Registered via MutationObserver on document.body.
 *
 * Usage from processor.ts:
 *   trackComponentLifecycle(componentEl, () => {
 *     // cleanup effects, signal subscriptions, etc.
 *   });
 */
export function trackComponentLifecycle(element: HTMLElement, dispose: () => void): void {
  componentDisposes.set(element, dispose);

  // Start the MutationObserver on the first call if not already running.
  if (
    !_lifecycleObserver &&
    typeof MutationObserver !== 'undefined' &&
    typeof document !== 'undefined' &&
    document.body
  ) {
    _lifecycleObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const removedNode of mutation.removedNodes) {
          if (typeof HTMLElement === 'undefined' || !(removedNode instanceof HTMLElement)) continue;
          // Direct match.
          const cleanup = componentDisposes.get(removedNode);
          if (cleanup) {
            cleanup();
            componentDisposes.delete(removedNode);
          }
          // Descendant components under the removed subtree.
          const descendants = removedNode.querySelectorAll('[data-zenith-component]');
          for (let i = 0; i < descendants.length; i++) {
            const desc = descendants[i] as HTMLElement;
            const d = componentDisposes.get(desc);
            if (d) {
              d();
              componentDisposes.delete(desc);
            }
          }
        }
      }
    });
    _lifecycleObserver.observe(document.body, { childList: true, subtree: true });
  }
}

/**
 * Stop the lifecycle observer. Useful for test teardown and HMR
 * cleanup.
 */
export function stopComponentTracking(): void {
  if (_lifecycleObserver) {
    _lifecycleObserver.disconnect();
    _lifecycleObserver = null;
  }
}

/**
 * BUG-COM-01 / IMP-COM-01 (v1.3.0): Define a component with full
 * type-safe configuration including lifecycle hooks and typed props.
 *
 * Usage:
 * ```typescript
 * defineComponent<ProductCardProps>('app-product-card', template, {
 * lifecycle: {
 *   onMount() { logger.debug('mounted'); },
 *   onDestroy() { logger.debug('destroyed'); },
 * },
 * });
 * ```
 *
 * @param name     Component tag name (lowercase, e.g. "app-product-card").
 * @param template The <template> element.
 * @param options  Optional configuration (props type info, lifecycle hooks).
 * @returns The ComponentDefinition for chaining / introspection.
 */
export function defineComponent<TProps extends Record<string, any> = Record<string, any>>(
  name: string,
  template: HTMLTemplateElement,
  options?: {
    props?: TProps;
    lifecycle?: {
      onMount?: () => void | (() => void);
      onDestroy?: () => void;
    };
  },
): ComponentDefinition<TProps> {
  registerComponent(name, template);

  // Store lifecycle hooks so processor.ts can read them later.
  // We use the processor.ts module-level store to avoid duplicating state.
  // This works because lifecycleHooks is exported from processor.ts and
  // processor.ts imports from us — not the other way around.
  if (options?.lifecycle && typeof options.lifecycle === 'object') {
    const { onMount, onDestroy } = options.lifecycle;
    if (typeof onMount === 'function' || typeof onDestroy === 'function') {
      // Lazy-import from processor: this works because processor imports
      // from registry, not the reverse. The import is resolved at module
      // load time (before any user code runs), so it's safe.
      try {
        // Dynamic import to avoid static circular dependency at module
        // resolution time. The actual resolution still happens once.
        import('./processor')
          .then((processor) => {
            processor.registerLifecycle(name, { onMount, onDestroy });
          })
          .catch(() => {
            // processor not yet available — silently skip; lifecycle hooks
            // only activate when processComponent() runs later.
          });
      } catch {
        // processor not yet available — silently skip; lifecycle hooks
        // only activate when processComponent() runs later.
      }
    }
  }

  return { name, template, props: options?.props as TProps | undefined };
}
