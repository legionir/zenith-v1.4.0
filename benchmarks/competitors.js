// benchmarks/competitors.js
// #86 — مقایسه با کتابخانه‌های واقعی، نه بازپیاده‌سازی «به‌سبکِ» آن‌ها.
//
// چرا: نسخهٔ قبلی سوئیت، یک سیگنال «Solid-style» و یک «Preact-style» دست‌ساز را
// می‌سنجید؛ آن اعداد هیچ ادعایی دربارهٔ خود Solid/Preact اثبات نمی‌کردند. اکنون
// هر ردیف مقایسه از پکیج واقعی (نسخهٔ نصب‌شده، در گزارش ثبت می‌شود) می‌آید:
//   solid-js          → createSignal / createMemo
//   @vue/reactivity   → ref / computed / effect
//   @preact/signals-core → signal / computed / effect
import { installedVersion } from './lib/env.mjs';

/** پکیج‌های مرجع (نام انتشار → برچسب کوتاه در گزارش). */
export const COMPETITOR_PACKAGES = {
  solid: 'solid-js',
  vue: '@vue/reactivity',
  preact: '@preact/signals-core',
};

/** بیلد بارگذاری‌شدهٔ هر پکیج — برای شفافیت در گزارش/سند. */
export const COMPETITOR_BUILDS = {
  solid: 'solid-js/dist/solid.js (client build)',
  vue: '@vue/reactivity (environment-agnostic)',
  preact: '@preact/signals-core (environment-agnostic)',
};

/** برچسب‌های انسانی برای جدول‌های سند. */
export const COMPETITOR_LABELS = {
  zenith: 'Zenith (@zenith/state)',
  solid: 'Solid (solid-js)',
  vue: 'Vue (@vue/reactivity)',
  preact: 'Preact (@preact/signals-core)',
};

/** نسخهٔ نصب‌شدهٔ هر مرجع — در گزارش و سند ثبت می‌شود. */
export function competitorVersions() {
  const versions = { zenith: installedVersion('@zenith/state') ?? 'workspace' };
  for (const [key, pkg] of Object.entries(COMPETITOR_PACKAGES)) {
    versions[key] = installedVersion(pkg);
  }
  return versions;
}

/**
 * آداپتورهای یکنواخت: هر مرجع یک `read`/`write`/`diamond` سبک خودش را می‌دهد.
 * (یکسان‌سازی عمدی است: بدون آن، «مقایسه» به تفاوت API تبدیل می‌شود.)
 */
export async function loadCompetitors() {
  // ⚠️ `solid-js` در Node (شرط `node` در exports) به بیلد **server** resolve
  // می‌شود که در آن `createEffect` عملاً no-op است — مقایسهٔ آن با هستهٔ
  // واکنشی کلاینت بی‌معناست (اندازه‌گیری‌شده: effect-runs = ۰). بیلد کلاینت را
  // صریح بار می‌کنیم؛ همان چیزی که کاربر در مرورگر می‌گیرد.
  const solid = await import('solid-js/dist/solid.js');
  const vue = await import('@vue/reactivity');
  const preact = await import('@preact/signals-core');

  return {
    solid: {
      label: COMPETITOR_LABELS.solid,
      createRead: () => {
        const [get] = solid.createSignal(42);
        return () => get();
      },
      createWrite: () => {
        const [, set] = solid.createSignal(0);
        return (i) => set(i);
      },
      createDiamond: () => {
        const [get, set] = solid.createSignal(1);
        const left = solid.createMemo(() => get() * 2);
        const right = solid.createMemo(() => get() + 10);
        const sum = solid.createMemo(() => left() + right());
        return (i) => {
          set(i);
          return sum();
        };
      },
      createEffectCounter: () => {
        const [get, set] = solid.createSignal(0);
        let runs = 0;
        // ریشهٔ reactive را باز نگه می‌داریم (dispose در پایان اجرا) — وگرنه
        // effect پیش از اولین نوشتن جمع می‌شود و شمارش صفر می‌ماند.
        const dispose = solid.createRoot((disposer) => {
          solid.createEffect(() => {
            const value = get();
            runs += value === undefined ? 0 : 1;
          });
          return disposer;
        });
        // Solid اثرها را در صف microtask اجرا می‌کند؛ flush یک tick ماکرو
        // می‌دهد تا شمارش واقعی خوانده شود (وگرنه عدد ۰ گزارش می‌شود).
        return {
          set,
          runs: () => runs,
          flush: async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
            dispose();
          },
        };
      },
    },
    vue: {
      label: COMPETITOR_LABELS.vue,
      createRead: () => {
        const r = vue.ref(42);
        return () => r.value;
      },
      createWrite: () => {
        const r = vue.ref(0);
        return (i) => {
          r.value = i;
        };
      },
      createDiamond: () => {
        const r = vue.ref(1);
        const left = vue.computed(() => r.value * 2);
        const right = vue.computed(() => r.value + 10);
        const sum = vue.computed(() => left.value + right.value);
        return (i) => {
          r.value = i;
          return sum.value;
        };
      },
      createEffectCounter: () => {
        const r = vue.ref(0);
        let runs = 0;
        vue.effect(() => {
          const value = r.value;
          runs += value === undefined ? 0 : 1;
        });
        return { set: (i) => (r.value = i), runs: () => runs, flush: async () => {} };
      },
    },
    preact: {
      label: COMPETITOR_LABELS.preact,
      createRead: () => {
        const s = preact.signal(42);
        return () => s.value;
      },
      createWrite: () => {
        const s = preact.signal(0);
        return (i) => {
          s.value = i;
        };
      },
      createDiamond: () => {
        const s = preact.signal(1);
        const left = preact.computed(() => s.value * 2);
        const right = preact.computed(() => s.value + 10);
        const sum = preact.computed(() => left.value + right.value);
        return (i) => {
          s.value = i;
          return sum.value;
        };
      },
      createEffectCounter: () => {
        const s = preact.signal(0);
        let runs = 0;
        preact.effect(() => {
          const value = s.value;
          runs += value === undefined ? 0 : 1;
        });
        return { set: (i) => (s.value = i), runs: () => runs, flush: async () => {} };
      },
    },
  };
}
