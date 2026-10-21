import type { CrudScope } from './scope';

/** Private engine helper. @internal */
export function buildHTML(this: CrudScope): string {
  const inner = this.buildToolbar() + this.buildTable() + this.buildPagination();

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

/** Private engine helper. @internal */
export function buildToolbar(this: CrudScope): string {
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
        (opt) =>
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

/** Private engine helper. @internal */
export function buildTable(this: CrudScope): string {
  const res = this.config.resource;
  const hasRowActions = (this.config.rowActions ?? []).length > 0;

  // ── Head Cells ──
  const headCells = this.config.columns
    .map((col) => {
      const label = col.label ?? col.field;
      if (col.sortable) {
        const actionName = `__crud_${res}_sort_${col.field}`;
        // نشانگر sort: ↑ یا ↓ بر اساس sortBy و sortDir.
        // سینتکس: ternary تودرتو (سینتکس استاندارد Zenith Expression).
        const indicator = `$sortBy === '${col.field}' ? ($sortDir === 'asc' ? ' ↑' : ' ↓') : ''`;
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
    .map((col) => `<td zen-text="$item.${this.escapeAttr(col.field)}"></td>`)
    .join('');

  let bodyRow = `<tr zen-for="item in $viewData" zen-key="item.id">${bodyCells}`;
  if (hasRowActions) {
    const actionButtons = (this.config.rowActions ?? [])
      .map((action) => {
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

/** Private engine helper. @internal */
export function buildPagination(this: CrudScope): string {
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

/** Private engine helper. @internal */
export function escapeHtml(this: CrudScope, s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Private engine helper. @internal */
export function escapeAttr(this: CrudScope, s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
