// packages/crud/dist/crud-engine.js
//
// FEATURE (v0.3.0): @zenith/crud — HTML CRUD Engine (zen-crud directive).
//
// (Compiled from src/crud-engine.ts — no type annotations.)
//
// این ماژول «موتور CRUD HTML» را پیاده‌سازی می‌کند — بزرگ‌ترین مزیت تجاری Zenith.
// با یک attribute واحد (`zen-crud`)، یک جدول کامل CRUD با Pagination، Filters،
// Search، Sort، Actions و Permission checks به‌صورت خودکار تولید می‌شود.

import { signal, effect, computed } from '@zenith/state';
import { getResource } from '@zenith/resource';
import { Zen } from '@zenith/runtime';
import { getAction } from '@zenith/actions';
import { processPermission, getPermissionManager } from '@zenith/permission';

// ─────────────────────────────────────────────────────────────────────────
// FEATURE (v0.3.0): CrudEngine
// ─────────────────────────────────────────────────────────────────────────

export class CrudEngine {
  constructor(config, host) {
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

    // Reactive state (Signals)
    this.searchQuery = signal('');
    this.currentPage = signal(1);
    this.activeFilters = signal({});
    this.sortBy = signal(null);
    this.sortDir = signal('asc');

    // Cleanup trackers
    this.disposes = [];
    this.permissionDisposes = [];
    this.registeredActions = [];
    this.firstFilterRun = true;
    this.rendered = false;

    // ── Build Computeds ──
    this.buildComputeds();

    // ── Reset to page 1 when filters or search change ──
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
   * این متد SSR-safe است: در محیط Node.js no-op است.
   */
  render() {
    // SSR safety
    if (typeof document === 'undefined') {
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
    const state = this.buildState();
    try {
      Zen.start(this.host, state);
    } catch (err) {
      console.error('[CrudEngine] Failed to start Zen runtime:', err);
    }

    // ۴. Wire کردن zen-permission به‌صورت دستی
    this.wirePermissions();
  }

  /**
   * پاکسازی کامل: dispose Effectها، حذف Actionهای دینامیک، پاکسازی DOM.
   */
  destroy() {
    this.cleanupRender();

    // Dispose Effectهای داخلی.
    for (const d of this.disposes) {
      try { d(); } catch (e) {
        console.error('[CrudEngine] Error during dispose:', e);
      }
    }
    this.disposes = [];

    // Dispose Computedها.
    this.disposeComputeds();
  }

  // ─────────────────────────────────────────────────────────────────────
  // Internal: Computed Construction
  // ─────────────────────────────────────────────────────────────────────

  buildComputeds() {
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
    this.currentViewPage = computed(() => {
      const cp = this.currentPage.get();
      const tp = this.totalPages.get();
      if (cp > tp) {
        return tp;
      }
      return cp;
    });

    // ── viewData: لیست آیتم‌های صفحه‌ی فعلی (filter → search → sort → paginate) ──
    this.viewData = computed(() => {
      const raw = this.resource.data;
      if (!Array.isArray(raw) || raw.length === 0) return [];

      // ۱. Filter
      let result = [...raw];
      const filters = this.activeFilters.get();
      for (const [field, value] of Object.entries(filters)) {
        if (value !== '' && value != null) {
          result = result.filter(
            item => String(item[field]) === String(value),
          );
        }
      }

      // ۲. Search
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

      // ۳. Sort
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

      // ۴. Paginate
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
    // این محدودیت را دور می‌زنیم.
    this.markComputedAsSignalLike(this.viewData);
    this.markComputedAsSignalLike(this.totalItems);
    this.markComputedAsSignalLike(this.totalPages);
    this.markComputedAsSignalLike(this.startIdx);
    this.markComputedAsSignalLike(this.endIdx);
    this.markComputedAsSignalLike(this.currentViewPage);
  }

  markComputedAsSignalLike(c) {
    if (typeof c.set !== 'function') {
      c.set = function () {
        // No-op: Computedها فقط‌خواندنی هستند.
      };
    }
  }

  disposeComputeds() {
    const list = [
      this.viewData,
      this.totalItems,
      this.totalPages,
      this.startIdx,
      this.endIdx,
      this.currentViewPage,
    ];
    for (const c of list) {
      if (c && typeof c.dispose === 'function') {
        try { c.dispose(); } catch {
          // ignore
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Internal: Action Registration
  // ─────────────────────────────────────────────────────────────────────

  registerActions() {
    const res = this.config.resource;

    // ── Sort Actions ──
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
    Zen.action(gotoAction, this.guardAction(({ element }) => {
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
        this.guardAction((ctx) => {
          if (action.confirm) {
            const msg = `آیا از «${action.label}» مطمئن هستید؟`;
            if (typeof confirm === 'function' && !confirm(msg)) return;
          }
          const userAction = getAction(action.action);
          if (userAction) {
            try { userAction(ctx); } catch (e) {
              console.error(`[CrudEngine] Row action "${action.action}" failed:`, e);
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
        this.guardAction((ctx) => {
          const userAction = getAction(action.action);
          if (userAction) {
            try { userAction(ctx); } catch (e) {
              console.error(`[CrudEngine] Table action "${action.action}" failed:`, e);
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
   */
  guardAction(fn, permission) {
    return (ctx) => {
      const event = ctx?.event;
      if (event && typeof event === 'object') {
        if (event.__crudHandled) return;
        event.__crudHandled = true;
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
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Internal: HTML Construction
  // ─────────────────────────────────────────────────────────────────────

  buildState() {
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

  buildHTML() {
    const inner = this.buildToolbar() + this.buildTable() + this.buildPagination();
    if (this.config.permission) {
      return (
        `<div class="zen-crud" zen-permission="${this.escapeAttr(this.config.permission)}">` +
        inner +
        `</div>`
      );
    }
    return `<div class="zen-crud">${inner}</div>`;
  }

  buildToolbar() {
    const parts = [];
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
        .map(opt =>
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

  buildTable() {
    const res = this.config.resource;
    const hasRowActions = (this.config.rowActions ?? []).length > 0;

    // ── Head Cells ──
    const headCells = this.config.columns
      .map(col => {
        const label = col.label ?? col.field;
        if (col.sortable) {
          const actionName = `__crud_${res}_sort_${col.field}`;
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

    // ── Body Cells ──
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

  buildPagination() {
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

  wirePermissions() {
    for (const d of this.permissionDisposes) {
      try { d(); } catch {
        // ignore
      }
    }
    this.permissionDisposes = [];

    const permissionEls = this.host.querySelectorAll('[zen-permission]');
    for (const el of Array.from(permissionEls)) {
      const expr = el.getAttribute('zen-permission') || '';
      el.removeAttribute('zen-permission');
      try {
        const d = processPermission(el, expr);
        this.permissionDisposes.push(d);
      } catch (e) {
        console.error('[CrudEngine] Failed to wire zen-permission:', e);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Internal: Cleanup
  // ─────────────────────────────────────────────────────────────────────

  cleanupRender() {
    // Dispose permission effects.
    for (const d of this.permissionDisposes) {
      try { d(); } catch {
        // ignore
      }
    }
    this.permissionDisposes = [];

    // Dispose walker-created effects on the host.
    if (typeof document !== 'undefined' && this.host) {
      const disposes = this.host.__zenithDisposes;
      if (disposes) {
        for (const d of disposes) {
          try { d(); } catch {
            // ignore
          }
        }
        disposes.length = 0;
        delete this.host.__zenithDisposes;
      }

      // Remove event delegation listeners created by Zen.start.
      const teardown = this.host.__zenithDelegationTeardown;
      if (typeof teardown === 'function') {
        try { teardown(); } catch {
          // ignore
        }
        delete this.host.__zenithDelegationTeardown;
      }

      // Clear host content.
      this.host.innerHTML = '';
    }

    // Unregister dynamic actions.
    for (const name of this.registeredActions) {
      try { Zen.action.unregister(name); } catch {
        // ignore
      }
    }
    this.registeredActions = [];

    this.rendered = false;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Internal: Helpers
  // ─────────────────────────────────────────────────────────────────────

  escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  escapeAttr(s) {
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
 * @param el         عنصری که zen-crud روی آن تعریف شده.
 * @param configAttr مقدار attribute: JSON string یا $variableName.
 * @param context    Context فعلی (شامل $<name> keys).
 * @returns تابع dispose برای پاکسازی.
 */
export function processCrud(el, configAttr, context) {
  // SSR safety
  if (typeof document === 'undefined') {
    return () => {};
  }

  // ── Parse configAttr ──
  let config;
  const trimmed = configAttr.trim();

  if (trimmed.startsWith('$')) {
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
    try {
      config = JSON.parse(trimmed);
    } catch (e) {
      console.error(`[CrudEngine] Invalid JSON config:`, e);
      return () => {};
    }
  }

  // ── Validation ──
  if (!config || typeof config !== 'object' || !config.resource) {
    console.error(`[CrudEngine] Invalid config: missing "resource" property.`);
    return () => {};
  }

  // ── Create engine and render ──
  let engine;
  try {
    engine = new CrudEngine(config, el);
  } catch (e) {
    console.error(`[CrudEngine] Failed to create engine:`, e);
    return () => {};
  }

  engine.render();

  return () => {
    try { engine.destroy(); } catch (e) {
      console.error('[CrudEngine] Error during destroy:', e);
    }
  };
}
