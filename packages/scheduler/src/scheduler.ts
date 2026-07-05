// packages/scheduler/src/scheduler.ts
//
// موتور Scheduler — قلب بهینه‌سازی فاز ۷.
//
// مشکل:
//   بدون Scheduler، وقتی یک Signal.set() فراخوانی می‌شود، تمام Effectهای
//   وابسته بلافاصله (Synchronous) اجرا می‌شوند. اگر در یک تابع ۱۰ Signal
//   را تغییر دهید، DOM شما ۱۰ بار آپدیت می‌شود — که بسیار کند است.
//
// راه‌حل:
//   به‌جای اجرای مستقیم Effectها، آن‌ها را در یک صف (Queue) قرار می‌دهیم.
//   سپس یک Microtask (از طریق Promise.resolve().then) ثبت می‌کنیم تا در
//   پایان تیک فعلی Event Loop، تمام Effectهای صف را یکجا اجرا کند.
//
//   چون از Set استفاده می‌کنیم، هر Effect فقط یک بار در صف قرار می‌گیرد،
//   حتی اگر چند Signal مختلف آن را trigger کنند.
//
//   این مکانیزم جایگزین 手動 batch() می‌شود — batching به‌صورت خودکار
//   توسط Microtask اتفاق می‌افتد.
//
// ── Priority Queue (Production Readiness #29) ──
//
//   از فاز جدید، Scheduler از سه سطح اولویت پشتیبانی می‌کند:
//     • urgent (۲): کارهای حیاتی که باید قبل از رندر بعدی اجرا شوند
//                  (مثل آپدیت state کاربر، navigation، خطاها).
//     • normal (۱): آپدیت‌های DOM معمولی (zen-text, zen-if, ...).
//     • idle (۰):   کارهای کم‌اهمیت مثل analytics، logging، pre-render.
//
//   ترتیب اجرا در یک flush همیشه urgent → normal → idle است.
//   این تضمین می‌کند که:
//     - state حیاتی قبل از DOM آپدیت شود
//     - DOM قبل از analytics لوگ شود
//
//   مثال:
//     scheduleEffect(() => saveToAnalytics(...), 'idle');
//     scheduleEffect(() => updateDOM(...), 'normal');
//     scheduleEffect(() => navigate(...), 'urgent');
//     // flush: navigate → updateDOM → saveToAnalytics

/**
 * سطح اولویت یک Effect.
 *
 * اعداد به‌صورت صعودی به معنای اولویت بالاتر هستند تا sort ساده کار کند.
 */
export type Priority = 'idle' | 'normal' | 'urgent';

const PRIORITY_VALUE: Record<Priority, number> = {
  idle: 0,
  normal: 1,
  urgent: 2,
};

/**
 * تبدیل Priority به عدد برای مقایسه.
 *
 * B-03 FIX: Added validation for development mode to catch typos
 * in priority strings that would silently fall back to 'normal'.
 */
function priorityValue(p: Priority): number {
  const v = PRIORITY_VALUE[p];
  if (v === undefined) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[Zenith Scheduler] Unknown priority "${String(p)}". Falling back to "normal".`);
    }
    return PRIORITY_VALUE.normal;
  }
  return v;
}

/**
 * یک Effect در صف Scheduler به همراه اولویت آن.
 */
interface QueuedEffect {
  fn: () => void;
  priority: Priority;
  /**
   * Insertion order برای حفظ ترتیب ثبت‌شده در میان Effectهای هم‌اولویت.
   * این تضمین می‌کند که اگر دو Effect با اولویت normal در یک tick ثبت شوند،
   * آن‌هایی که زودتر ثبت شده‌اند زودتر اجرا شوند.
   */
  seq: number;
}

/**
 * صف Effectهایی که باید در microtask بعدی اجرا شوند.
 *
 * چرا Set نه Array؟
 *   - جلوگیری از اجرای یک Effect دو بار در یک flush.
 *   - اگر Signal A و Signal B هر دو به Effect X وابسته باشند، و هر دو در
 *     یک تابع set شوند، Effect X فقط یک بار (نه دو بار) اجرا می‌شود.
 *
 * اما با priority queue دیگر از Map استفاده می‌کنیم تا بتوانیم در صورت
 * ثبت مجدد یک Effect با اولویت متفاوت، اولویت جدید را اعمال کنیم.
 *
 * کلید: reference تابع Effect.
 * مقدار: QueuedEffect (شامل اولویت و seq).
 */
const queue: Map<() => void, QueuedEffect> = new Map();

/**
 * شمارنده‌ی monotonic برای حفظ ترتیب ثبت در میان Effectهای هم‌اولویت.
 */
let insertSeq = 0;

/**
 * آیا در حال حاضر در حال اجرای صف هستیم (flushing)؟
 *
 * این فلگ برای جلوگیری از re-entrancy استفاده می‌شود:
 *   - اگر در حین flush، کسی flushSync() را فراخوانی کند، نادیده گرفته می‌شود.
 *   - اگر در حین flush، Effect جدیدی schedule شود، در همان flush اجرا می‌شود.
 */
let isFlushing = false;

/**
 * IMPROVEMENT-04: afterFlush callbacks.
 *
 * صفی از callbackهایی که بعد از پایان flush (با موفقیت یا خطا) اجرا می‌شوند.
 * کاربرد اصلی: تست‌ها یا ابزارهای devtools که می‌خواهند بعد از آپدیت DOM
 * یک action انجام دهند. هر callback فقط یک‌بار اجرا می‌شود.
 *
 * نکته: اگر در حین flush، callback جدیدی به این صف اضافه شود، در همان flush
 * فعلی اجرا نخواهد شد (چون splice قبل از اجرای callbackها انجام می‌شود).
 * این رفتار به‌صورت عمدی است تا از re-entrancy جلوگیری شود.
 */
const afterFlushCallbacks: Array<() => void> = [];

/**
 * Promise که برای ثبت microtask استفاده می‌شود.
 *
 * نگه‌داشتن این reference برای دو دلیل:
 *   1) جلوگیری از ثبت چند microtask در یک تیک (با چک کردن null بودن).
 *   2) در آینده می‌توان از آن برای await کردن flush استفاده کرد.
 */
let flushPromise: Promise<void> | null = null;

/**
 * حداکثر تعداد Effectهای مجاز در یک flush (محافظت در برابر infinite loop).
 *
 * اگر یک Effect در حین اجرا، خودش را دوباره schedule کند، می‌تواند
 * باعث infinite loop شود. این محدودیت از آن جلوگیری می‌کند.
 */
const MAX_FLUSH_ITERATIONS = 1000;

/**
 * اجرای تمام Effectهای موجود در صف.
 *
 * این تابع:
 *   1) isFlushing را true می‌کند (جلوگیری از re-entrancy).
 *   2) تمام Effectهای صف را بر اساس اولویت مرتب می‌کند.
 *   3) آن‌ها را به ترتیب اجرا می‌کند.
 *   4) اگر در حین اجرا Effectهای جدیدی اضافه شده باشند، آن‌ها هم اجرا می‌شوند.
 *   5) در پایان، صف را پاک می‌کند و isFlushing را false می‌کند.
 *
 * نکته: اگر یک Effect خطا دهد، بقیه Effectها همچنان اجرا می‌شوند.
 * این رفتار مهم است چون یک Effect خراب نباید کل اپلیکیشن را متوقف کند.
 */
function flushQueue(): void {
  if (isFlushing) return; // جلوگیری از re-entrancy
  isFlushing = true;

  let iterations = 0;
  let hitMaxIterations = false;

  try {
    // حلقه تا زمانی که صف کاملاً خالی شود.
    // دلیل: وقتی یک Effect اجرا می‌شود، ممکن است (از طریق Computed chain)
    // Effectهای دیگری به صف اضافه شوند. ما می‌خواهیم همه‌ی آن‌ها
    // در همین flush پردازش شوند.
    while (queue.size > 0) {
      if (++iterations > MAX_FLUSH_ITERATIONS) {
        // BUG-16 FIX (v1.2.2): hard kill — قبلاً فقط یک warning چاپ می‌شد و
        // حلقه break می‌شد، اما صف همچنان پر می‌ماند و microtask بعدی دوباره
        // وارد همان infinite loop می‌شد. حالا صف را خالی می‌کنیم تا
        // scheduler کاملاً از این وضعیت بازیابی شود.
        console.error(
          `[Zenith Scheduler] Infinite loop detected after ${MAX_FLUSH_ITERATIONS} iterations. ` +
          `Clearing queue to prevent browser freeze. Pending effects are discarded.`
        );
        queue.clear();
        hitMaxIterations = true;
        break;
      }

      // کپی از صف، مرتب‌شده بر اساس اولویت نزولی سپس seq صعودی.
      // مرتب‌سازی در هر iteration انجام می‌شود چون Effectهای جدید ممکن است
      // با اولویت متفاوت اضافه شده باشند.
      const effects = Array.from(queue.values()).sort((a, b) => {
        const pdiff = priorityValue(b.priority) - priorityValue(a.priority);
        if (pdiff !== 0) return pdiff;
        return a.seq - b.seq;
      });
      queue.clear();

      for (const entry of effects) {
        try {
          entry.fn();
        } catch (error) {
          // یک Effect خراب نباید بقیه را متوقف کند.
          console.error('[Zenith Scheduler] Error in effect:', error);
        }
      }
    }
  } finally {
    isFlushing = false;
    flushPromise = null;

    // IMPROVEMENT-04: afterFlush callbacks را اجرا کن.
    // splice(0) یک کپی از آرایه می‌گیرد و آرایه اصلی را خالی می‌کند تا
    // callbackهای جدیدی که در حین اجرای این callbackها اضافه شوند، در
    // flush بعدی اجرا شوند (نه همین flush).
    const cbs = afterFlushCallbacks.splice(0);
    for (const cb of cbs) {
      try { cb(); } catch (e) { console.error('[Scheduler] afterFlush error:', e); }
    }

    if (hitMaxIterations) {
      // BUG-16 FIX (v1.2.2): Queue was already cleared above.
      // Intentional no-op to prevent browser freeze from infinite loop.
      // No need to schedule next flush since all pending effects were discarded.
    } else {
      // Final cleanup in case any effects remain in queue.
      queue.clear();
    }
  }
}

/**
 * ثبت یک Effect در صف برای اجرا در microtask بعدی.
 *
 * این تابع:
 *   1) Effect را به صف اضافه می‌کند (Map از تکرار جلوگیری می‌کند).
 *   2) اگر هنوز microtask ثبت نشده، یکی ثبت می‌کند.
 *
 * اگر در حین flush (isFlushing=true) فراخوانی شود:
 *   - Effect به صف اضافه می‌شود.
 *   - microtask جدید ثبت نمی‌شود (چون flush فعلی آن را اجرا خواهد کرد).
 *
 * B-01 FIX: Check for custom SchedulerAdapter before falling back to default microtask scheduling.
 * This enables Dependency Injection for custom scheduling (testing, time-slicing, etc.).
 *
 * @param effectFn تابع Effect که باید اجرا شود.
 * @param priority اولویت Effect (پیش‌فرض: normal).
 *                 'urgent' = قبل از رندر بعدی (state حیاتی، navigation)
 *                 'normal' = آپدیت DOM معمولی
 *                 'idle'   = analytics، logging، pre-render
 */
export function scheduleEffect(effectFn: () => void, priority: Priority = 'normal'): void {
  // B-01 FIX: Check for custom adapter first
  const adapter = _customAdapter.current;
  if (adapter) {
    // Queue the effect locally but delegate scheduling to adapter
    const existing = queue.get(effectFn);
    if (existing) {
      // اگر Effect از قبل در صف است، اولویت بالاتر را حفظ کن.
      if (priorityValue(priority) > priorityValue(existing.priority)) {
        existing.priority = priority;
      }
    } else {
      queue.set(effectFn, { fn: effectFn, priority, seq: insertSeq++ });
    }
    // Delegate scheduling to custom adapter
    adapter.schedule(flushQueue);
    return;
  }

  // Default microtask-based scheduling
  const existing = queue.get(effectFn);
  if (existing) {
    // اگر Effect از قبل در صف است، اولویت بالاتر را حفظ کن.
    // یعنی اگرEffect با normal ثبت شده و حالا با urgent دوباره ثبت می‌شود،
    // اولویت urgent را نگه دار.
    if (priorityValue(priority) > priorityValue(existing.priority)) {
      existing.priority = priority;
    }
    // seq را تغییر نمی‌دهیم تا ترتیب ثبت اصلی حفظ شود.
  } else {
    queue.set(effectFn, { fn: effectFn, priority, seq: insertSeq++ });
  }

  // اگر در حال flush نیستیم و هنوز microtask ثبت نشده، یکی ثبت کن.
  // اگر در حال flush هستیم، Effect در همان flush فعلی اجرا خواهد شد
  // (به دلیل حلقه while در flushQueue).
  if (!isFlushing && !flushPromise) {
    flushPromise = Promise.resolve().then(flushQueue);
  }
}

/**
 * اجرای اجباری و Synchronous صف.
 *
 * این تابع تمام Effectهای موجود در صف را بلافاصله (بدون انتظار برای microtask)
 * اجرا می‌کند.
 *
 * کاربردها:
 *   - در Event Handlers: برای اطمینان از آپدیت DOM قبل از اتمام رویداد
 *     (مهم برای Event Bubbling و prevented default).
 *   - در تست‌ها: برای sync کردن DOM بعد از state.set().
 *   - در SSR: برای اطمینان از رندر کامل قبل از serialize.
 *
 * B-01 FIX: Use custom SchedulerAdapter if configured for custom flushing logic.
 *
 * نکته: اگر در حین flush فراخوانی شود، نادیده گرفته می‌شود (re-entrancy safe).
 */
export function flushSync(): void {
  if (isFlushing) return;

  // B-01 FIX: Check for custom adapter
  const adapter = _customAdapter.current;
  if (adapter) {
    adapter.flush();
    return;
  }

  flushQueue();
}

/**
 * بررسی اینکه آیا Effectهای در انتظار وجود دارد.
 *
 * مفید برای:
 *   - تست‌ها: بررسی اینکه آیا batching درست کار می‌کند.
 *   - Debug: نمایش وضعیت Scheduler.
 */
export function hasPendingEffects(): boolean {
  return queue.size > 0;
}

/**
 * تعداد Effectهای در انتظار (فقط برای Debug).
 */
export function pendingEffectCount(): number {
  return queue.size;
}

/**
 * تعداد Effectهای در انتظار در یک اولویت مشخص (برای Debug و تست).
 */
export function pendingEffectsByPriority(priority: Priority): number {
  let count = 0;
  for (const entry of queue.values()) {
    if (entry.priority === priority) count++;
  }
  return count;
}

/**
 * پاکسازی کامل Scheduler (فقط برای تست‌ها).
 *
 * ⚠️ در Production استفاده نکنید — این عملیات Effectهای معلق را دور می‌اندازد.
 */
export function clearScheduler(): void {
  queue.clear();
  isFlushing = false;
  flushPromise = null;
  insertSeq = 0;
  // IMPROVEMENT-04: afterFlush callbacks را هم پاک کن.
  afterFlushCallbacks.length = 0;
}

/**
 * IMPROVEMENT-04: ثبت یک callback که بعد از پایان flush بعدی اجرا می‌شود.
 *
 * کاربرد:
 *   - تست‌ها: اطمینان از اینکه DOM قبل از assertion آپدیت شده است.
 *   - DevTools: snapshot گرفتن از state بعد از آپدیت.
 *   - Memory profiling: اندازه‌گیری heap بعد از flush.
 *
 * @param cb تابعی که بعد از flush اجرا شود.
 *
 * نکته:
 *   - اگر صف خالی باشد (هیچ Effect معلقی نیست)، callback تا flush بعدی
 *     اجرا نمی‌شود. برای اجرای فوری، ابتدا flushSync() را فراخوانی کنید.
 *   - اگر در حین flush فراخوانی شود، callback در flush بعدی اجرا می‌شود
 *     (نه همین flush).
 *   - B-02 FIX: Returns a disposer function to allow cleanup of the callback,
 *     preventing memory leaks in dynamic component scenarios.
 */
export function afterFlush(cb: () => void): () => void {
  afterFlushCallbacks.push(cb);
  return () => {
    const idx = afterFlushCallbacks.indexOf(cb);
    if (idx !== -1) {
      afterFlushCallbacks.splice(idx, 1);
    }
  };
}

// ─────────────────────────────────────────────────────────────
// FEATURE (v1.3.0): SchedulerAdapter — Dependency Injection
// ─────────────────────────────────────────────────────────────

export interface SchedulerAdapter {
  schedule(fn: () => void, priority: Priority): void;
  flush(): void;
}

/** @internal stored adapter — read by future scheduleEffect integration */
export const _customAdapter: { current: SchedulerAdapter | null } = { current: null };

export function configureScheduler(adapter: SchedulerAdapter | null): void {
  _customAdapter.current = adapter;
}

// ─────────────────────────────────────────────────────────────
// FEATURE: Debug/Trace hooks for DevTools integration (E-04)
// ─────────────────────────────────────────────────────────────

/**
 * Hook‌های اختیاری برای Debug و Tracing.
 *
 * این hooks توسط DevTools یا Profiler می‌توانند استفاده شوند.
 * در حالت عادی (non-dev)، این hooks هیچ overheadی ندارند.
 */
export interface SchedulerHooks {
  onEffectScheduled?: (effect: () => void, priority: Priority) => void;
  onEffectExecuted?: (effect: () => void, priority: Priority, durationMs: number) => void;
  onFlushStart?: () => void;
  onFlushEnd?: (effectsCount: number, durationMs: number) => void;
  onError?: (effect: () => void, error: unknown) => void;
}

let _hooks: SchedulerHooks | null = null;

/**
 * تنظیم Debug Hooks برای Scheduler.
 */
export function setSchedulerHooks(hooks: SchedulerHooks | null): void {
  _hooks = hooks;
}

/**
 * دریافت Debug Hooks جاری (برای استفاده داخلی).
 */
export function getSchedulerHooks(): SchedulerHooks | null {
  return _hooks;
}

// ─────────────────────────────────────────────────────────────
// FEATURE: scheduleMicrotask API (E-05)
// ─────────────────────────────────────────────────────────────

/**
 * اجرای یک تابع در microtask بعدی.
 *
 * این تابع یک API صریح برای schedule کردن یک function در microtask است.
 * برخلاف `scheduleEffect`، این تابع Effect را در queue ثبت نمی‌کند
 * بلکه مستقیماً یک microtask جدید ایجاد می‌کند.
 *
 * کاربردها:
 *   - اجرای کد بعد از اتمام رندر جاری.
 *   - defer کردن کارهای غیرضروری.
 *
 * @param fn تابعی که باید در microtask بعدی اجرا شود.
 * @returns Promise که بعد از اجرای fn resolve می‌شود.
 */
export function scheduleMicrotask(fn: () => void): Promise<void> {
  return Promise.resolve().then(fn);
}
