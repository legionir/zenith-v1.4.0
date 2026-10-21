// packages/components/src/processor-lifecycle.ts
//
// رجیستری lifecycle-hookهای کامپوننت — استخراج مکانیکی از processor.ts بدون
// تغییر رفتار (#40، code-first: نوشته‌شده، اجرا نشده).


// ─────────────────────────────────────────────────────────────────────────
// IMP-COM-02 (v1.3.0): Lifecycle Hooks Registry
// ─────────────────────────────────────────────────────────────────────────
//
// Lifecycle hooks allow component authors to run code at specific points
// in the component lifecycle:
//   - onMount:   Called after the component template has been cloned and
//                inserted into the DOM, but before the walker processes
//                its children. If it returns a function, that function is
//                registered as the dispose/cleanup callback.
//   - onDestroy: Called when the component element is removed from the DOM
//                (via the MutationObserver in registry.ts).
//
// Hooks are registered via registerLifecycle() and applied by
// processComponent() when it processes a component element.
export interface ComponentLifecycle {
  onMount?: () => void | (() => void);
  onDestroy?: () => void;
  onUpdate?: (props: Record<string, unknown>) => void;
}

export const lifecycleHooks = new Map<string, ComponentLifecycle>();

/**
 * Register lifecycle hooks for a component.
 * Used by registry.ts: defineComponent() and by direct API calls.
 *
 * #116 cleanup protocol: خروجی یک `Cleanup` idempotent است که فقط در صورتی
 * hooks را حذف می‌کند که همان شیء hooks هنوز ثبت باشد.
 */
export function registerLifecycle(name: string, hooks: ComponentLifecycle): () => void {
  const key = name.toLowerCase();
  lifecycleHooks.set(key, hooks);
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    if (lifecycleHooks.get(key) === hooks) {
      lifecycleHooks.delete(key);
    }
  };
}

/**
 * Get lifecycle hooks for a component (if registered).
 */
export function getLifecycle(name: string): ComponentLifecycle | undefined {
  return lifecycleHooks.get(name.toLowerCase());
}