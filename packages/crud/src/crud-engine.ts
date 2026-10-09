// packages/crud/src/crud-engine.ts
//
// FEATURE (v0.3.0): @zenith/crud — HTML CRUD Engine (zen-crud directive).
//
// این ماژول «موتور CRUD HTML» را پیاده‌سازی می‌کند — بزرگ‌ترین مزیت تجاری Zenith.
// با یک attribute واحد (`zen-crud`)، یک جدول کامل CRUD با Pagination، Filters،
// Search، Sort، Actions و Permission checks به‌صورت خودکار تولید می‌شود.
//
// ── سینتکس ──
//
//   <div zen-crud="$userCrudConfig"></div>
//
//   // در State:
//   userCrudConfig = {
//     resource: 'users',
//     columns: [
//       { field: 'name', label: 'نام', sortable: true },
//       { field: 'email', label: 'ایمیل' },
//     ],
//     searchable: true,
//     pageSize: 10,
//     filters: [
//       { field: 'role', label: 'نقش', options: [
//         { value: 'admin', label: 'مدیر' },
//         { value: 'user',  label: 'کاربر' },
//       ]},
//     ],
//     rowActions: [
//       { name: 'edit',   label: 'ویرایش', action: 'editUser',
//         permission: 'users:edit' },
//       { name: 'delete', label: 'حذف',    action: 'crudDelete',
//         danger: true, confirm: true, permission: 'users:delete' },
//     ],
//     tableActions: [
//       { name: 'add', label: 'افزودن', action: 'addUser',
//         permission: 'users:create' },
//     ],
//     permission: 'users:read',
//   };
//
// ── SSR Safety ──
// تمام دسترسی‌های `document` و `confirm` با typeof guard محافظت می‌شوند تا
// این ماژول در محیط Node.js (SSR) بدون خطا load شود. متد render() در
// محیط غیر‌browser کاری نمی‌کند و فقط یک warning چاپ می‌کند.

import { signal, effect, computed, type Signal, type ReadonlySignal } from '@zenith/state';
import { getResource, type Resource } from '@zenith/resource';
import { Zen } from '@zenith/runtime';
import { getAction } from '@zenith/actions';
import { processPermission, getPermissionManager } from '@zenith/permission';

// ─────────────────────────────────────────────────────────────────────────
// FEATURE (v0.3.0): CrudEngineConfig
// ─────────────────────────────────────────────────────────────────────────

/**
 * پیکربندی یک CRUD Engine.
 *
 * این interface توسط کاربر تعریف می‌شود و یا به‌صورت JSON string یا به‌صورت
 * یک variable در State به دایرکتیو `zen-crud` ارسال می‌شود.
 */
export interface CrudEngineConfig {
  /** نام Resource ثبت‌شده (از createResource). */
  resource: string;
  /** ستون‌های جدول. */
  columns: Array<{ field: string; label?: string; sortable?: boolean }>;
  /** فیلدهای قابل‌جستجو. پیش‌فرض: همه‌ی فیلدهای columns. */
  searchFields?: string[];
  /** فیلترهای قابل‌اعمال. */
  filters?: Array<{
    field: string;
    label?: string;
    options: Array<{ value: string; label: string }>;
  }>;
  /** اندازه‌ی صفحه. پیش‌فرض: 10. */
  pageSize?: number;
  /** آیا search box نمایش داده شود؟ پیش‌فرض: true. */
  searchable?: boolean;
  /** Actions سفارشی در هر ردیف. */
  rowActions?: Array<{
    name: string;
    label: string;
    action: string;
    permission?: string;
    confirm?: boolean;
    danger?: boolean;
  }>;
  /** Actions سطح‌جدول (مثل "Add New"). */
  tableActions?: Array<{
    name: string;
    label: string;
    action: string;
    permission?: string;
  }>;
  /** permission required to see the table. */
  permission?: string;
}

// ─────────────────────────────────────────────────────────────────────────
// FEATURE (v0.3.0): CrudEngine
// ─────────────────────────────────────────────────────────────────────────

/**
 * کلاس CrudEngine: موتور تولید جدول CRUD از روی یک Config.
 *
 * ساز و کار:
 *   1) در constructor، Resource از registry گرفته می‌شود.
 *   2) Signalهای داخلی برای searchQuery، currentPage، pageSize، activeFilters،
 *      sortBy، sortDir ساخته می‌شوند.
 *   3) Computedهای داخلی، viewData و آمار pagination را به‌صورت reactive
 *      از روی resource.data محاسبه می‌کنند (filter → search → sort → paginate).
 *   4) متد render()، HTML جدول را می‌سازد، در host قرار می‌دهد، و سپس
 *      Zen.start را روی host صدا می‌زند تا دایرکتیوهای داخلی (zen-for،
 *      zen-model، zen-action، zen-permission و ...) فعال شوند.
 *   5) متد destroy()، Effectها و Actionهای دینامیک را پاکسازی می‌کند.
 *
 * نکته‌ی Computed و Context:
 *   createContext در runtime فقط مقادیری را که `get` و `set` دارند به‌عنوان
 *   Signal تشخیص می‌دهد. Computed فقط `get` دارد. برای اینکه Computedهای
 *   داخلی (مثل viewData) به‌صورت reactive در Expressionها در دسترس باشند،
 *   یک `set` no-op روی آن‌ها تعریف می‌کنیم (در constructor).
 */
export class CrudEngine {
  private config: CrudEngineConfig;
  private host: HTMLElement;
  private resource: Resource;

  // ── Reactive State (Signals) ──
  // FEATURE (v0.3.0): تمام state‌های ورودی کاربر به‌صورت Signal هستند.
  private searchQuery = signal('');
  private currentPage = signal(1);
  private pageSize: Signal<number>;
  private activeFilters = signal<Record<string, string>>({});
  private sortBy = signal<string | null>(null);
  private sortDir = signal<'asc' | 'desc'>('asc');

  // ── Derived State (Computed) ──
  // FEATURE (v0.3.0): viewData و آمار pagination از روی resource.data و
  // stateهای ورودی محاسبه می‌شوند. هر بار که یکی از وابستگی‌ها تغییر کند،
  // این مقادیر به‌صورت خودکار به‌روزرسانی می‌شوند.
  // `computed()` returns ReadonlySignal, not the concrete Computed class.
  private viewData!: ReadonlySignal<any[]>;
  private totalItems!: ReadonlySignal<number>;
  private totalPages!: ReadonlySignal<number>;
  private startIdx!: ReadonlySignal<number>;
  private endIdx!: ReadonlySignal<number>;
  private currentViewPage!: ReadonlySignal<number>;

  // ── Cleanup ──
  private disposes: (() => void)[] = [];
  private permissionDisposes: (() => void)[] = [];
  private registeredActions: string[] = [];
  private firstFilterRun = true;
  private rendered = false;

  constructor(config: CrudEngineConfig, host: HTMLElement) {
    this.config = config;
    this.host = host;
    this.pageSize = signal(config.pageSize ?? 10);

    // ── Validation: Resource باید از قبل ثبت شده باشد ──
    const resource = getResource(config.resource);
    if (!resource) {
      throw new Error(
        `[CrudEngine] Resource "${config.resource}" not found. ` +
        `Before using zen-crud, call createResource("${config.resource}", { url: '...' }).`,
      );
    }
    this.resource = resource;

    // ── Build Computeds ──
    this.buildComputeds();

    // ── Reset to page 1 when filters or search change ──
    // این Effect.currentPage را هنگام تغییر filters یا searchQuery به ۱ برمی‌گرداند
    // تا کاربر همیشه نتایج را از صفحه‌ی اول ببیند.
    this.disposes.push(
      effect(() => {
        // خواندن برای ثبت وابستگی
        this.activeFilters.get();
        this.searchQuery.get();
        if (!this.firstFilterRun) {
          this.currentPage.set(1);
        }
        this.firstFilterRun = false;
      }),
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────

  /**
   * رندر جدول CRUD در host element.
   *
   * مراحل:
   *   1) Actionهای دینامیک (sort، pagination، row actions، table actions)
   *      ثبت می‌شوند.
   *   2) HTML جدول ساخته می‌شود.
   *   3) host.innerHTML با HTML جدید جایگزین می‌شود.
   *   4) Zen.start روی host صدا زده می‌شود تا دایرکتیوهای داخلی فعال شوند.
   *   5) zen-permissionهای داخلی به‌صورت دستی wire می‌شوند (چون runtime
   *      walker به‌صورت پیش‌فرض آن‌ها را پردازش نمی‌کند).
   *
   * این متد SSR-safe است: در محیط Node.js (بدون document) no-op است.
   */
  render(): void {
    // SSR safety
    if (typeof document === 'undefined') {
      // در محیط SSR، رندر انجام نمی‌شود. فقط warning چاپ می‌کنیم.
      // این allows این ماژول را در SSR bundles import کرد بدون خطا.
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[CrudEngine] render() called in non-browser environment; skipping.');
      }
      return;
    }

    // اگر قبلاً رندر شده، اول پاکسازی کن.
    if (this.rendered) {
      this.cleanupRender();
    }
    this.rendered = true;

    // ۱. ثبت Actionهای دینامیک
    this.registerActions();

    // ۲. ساخت HTML
    const html = this.buildHTML();
    this.host.innerHTML = html;

    // ۳. فعال‌سازی دایرکتیوهای داخلی با Zen.start
    // نکته: Zen.start یک walker روی host اجرا می‌کند و تمام zen-* directiveها
    // (zen-text، zen-for، zen-model، zen-action، zen-bind و ...) را فعال می‌کند.
    const state: Record<string, any> = this.buildState();

    try {
      Zen.start(this.host, state);
    } catch (err) {
      console.error('[CrudEngine] Failed to start Zen runtime:', err);
    }

    // ۴. Wire کردن zen-permission به‌صورت دستی
    // (runtime walker به‌صورت پیش‌فرض zen-permission را پردازش نمی‌کند؛
    //  این کار باید به‌صورت دستی انجام شود، همانند permission demo.)
    this.wirePermissions();

    // ۵. جلوگیری از double-firing اکشن‌ها توسط event delegation تکراری.
    // وقتی CrudEngine داخل یک Zen app دیگر استفاده می‌شود، هر دو document-level
    // delegation روی یک کلیک فراخوانی می‌شوند. teardown مالک خود را فراخوانی
    // می‌کنیم تا فقط delegation بیرونی فعال بماند.
    // اگر CrudEngine به‌صورت standalone استفاده شود (بدون Zen app بیرونی)،
    // این کار هیچ listenerی را حذف نمی‌کند چون teardown فقط listenerهای همین
    // session را برمی‌دارد.
    const teardown = (this.host as any).__zenithDelegationTeardown as
      | (() => void)
      | undefined;
    // نکته: teardown را اینجا فراخوانی نمی‌کنیم تا در حالت standalone هم کار کند.
    // در عوض، در action handlerها از یک event-marker برای جلوگیری از double-fire
    // استفاده می‌کنیم (به registerActions مراجعه کنید).
    // teardown صرفاً ذخیره شده تا در destroy بتوانیم آن را فراخوانی کنیم.
    void teardown;
  }

  /**
   * پاکسازی کامل: dispose Effectها، حذف Actionهای دینامیک، پاکسازی DOM.
   *
   * نکته: این متد Zen.stop را صدا نمی‌زند چون Zen.stop تمام Resource registry
   * را پاک می‌کند (که می‌تواند دیگر بخش‌های app را خراب کند). در عوض،
   * disposesهای محلی را دستی پاک می‌کنیم.
   */
  destroy(): void {
    this.cleanupRender();

    // Dispose Effectهای داخلی.
    for (const d of this.disposes) {
      try {
        d();
      } catch (e) {
        console.error('[CrudEngine] Error during dispose:', e);
      }
    }
    this.disposes = [];

    // Dispose Computedها (دارای dispose داخلی برای cleanup effect).
    this.disposeComputeds();
  }

  // ─────────────────────────────────────────────────────────────────────
  // Internal: Computed Construction
  // ─────────────────────────────────────────────────────────────────────

  /**
   * ساخت Computedهای داخلی (viewData و آمار pagination).
   *
   * این متد در constructor فراخوانی می‌شود.
   */
  private buildComputeds(): void {
    // ── totalItems: تعداد کل آیتم‌ها (بدون فیلتر) ──
    this.totalItems = computed(() => {
      const raw = this.resource.data;
      return Array.isArray(raw) ? raw.length : 0;
    });

    // ── totalPages: تعداد کل صفحات ──
    this.totalPages = computed(() => {
      const total = this.totalItems.get();
      const ps = this.pageSize.get();
      return Math.max(1, Math.ceil(total / ps));
    });

    // ── currentViewPage: صفحه‌ی فعلی، تصحیح‌شده با totalPages ──
    // اگر currentPage از totalPages بیشتر شود (مثلاً بعد از حذف آیتم)،
    // این Computed آن را به totalPages برمی‌گرداند.
    this.currentViewPage = computed(() => {
      const cp = this.currentPage.get();
      const tp = this.totalPages.get();
      if (cp > tp) {
        // تصحیح به‌صورت side-effecting (تنها در حد set کردن signal).
        // این کار ایمن است چون set با Object.is جلوگیری از loop می‌کند.
        // نکته: set داخل Computed توصیه نمی‌شود اما اینجا ضروری است.
        // در نسخه‌های بعدی می‌توان این را با effect جداگانه reimplement کرد.
        return tp;
      }
      return cp;
    });

    // ── viewData: لیست آیتم‌های صفحه‌ی فعلی (filter → search → sort → paginate) ──
    this.viewData = computed(() => {
      const raw = this.resource.data;
      if (!Array.isArray(raw) || raw.length === 0) return [];

      // ── ۱. Filter ──
      let result: any[] = [...raw];
      const filters = this.activeFilters.get();
      for (const [field, value] of Object.entries(filters)) {
        if (value !== '' && value != null) {
          result = result.filter(
            item => String(item[field]) === String(value),
          );
        }
      }

      // ── ۲. Search ──
      const q = this.searchQuery.get().trim().toLowerCase();
      if (q) {
        const fields =
          this.config.searchFields ??
          this.config.columns.map(c => c.field);
        result = result.filter(item =>
          fields.some(f =>
            String(item[f] ?? '').toLowerCase().includes(q),
          ),
        );
      }

      // ── ۳. Sort ──
      const sortBy = this.sortBy.get();
      const sortDir = this.sortDir.get();
      if (sortBy) {
        result = result.slice().sort((a, b) => {
          const av = a[sortBy];
          const bv = b[sortBy];
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          if (typeof av === 'number' && typeof bv === 'number') {
            return sortDir === 'asc' ? av - bv : bv - av;
          }
          const as = String(av);
          const bs = String(bv);
          if (as < bs) return sortDir === 'asc' ? -1 : 1;
          if (as > bs) return sortDir === 'asc' ? 1 : -1;
          return 0;
        });
      }

      // ── ۴. Paginate ──
      const page = this.currentViewPage.get();
      const ps = this.pageSize.get();
      const start = (page - 1) * ps;
      return result.slice(start, start + ps);
    });

    // ── startIdx: اندیس اولین آیتم نمایش‌داده‌شده (1-indexed) ──
    this.startIdx = computed(() => {
      const view = this.viewData.get();
      if (view.length === 0) return 0;
      const page = this.currentViewPage.get();
      const ps = this.pageSize.get();
      return (page - 1) * ps + 1;
    });

    // ── endIdx: اندیس آخرین آیتم نمایش‌داده‌شده (1-indexed) ──
    this.endIdx = computed(() => {
      const view = this.viewData.get();
      if (view.length === 0) return 0;
      const page = this.currentViewPage.get();
      const ps = this.pageSize.get();
      return (page - 1) * ps + view.length;
    });

    // ── Workaround: افزودن `set` no-op به Computedها ──
    // createContext در runtime فقط مقادیری که `get` و `set` دارند را به‌عنوان
    // Signal تشخیص می‌دهد. Computed فقط `get` دارد. با افزودن یک `set` no-op
    // این محدودیت را دور می‌زنیم تا Computedها در Expressionها reactive باشند.
    this.markComputedAsSignalLike(this.viewData);
    this.markComputedAsSignalLike(this.totalItems);
    this.markComputedAsSignalLike(this.totalPages);
    this.markComputedAsSignalLike(this.startIdx);
    this.markComputedAsSignalLike(this.endIdx);
    this.markComputedAsSignalLike(this.currentViewPage);
  }

  /**
   * افزودن یک `set` no-op به یک Computed تا توسط createContext به‌عنوان
   * Signal تشخیص داده شود.
   */
  private markComputedAsSignalLike<T>(c: ReadonlySignal<T>): void {
    const obj = c as any;
    if (typeof obj.set !== 'function') {
      obj.set = function () {
        // No-op: Computedها فقط‌خواندنی هستند.
      };
    }
  }

  /**
   * Dispose تمام Computedها (پاکسازی effect داخلی آن‌ها).
   */
  private disposeComputeds(): void {
    const list: Array<ReadonlySignal<any> | undefined> = [
      this.viewData,
      this.totalItems,
      this.totalPages,
      this.startIdx,
      this.endIdx,
      this.currentViewPage,
    ];
    for (const c of list) {
      if (c && typeof c.dispose === 'function') {
        try {
          c.dispose();
        } catch {
          // ignore
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Internal: Action Registration
  // ─────────────────────────────────────────────────────────────────────

  /**
   * ثبت Actionهای دینامیک برای sort، pagination، row actions و table actions.
   *
   * نام‌گذاری: `__crud_<resource>_<kind>_<name>` برای جلوگیری از تداخل با
   * Actionهای کاربر.
   *
   * برای جلوگیری از double-firing وقتی چندین event delegation روی document
   * ثبت شده (مثلاً زمانی که CrudEngine داخل یک Zen app دیگر استفاده می‌شود)،
   * هر action handler قبل از اجرا یک marker روی event set می‌کند.
   */
  private registerActions(): void {
    const res = this.config.resource;

    // ── Sort Actions (یکی برای هر ستون sortable) ──
    for (const col of this.config.columns) {
      if (!col.sortable) continue;
      const actionName = `__crud_${res}_sort_${col.field}`;
      Zen.action(actionName, this.guardAction(() => {
        const currentSort = this.sortBy.get();
        const currentDir = this.sortDir.get();
        if (currentSort === col.field) {
          this.sortDir.set(currentDir === 'asc' ? 'desc' : 'asc');
        } else {
          this.sortBy.set(col.field);
          this.sortDir.set('asc');
        }
      }));
      this.registeredActions.push(actionName);
    }

    // ── Pagination Actions ──
    const prevAction = `__crud_${res}_prevPage`;
    Zen.action(prevAction, this.guardAction(() => {
      const p = this.currentPage.get();
      if (p > 1) this.currentPage.set(p - 1);
    }));
    this.registeredActions.push(prevAction);

    const nextAction = `__crud_${res}_nextPage`;
    Zen.action(nextAction, this.guardAction(() => {
      const p = this.currentPage.get();
      const tp = this.totalPages.get();
      if (p < tp) this.currentPage.set(p + 1);
    }));
    this.registeredActions.push(nextAction);

    const gotoAction = `__crud_${res}_gotoPage`;
    Zen.action(gotoAction, this.guardAction(({ element }: any) => {
      const pageAttr = element.getAttribute('data-page');
      if (!pageAttr) return;
      const page = parseInt(pageAttr, 10);
      const tp = this.totalPages.get();
      if (!isNaN(page) && page >= 1 && page <= tp) {
        this.currentPage.set(page);
      }
    }));
    this.registeredActions.push(gotoAction);

    // ── Row Actions ──
    for (const action of this.config.rowActions ?? []) {
      const actionName = `__crud_${res}_row_${action.name}`;
      Zen.action(
        actionName,
        // FIX (v1.2.7): pass action.permission to guardAction so it can
        // re-check the permission at fire-time (not just at render-time).
        this.guardAction((ctx: any) => {
          // اگر confirm=true، ابتدا تایید بگیر.
          if (action.confirm) {
            const msg = `آیا از «${action.label}» مطمئن هستید؟`;
            // SSR safety: confirm فقط در browser وجود دارد.
            if (typeof confirm === 'function' && !confirm(msg)) return;
          }
          // Action کاربر را از registry بگیر و اجرا کن.
          const userAction = getAction(action.action);
          if (userAction) {
            try {
              userAction(ctx);
            } catch (e) {
              console.error(
                `[CrudEngine] Row action "${action.action}" failed:`,
                e,
              );
            }
          } else {
            console.warn(
              `[CrudEngine] Action "${action.action}" not registered. ` +
              `Register it via Zen.action('${action.action}', fn).`,
            );
          }
        }, action.permission),
      );
      this.registeredActions.push(actionName);
    }

    // ── Table Actions ──
    for (const action of this.config.tableActions ?? []) {
      const actionName = `__crud_${res}_table_${action.name}`;
      Zen.action(
        actionName,
        // FIX (v1.2.7): pass action.permission to guardAction so it can
        // re-check the permission at fire-time (not just at render-time).
        this.guardAction((ctx: any) => {
          const userAction = getAction(action.action);
          if (userAction) {
            try {
              userAction(ctx);
            } catch (e) {
              console.error(
                `[CrudEngine] Table action "${action.action}" failed:`,
                e,
              );
            }
          } else {
            console.warn(
              `[CrudEngine] Action "${action.action}" not registered. ` +
              `Register it via Zen.action('${action.action}', fn).`,
            );
          }
        }, action.permission),
      );
      this.registeredActions.push(actionName);
    }
  }

  /**
   * Wrapper برای جلوگیری از double-firing یک action توسط چندین event delegation.
   *
   * وقتی CrudEngine داخل یک Zen app دیگر استفاده می‌شود، هم event delegation
   * بیرونی و هم event delegation داخلی (که توسط Zen.start در render() نصب شده)
   * روی یک کلیک فراخوانی می‌شوند. این wrapper با set کردن یک marker روی event
   * باعث می‌شود فقط اولین فراخوانی اجرا شود.
   */
  private guardAction<T extends (...args: any[]) => any>(fn: T, permission?: string): T {
    return ((ctx: any) => {
      const event = ctx?.event;
      if (event && typeof event === 'object') {
        if ((event as any).__crudHandled) return;
        (event as any).__crudHandled = true;
      }
      // FIX (v1.2.7): re-check permission before executing the user action.
      // zen-permission wiring hides the button when the user lacks the
      // permission, but a crafted event (or a stale DOM after permissions
      // changed) could still trigger the registered action handler. This
      // re-check is the authoritative gate; the visible-button check is
      // only a UX nicety.
      if (permission) {
        const manager = getPermissionManager();
        if (manager && !manager.checkPermission(permission)) {
          console.warn(
            `[CrudEngine] Permission denied for action requiring "${permission}".`,
          );
          return;
        }
      }
      try {
        return fn(ctx);
      } catch (e) {
        console.error('[CrudEngine] Action handler failed:', e);
      }
    }) as T;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Internal: HTML Construction
  // ─────────────────────────────────────────────────────────────────────

  /**
   * ساخت State object برای پاس دادن به Zen.start.
   *
   * این State شامل تمام Signalها و Computedهای داخلی است که در Expressionها
   * با پیشوند `$` قابل دسترسی هستند (مثل `$searchQuery`، `$viewData`، ...).
   */
  private buildState(): Record<string, any> {
    return {
      searchQuery: this.searchQuery,
      currentPage: this.currentViewPage,
      pageSize: this.pageSize,
      activeFilters: this.activeFilters,
      sortBy: this.sortBy,
      sortDir: this.sortDir,
      viewData: this.viewData,
      totalItems: this.totalItems,
      totalPages: this.totalPages,
      startIdx: this.startIdx,
      endIdx: this.endIdx,
      // Resource signal — برای $resource.data، $resource.loading، $resource.error
      resource: this.resource.signal,
    };
  }

  /**
   * ساخت HTML کامل جدول CRUD.
   */
  private buildHTML(): string {
    const inner =
      this.buildToolbar() + this.buildTable() + this.buildPagination();

    // اگر permission تنظیم شده، کل جدول در یک wrapper با zen-permission قرار بده.
    // نکته: zen-permission به‌صورت دستی در wirePermissions() پردازش می‌شود.
    if (this.config.permission) {
      return (
        `<div class="zen-crud" zen-permission="${this.escapeAttr(this.config.permission)}">` +
        inner +
        `</div>`
      );
    }
    return `<div class="zen-crud">${inner}</div>`;
  }

  /**
   * ساخت HTML toolbar (search، filters، table actions).
   */
  private buildToolbar(): string {
    const parts: string[] = [];
    parts.push(`<div class="zen-crud-toolbar">`);

    // Search box
    if (this.config.searchable !== false) {
      parts.push(
        `<input type="search" class="zen-crud-search" ` +
          `zen-model="$searchQuery" placeholder="جستجو..." aria-label="جستجو">`,
      );
    }

    // Filters
    for (const filter of this.config.filters ?? []) {
      const label = filter.label ?? filter.field;
      const options = filter.options
        .map(
          opt =>
            `<option value="${this.escapeAttr(opt.value)}">${this.escapeHtml(opt.label)}</option>`,
        )
        .join('');
      parts.push(
        `<label class="zen-crud-filter">` +
          `<span>${this.escapeHtml(label)}</span>` +
          `<select zen-model="$activeFilters.${this.escapeAttr(filter.field)}">` +
          `<option value="">همه</option>` +
          options +
          `</select>` +
          `</label>`,
      );
    }

    // Table actions
    if (this.config.tableActions && this.config.tableActions.length > 0) {
      parts.push(`<div class="zen-crud-table-actions">`);
      for (const action of this.config.tableActions) {
        const actionName = `__crud_${this.config.resource}_table_${action.name}`;
        const permAttr = action.permission
          ? ` zen-permission="${this.escapeAttr(action.permission)}"`
          : '';
        parts.push(
          `<button type="button" class="zen-crud-btn zen-crud-btn-primary" ` +
            `zen-action="${this.escapeAttr(actionName)}"${permAttr}>` +
            this.escapeHtml(action.label) +
            `</button>`,
        );
      }
      parts.push(`</div>`);
    }

    parts.push(`</div>`);
    return parts.join('');
  }

  /**
   * ساخت HTML جدول (head + body).
   */
  private buildTable(): string {
    const res = this.config.resource;
    const hasRowActions = (this.config.rowActions ?? []).length > 0;

    // ── Head Cells ──
    const headCells = this.config.columns
      .map(col => {
        const label = col.label ?? col.field;
        if (col.sortable) {
          const actionName = `__crud_${res}_sort_${col.field}`;
          // نشانگر sort: ↑ یا ↓ بر اساس sortBy و sortDir.
          // سینتکس: ternary تودرتو (سینتکس استاندارد Zenith Expression).
          const indicator =
            `$sortBy === '${col.field}' ? ($sortDir === 'asc' ? ' ↑' : ' ↓') : ''`;
          return (
            `<th>` +
            `<button type="button" class="zen-crud-sort-btn" ` +
            `zen-action="${this.escapeAttr(actionName)}">` +
            this.escapeHtml(label) +
            `<span zen-text="${this.escapeAttr(indicator)}"></span>` +
            `</button>` +
            `</th>`
          );
        }
        return `<th>${this.escapeHtml(label)}</th>`;
      })
      .join('');

    const actionsHead = hasRowActions ? `<th>عملیات</th>` : '';

    // ── Body Cells (data row template) ──
    const bodyCells = this.config.columns
      .map(col => `<td zen-text="$item.${this.escapeAttr(col.field)}"></td>`)
      .join('');

    let bodyRow = `<tr zen-for="item in $viewData" zen-key="item.id">${bodyCells}`;
    if (hasRowActions) {
      const actionButtons = (this.config.rowActions ?? [])
        .map(action => {
          const actionName = `__crud_${res}_row_${action.name}`;
          const permAttr = action.permission
            ? ` zen-permission="${this.escapeAttr(action.permission)}"`
            : '';
          const dangerClass = action.danger ? ' zen-crud-btn-danger' : '';
          // data-id و data-resource برای استفاده در action کاربر.
          // از string literal استفاده می‌کنیم تا مستقل از context کار کند.
          return (
            `<button type="button" class="zen-crud-btn${dangerClass}" ` +
            `zen-action="${this.escapeAttr(actionName)}" ` +
            `zen-bind:data-id="$item.id" ` +
            `zen-bind:data-resource="'${this.escapeAttr(res)}'"` +
            permAttr +
            `>` +
            this.escapeHtml(action.label) +
            `</button>`
          );
        })
        .join('');
      bodyRow += `<td class="zen-crud-row-actions">${actionButtons}</td>`;
    }
    bodyRow += `</tr>`;

    // ── Empty State Row ──
    const colspan = this.config.columns.length + (hasRowActions ? 1 : 0);
    const emptyRow =
      `<tr zen-if="$viewData.length === 0">` +
      `<td colspan="${colspan}" class="zen-crud-empty">` +
      `موردی یافت نشد` +
      `</td></tr>`;

    return (
      `<div class="zen-crud-table-wrap">` +
      `<table class="zen-crud-table">` +
      `<thead><tr>${headCells}${actionsHead}</tr></thead>` +
      `<tbody>${bodyRow}${emptyRow}</tbody>` +
      `</table>` +
      `</div>`
    );
  }

  /**
   * ساخت HTML pagination footer.
   *
   * شامل: دکمه‌ی قبلی، اطلاعات صفحه (X از Y)، دکمه‌ی بعدی،
   * و متن "نمایش X-Y از Z".
   */
  private buildPagination(): string {
    const res = this.config.resource;
    const prevAction = `__crud_${res}_prevPage`;
    const nextAction = `__crud_${res}_nextPage`;

    return (
      `<div class="zen-crud-pagination">` +
      `<button type="button" class="zen-crud-btn" ` +
      `zen-action="${this.escapeAttr(prevAction)}" ` +
      `zen-bind:disabled="$currentPage === 1">قبلی</button>` +
      `<span class="zen-crud-page-info">` +
      `صفحه‌ی <span zen-text="$currentPage"></span> از <span zen-text="$totalPages"></span>` +
      `</span>` +
      `<button type="button" class="zen-crud-btn" ` +
      `zen-action="${this.escapeAttr(nextAction)}" ` +
      `zen-bind:disabled="$currentPage === $totalPages">بعدی</button>` +
      `<span class="zen-crud-count">` +
      `نمایش <span zen-text="$startIdx"></span>-<span zen-text="$endIdx"></span> ` +
      `از <span zen-text="$totalItems"></span>` +
      `</span>` +
      `</div>`
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // Internal: Permission Wiring
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Wire کردن دستی zen-permissionهای داخل host.
   *
   * نکته: runtime walker به‌صورت پیش‌فرض zen-permission را پردازش نمی‌کند
   * (این دایرکتیو در @zenith/permission تعریف شده اما در walker ثبت نشده).
   * این متد همان کار را به‌صورت دستی انجام می‌دهد، همانند permission demo.
   */
  private wirePermissions(): void {
    // پاکسازی permission disposes قبلی (اگر re-render شده).
    for (const d of this.permissionDisposes) {
      try {
        d();
      } catch {
        // ignore
      }
    }
    this.permissionDisposes = [];

    const permissionEls = this.host.querySelectorAll('[zen-permission]');
    for (const el of Array.from(permissionEls)) {
      const expr = el.getAttribute('zen-permission') || '';
      // attribute را حذف کن تا در re-processing دوباره پردازش نشود.
      el.removeAttribute('zen-permission');
      try {
        const d = processPermission(el as HTMLElement, expr);
        this.permissionDisposes.push(d);
      } catch (e) {
        console.error('[CrudEngine] Failed to wire zen-permission:', e);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Internal: Cleanup
  // ─────────────────────────────────────────────────────────────────────

  /**
   * پاکسازی رندر فعلی: dispose Effectهای walker، permissionها، و Actionهای دینامیک.
   *
   * نکته: این متد Zen.stop را صدا نمی‌زند چون Zen.stop تمام Resource registry
   * را پاک می‌کند (که می‌تواند دیگر بخش‌های app را خراب کند).
   */
  private cleanupRender(): void {
    // Dispose permission effects.
    for (const d of this.permissionDisposes) {
      try {
        d();
      } catch {
        // ignore
      }
    }
    this.permissionDisposes = [];

    // Dispose walker-created effects on the host.
    if (typeof document !== 'undefined' && this.host) {
      const disposes = (this.host as any).__zenithDisposes as
        | (() => void)[]
        | undefined;
      if (disposes) {
        for (const d of disposes) {
          try {
            d();
          } catch {
            // ignore
          }
        }
        disposes.length = 0;
        delete (this.host as any).__zenithDisposes;
      }

      // Remove event delegation listeners created by Zen.start on this host.
      const teardown = (this.host as any).__zenithDelegationTeardown as
        | (() => void)
        | undefined;
      if (typeof teardown === 'function') {
        try {
          teardown();
        } catch {
          // ignore
        }
        delete (this.host as any).__zenithDelegationTeardown;
      }

      // Clear host content.
      this.host.innerHTML = '';
    }

    // Unregister dynamic actions.
    for (const name of this.registeredActions) {
      try {
        Zen.action.unregister(name);
      } catch {
        // ignore
      }
    }
    this.registeredActions = [];

    this.rendered = false;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Internal: Helpers
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Escape HTMLSpecial characters برای جلوگیری از XSS در محتوای متنی.
   */
  private escapeHtml(s: string): string {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Escape characters برای استفاده در attribute value (داخل کوتیشن دوتایی).
   */
  private escapeAttr(s: string): string {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

// ─────────────────────────────────────────────────────────────────────────
// FEATURE (v0.3.0): processCrud Directive Processor
// ─────────────────────────────────────────────────────────────────────────

/**
 * پردازش دایرکتیو `zen-crud`.
 *
 * این تابع توسط runtime walker (یا کاربر به‌صورت دستی) فراخوانی می‌شود
 * وقتی عنصری با attribute `zen-crud` پیدا می‌شود.
 *
 * @param el         عنصری که zen-crud روی آن تعریف شده.
 * @param configAttr مقدار attribute: یا یک JSON string یا یک `$variableName`
 *                   که به یک CrudEngineConfig در context اشاره می‌کند.
 * @param context    Context فعلی (شامل $<name> keys).
 * @returns تابع dispose برای پاکسازی.
 */
export function processCrud(
  el: HTMLElement,
  configAttr: string,
  context: Record<string, any>,
): () => void {
  // SSR safety
  if (typeof document === 'undefined') {
    return () => {};
  }

  // ── Parse configAttr ──
  let config: CrudEngineConfig;
  const trimmed = configAttr.trim();

  if (trimmed.startsWith('$')) {
    // حالت $variableName: از context بخوان.
    // Context کلیدها را به‌صورت $<name> دارد (ساختار createContext).
    const varName = trimmed.slice(1);
    config = context[`$${varName}`] ?? context[varName];
    if (!config) {
      console.error(
        `[CrudEngine] Config variable "${trimmed}" not found in context. ` +
          `Available keys: ${Object.keys(context).join(', ')}`,
      );
      return () => {};
    }
  } else {
    // حالت JSON string
    try {
      config = JSON.parse(trimmed);
    } catch (e) {
      console.error(`[CrudEngine] Invalid JSON config:`, e);
      return () => {};
    }
  }

  // ── Validation ──
  if (!config || typeof config !== 'object' || !config.resource) {
    console.error(
      `[CrudEngine] Invalid config: missing "resource" property.`,
    );
    return () => {};
  }

  // ── Create engine and render ──
  let engine: CrudEngine;
  try {
    engine = new CrudEngine(config, el);
  } catch (e) {
    console.error(`[CrudEngine] Failed to create engine:`, e);
    return () => {};
  }

  engine.render();

  // Return dispose function.
  return () => {
    try {
      engine.destroy();
    } catch (e) {
      console.error('[CrudEngine] Error during destroy:', e);
    }
  };
}
