// content.js — Content script for Zenith DevTools v1.0.0.
//
// ارتباط با window.__ZENITH__ و ارسال اطلاعات به popup.
//
// FEATURE (v1.0.0): داده‌های جدید اضافه شده:
//   - staticFors: لیست zen-for های با zen-static fast path
//   - destroyedResources: لیست Resource های destroy شده
//   - cacheStats: آمار cache برای compileExpression
//   - activeSSRStores: لیست SSR stores فعال
//
// BUG-DEVTEXT-03: اصلاح sendResponse برای جلوگیری از نگه‌داشتن
// message channel بیشتر از حد نیاز. چون تمام عملیات هم‌زمان
// (synchronous) هستند، نیازی به return true نیست.

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'ZENITH_CHECK' || request.type === 'ZENITH_REFRESH') {
    const hook = window.__ZENITH__;

    if (!hook) {
      sendResponse({ installed: false });
      return; // synchronous — نیازی به return true نیست
    }

    // گرفتن اطلاعات از DevTools hook.
    const signals = hook.getSignals ? hook.getSignals() : [];
    const timeline = hook.getTimeline ? hook.getTimeline(50) : [];

    // گرفتن component information.
    const components = [];
    if (hook.components && hook.components instanceof Map) {
      for (const [name, template] of hook.components.entries()) {
        // شمارش تعداد استفاده از این کامپوننت در DOM.
        const used = document.querySelectorAll(name).length;
        components.push({ name, used, hasTemplate: !!template });
      }
    }

    // گرفتن effect information (اگر DevTools expose کرده باشد).
    const effects = [];
    if (hook.getEffects) {
      effects.push(...hook.getEffects());
    }

    // ── FEATURE (v1.0.0): داده‌های جدید ──

    // zen-static fast path لیست
    const staticFors = hook.getStaticFors ? hook.getStaticFors() : [];

    // Resource های destroy شده
    const destroyedResources = hook.getDestroyedResources ? hook.getDestroyedResources() : [];

    // آمار cache برای compileExpression
    const cacheStats = hook.getCacheStats ? hook.getCacheStats() : null;

    // SSR stores فعال
    const activeSSRStores = hook.getActiveSSRStores ? hook.getActiveSSRStores() : [];

    sendResponse({
      installed: true,
      version: hook.version || 'unknown',
      signalCount: signals.length,
      signals: signals.map(s => ({
        id: s.id,
        name: s.name,
        value: s.value,
        subscriberCount: s.subscriberCount,
      })),
      timeline: timeline.map(c => ({
        signalId: c.signalId,
        signalName: c.signalName,
        oldValue: c.oldValue,
        newValue: c.newValue,
        timestamp: c.timestamp,
      })),
      components,
      effects,
      // FEATURE (v1.0.0): داده‌های جدید
      staticFors,
      destroyedResources,
      cacheStats,
      activeSSRStores,
    });
    return; // synchronous
  }

  if (request.type === 'ZENITH_CLEAR') {
    const hook = window.__ZENITH__;
    if (hook && hook.clearTimeline) {
      hook.clearTimeline();
    }
    if (hook && hook.clearDependencyGraph) {
      hook.clearDependencyGraph();
    }
    sendResponse({ success: true });
    return; // synchronous
  }

  // برای message type های ناشناخته، sendResponse فراخوانی نمی‌شود
  // و false برمی‌گردانیم تا channel بسته شود.
});
