import { computed, type ReadonlySignal } from '@zenith/state';
import type { CrudScope } from './scope';

/** Private engine helper. @internal */
export function buildComputeds(this: CrudScope): void {
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
    // Property-bag assumption is legacy behavior, not response decoding.
    let result = [...raw] as Record<string, unknown>[];
    const filters = this.activeFilters.get();
    for (const [field, value] of Object.entries(filters)) {
      if (value !== '' && value != null) {
        result = result.filter((item) => String(item[field]) === String(value));
      }
    }

    // ── ۲. Search ──
    const q = this.searchQuery.get().trim().toLowerCase();
    if (q) {
      const fields = this.config.searchFields ?? this.config.columns.map((c) => c.field);
      result = result.filter((item) =>
        fields.some((f) =>
          String(item[f] ?? '')
            .toLowerCase()
            .includes(q),
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

/** Private engine helper. @internal */
export function markComputedAsSignalLike<T>(c: ReadonlySignal<T>): void {
  const obj = c;
  if (typeof Reflect.get(obj, 'set') !== 'function') {
    Object.assign(obj, { set: function () {
      // Legacy no-op marker only: never advertised as a writable Signal.
    } });
  }
}

/** Private engine helper. @internal */
export function disposeComputeds(this: CrudScope): void {
  const list: Array<{ dispose?(): void } | undefined> = [
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
