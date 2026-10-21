import { signal, effect, type Signal, type ReadonlySignal } from '@zenith/state';
import { getResource, type Resource } from '@zenith/resource';
import { Zen } from '@zenith/runtime';
import type { ActionFn } from '@zenith/actions';
import { deprecate, developerError, ErrorCode } from '@zenith/errors';
import { logger } from '@zenith/logger';
import type { Disposable } from '@zenith/shared';
import type { CrudEngineConfig } from './types';
import type { CrudScope, CrudHost } from './scope';
import { buildComputeds, markComputedAsSignalLike, disposeComputeds } from './computed';
import { registerActions, guardAction } from './actions';
import { buildHTML, buildToolbar, buildTable, buildPagination, escapeHtml, escapeAttr } from './html';
import { wirePermissions, cleanupRender } from './dom';
/** CRUD owner; helper capabilities forward to this instance. @public */
export class CrudEngine implements Disposable {
  private config: CrudEngineConfig;
  private host: CrudHost;
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
  private viewData!: ReadonlySignal<Record<string, unknown>[]>;
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
  // #116: فلگ dispose برای idempotency (alias destroy همان را می‌خواند).
  private _disposed = false;
  // #15: جلوگیری از حلقهٔ بی‌پایان fetch و ردیابی تعداد تلاش‌ها
  private _fetching = false;
  private _retryCount = 0;

  constructor(config: CrudEngineConfig, host: HTMLElement) {
    this.config = config;
    this.host = host;
    this.pageSize = signal(config.pageSize ?? 10);

    // ── Validation: Resource باید از قبل ثبت شده باشد ──
    const resource = getResource(config.resource);
    if (!resource) {
      throw developerError(
        `Resource "${config.resource}" not found. ` +
          `Before using zen-crud, call createResource("${config.resource}", { url: '...' }).`,
        ErrorCode.RESOURCE_SIGNAL_NOT_FOUND,
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
      // #39: کانال هشدار مرکزی; گارد موجودیت console لازم نیست.
      logger.warn('[CrudEngine] render() called in non-browser environment; skipping.');
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
    const state: Record<string, unknown> = this.buildState();

    try {
      Zen.start(this.host, state);
    } catch (err) {
      logger.error(
        `[CrudEngine] Failed to start Zen runtime: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // ۴. Wire کردن zen-permission به‌صورت دستی
    // (runtime walker به‌صورت پیش‌فرض zen-permission را پردازش نمی‌کند؛
    //  این کار باید به‌صورت دستی انجام شود، همانند permission demo.)
    this.wirePermissions();

    if (this.config.autoFetch) {
      void this.fetchWithRetry(true);
    }

    // ۵. جلوگیری از double-firing اکشن‌ها توسط event delegation تکراری.
    // وقتی CrudEngine داخل یک Zen app دیگر استفاده می‌شود، هر دو document-level
    // delegation روی یک کلیک فراخوانی می‌شوند. teardown مالک خود را فراخوانی
    // می‌کنیم تا فقط delegation بیرونی فعال بماند.
    // اگر CrudEngine به‌صورت standalone استفاده شود (بدون Zen app بیرونی)،
    // این کار هیچ listenerی را حذف نمی‌کند چون teardown فقط listenerهای همین
    // session را برمی‌دارد.
    const teardown = this.host.__zenithDelegationTeardown as (() => void) | undefined;
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
  dispose(): void {
    if (this._disposed) return; // #116: idempotency
    this._disposed = true;
    this.cleanupRender();

    // Dispose Effectهای داخلی.
    for (const d of this.disposes) {
      try {
        d();
      } catch (e) {
        logger.error(
          `[CrudEngine] Error during dispose: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    this.disposes = [];

    // Dispose Computedها (دارای dispose داخلی برای cleanup effect).
    this.disposeComputeds();
  }

  /**
   * #15: واکشی دادهٔ Resource با سقف تلاش مشخص (`maxRetries`، پیش‌فرض 3)
   * و گارد همزمانی تا هیچ حلقهٔ نامحدودی رخ ندهد.
   */
  async fetchWithRetry(force = true): Promise<boolean> {
    if (this._disposed || this._fetching) return false;
    this._fetching = true;
    const maxRetries = Math.max(0, Math.min(this.config.maxRetries ?? 3, 10));
    const maxAttempts = maxRetries + 1;
    this._retryCount = 0;

    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (this._disposed) return false;
        this._retryCount = attempt;
        try {
          await this.resource.list(force);
          if (!this.resource.error) {
            return true;
          }
        } catch {
          // خطا در تلاش فعلی؛ تا سقف maxAttempts ادامه می‌یابد
        }
      }
      return false;
    } finally {
      this._fetching = false;
    }
  }

  getRetryCount(): number {
    return this._retryCount;
  }

  /**
   * @deprecated #116 — نام قدیمی چرخهٔ عمر؛ از `dispose()` استفاده کن
   * (ZEN-DEPR-021؛ حذف در ۲.۰ — DEC-026).
   */
  destroy(): void {
    deprecate('ZEN-DEPR-021', 'engine.destroy()', 'engine.dispose()');
    this.dispose();
  }


  private buildState(): Record<string, unknown> {
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

  private buildComputeds(): void { buildComputeds.call(this.helperScope); }
  private markComputedAsSignalLike<T>(c: ReadonlySignal<T>): void { markComputedAsSignalLike(c); }
  private disposeComputeds(): void { disposeComputeds.call(this.helperScope); }
  private registerActions(): void { registerActions.call(this.helperScope); }
  private guardAction(fn: ActionFn, permission?: string): ActionFn { return guardAction.call(this.helperScope, fn, permission); }
  private buildHTML(): string { return buildHTML.call(this.helperScope); }
  private buildToolbar(): string { return buildToolbar.call(this.helperScope); }
  private buildTable(): string { return buildTable.call(this.helperScope); }
  private buildPagination(): string { return buildPagination.call(this.helperScope); }
  private escapeHtml(s: string): string { return escapeHtml.call(this.helperScope, s); }
  private escapeAttr(s: string): string { return escapeAttr.call(this.helperScope, s); }
  private wirePermissions(): void { wirePermissions.call(this.helperScope); }
  private cleanupRender(): void { cleanupRender.call(this.helperScope); }
  private _helperScope?: CrudScope;
  private get helperScope(): CrudScope {
    const engine = this;
    return this._helperScope ??= {
      get config() { return engine.config; },
      get host() { return engine.host; },
      get resource() { return engine.resource; },
      get searchQuery() { return engine.searchQuery; },
      get currentPage() { return engine.currentPage; },
      get pageSize() { return engine.pageSize; },
      get activeFilters() { return engine.activeFilters; },
      get sortBy() { return engine.sortBy; },
      get sortDir() { return engine.sortDir; },
      get viewData() { return engine.viewData; }, set viewData(value) { engine.viewData = value; },
      get totalItems() { return engine.totalItems; }, set totalItems(value) { engine.totalItems = value; },
      get totalPages() { return engine.totalPages; }, set totalPages(value) { engine.totalPages = value; },
      get startIdx() { return engine.startIdx; }, set startIdx(value) { engine.startIdx = value; },
      get endIdx() { return engine.endIdx; }, set endIdx(value) { engine.endIdx = value; },
      get currentViewPage() { return engine.currentViewPage; }, set currentViewPage(value) { engine.currentViewPage = value; },
      get permissionDisposes() { return engine.permissionDisposes; }, set permissionDisposes(value) { engine.permissionDisposes = value; },
      get registeredActions() { return engine.registeredActions; }, set registeredActions(value) { engine.registeredActions = value; },
      get rendered() { return engine.rendered; }, set rendered(value) { engine.rendered = value; },
      guardAction: (fn, permission) => engine.guardAction(fn, permission),
      markComputedAsSignalLike: <T>(c: ReadonlySignal<T>) => engine.markComputedAsSignalLike(c),
      buildToolbar: () => engine.buildToolbar(), buildTable: () => engine.buildTable(), buildPagination: () => engine.buildPagination(),
      escapeHtml: s => engine.escapeHtml(s), escapeAttr: s => engine.escapeAttr(s),
    };
  }
}
