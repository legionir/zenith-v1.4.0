// benchmarks/dom-suite.js
// #86 — the DOM part of the suite: the js-framework-benchmark *list* operations
// (create 1k/10k rows, replace all, partial update, select, swap, remove,
// append 1k to 10k, clear) on a real `<table><tbody>` tree.
//
// This file is deliberately ONE self-contained function without imports or
// closure captures: `npm run bench` calls it with a jsdom document, and
// `npm run bench:browser` can serialize the very same function into a real
// browser via Playwright `page.evaluate(runDomListSuite, …)`. Row markup
// mirrors js-framework-benchmark (4 cells + label link + remove link) so the
// operations are comparable in shape.
//
// Why this shape (jsdom is ~100× slower than a browser, #86):
//   1. **No global `document.querySelectorAll`** in any measured path: jsdom
//      caches a live node list on the document root and then re-scans the whole
//      document on every later mutation (measured: clearing 10k rows goes from
//      ~0.2s to ~6s). The select operation therefore tracks the previously
//      selected row directly, like real frameworks do.
//   2. **Repetitions.** Sub-millisecond DOM operations cannot be timed
//      reliably, so light operations repeat K times inside the measured region
//      and the REPORTED value is the per-operation time (total / K).
//   3. **Sampling policy.** Every operation gets two discarded warmup units,
//      then 7 samples — 5 when a warmup unit already costs more than 250ms (the
//      10k-row operations) so the whole suite stays under a minute.
//   4. **The reported number is the MINIMUM sample, not the mean.** GC pauses,
//      scheduler preemption and frequency scaling only ever ADD time, so the
//      fastest observed run is the most reproducible estimator; median and
//      `spreadPct` still ship with every row so noise stays visible.

/** فهرست عملیات استاندارد (نام، برچسب، تعداد ردیف لیست، تکرار در هر نمونه). */
export const DOM_SUITE_OPERATIONS = [
  { id: 'create-1k', label: 'ساخت ۱۰۰۰ ردیف', rows: 1_000, repeat: 1 },
  { id: 'replace-all-1k', label: 'جایگزینی کامل ۱۰۰۰ ردیف', rows: 1_000, repeat: 2 },
  { id: 'partial-update-1k', label: 'به‌روزرسانی هر ۱۰ ردیف (۱۰۰ ردیف)', rows: 1_000, repeat: 10 },
  { id: 'select-1k', label: 'انتخاب/لغو انتخاب یک ردیف', rows: 1_000, repeat: 500 },
  { id: 'swap-rows-1k', label: 'جابه‌جایی ردیف ۲ و ۹۹۹', rows: 1_000, repeat: 100 },
  { id: 'remove-row-1k', label: 'حذف ردیف میانی', rows: 1_000, repeat: 500 },
  { id: 'create-10k', label: 'ساخت ۱۰۰۰۰ ردیف', rows: 10_000, repeat: 1 },
  { id: 'append-1k-to-10k', label: 'افزودن ۱۰۰۰ ردیف به لیست ۱۰۰۰۰ ردیفی', rows: 10_000, repeat: 1 },
  { id: 'clear-1k', label: 'پاک‌کردن ۱۰۰۰ ردیف', rows: 1_000, repeat: 128 },
];

/**
 * اجرای عملیات لیست روی یک `document` (jsdom یا مرورگر واقعی).
 * @param {Document} doc سندی که یک `<table><tbody id="tbody">` دارد
 * @param {{ runs?: number, warmupRuns?: number, heavyThresholdMs?: number }} [options]
 * @returns {Array<{id: string, ms: number, medianMs: number, runs: number, rows: number, repeat: number, spreadPct: number}>}
 */
export function runDomListSuite(doc, options) {
  const opts = options || {};
  const warmupRuns = opts.warmupRuns === undefined ? 1 : opts.warmupRuns;
  const heavyThresholdMs = opts.heavyThresholdMs === undefined ? 250 : opts.heavyThresholdMs;
  if (!doc || typeof doc.createElement !== 'function') {
    throw new Error('dom-suite: a Document is required');
  }
  const clock = (doc.defaultView && doc.defaultView.performance) || globalThis.performance;

  const makeRow = (id, label) => {
    const tr = doc.createElement('tr');
    const tdId = doc.createElement('td');
    tdId.className = 'col-md-1';
    tdId.textContent = String(id);
    const tdLabel = doc.createElement('td');
    tdLabel.className = 'col-md-4';
    const link = doc.createElement('a');
    link.className = 'lbl';
    link.textContent = label;
    tdLabel.appendChild(link);
    const tdRemove = doc.createElement('td');
    tdRemove.className = 'col-md-1';
    const remove = doc.createElement('a');
    remove.className = 'remove';
    const glyph = doc.createElement('span');
    glyph.className = 'glyphicon glyphicon-remove';
    glyph.setAttribute('aria-hidden', 'true');
    remove.appendChild(glyph);
    tdRemove.appendChild(remove);
    const tdSpacer = doc.createElement('td');
    tdSpacer.className = 'col-md-6';
    tr.appendChild(tdId);
    tr.appendChild(tdLabel);
    tr.appendChild(tdRemove);
    tr.appendChild(tdSpacer);
    return tr;
  };

  const tbodyOf = () => {
    const tbody = doc.getElementById('tbody');
    if (!tbody) throw new Error('dom-suite: <tbody id="tbody"> not found');
    return tbody;
  };

  const fill = (tbody, count, fromId) => {
    const fragment = doc.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const id = (fromId || 0) + i;
      fragment.appendChild(makeRow(id, 'Item ' + id));
    }
    tbody.appendChild(fragment);
  };

  const build = (count) => {
    const tbody = tbodyOf();
    tbody.replaceChildren();
    fill(tbody, count, 0);
  };

  const replaceAll = () => {
    const tbody = tbodyOf();
    const fragment = doc.createDocumentFragment();
    for (let i = 0; i < 1_000; i++) fragment.appendChild(makeRow(i, 'Item ' + i));
    tbody.replaceChildren(fragment);
  };

  const partialUpdate = () => {
    const rows = tbodyOf().children;
    for (let i = 0; i < rows.length; i += 10) {
      const label = rows[i].querySelector('.lbl');
      if (label) label.textContent = label.textContent + ' !!!';
    }
  };

  let selectedRow = null;
  const select = (n) => {
    const rows = tbodyOf().children;
    const row = rows[(n * 37 + 1) % rows.length];
    if (selectedRow && selectedRow.isConnected) {
      selectedRow.className = '';
      selectedRow.setAttribute('aria-selected', 'false');
    }
    row.className = 'danger';
    row.setAttribute('aria-selected', 'true');
    selectedRow = row;
  };

  const swapRows = () => {
    const tbody = tbodyOf();
    const rows = tbody.children;
    if (rows.length < 999) return;
    const first = rows[1];
    const last = rows[998];
    const marker = doc.createElement('tr');
    tbody.replaceChild(marker, first);
    tbody.replaceChild(first, last);
    tbody.replaceChild(last, marker);
  };

  const removeRow = () => {
    const rows = tbodyOf().children;
    const target = rows[rows.length >> 1];
    if (target) target.remove();
  };

  const clear = () => {
    tbodyOf().replaceChildren();
  };

  const timed = (fn, prepare, rows, repeat) => {
    const rep = repeat || 1;
    const unit = () => {
      for (let r = 0; r < rep; r++) fn(r);
    };
    let lastWarmup = 0;
    for (let i = 0; i < warmupRuns; i++) {
      prepare();
      const warmStart = clock.now();
      unit();
      lastWarmup = clock.now() - warmStart;
    }
    // «آخرین» warmup (steady state) ملاک است، نه اولین/سردترین — وگرنه هر
    // عملیات ارزانی که اولین اجرایش کند است فقط ۳ نمونه می‌گیرد.
    const runs = opts.runs || (lastWarmup > heavyThresholdMs ? 5 : 7);
    const samples = [];
    for (let i = 0; i < runs; i++) {
      prepare();
      const start = clock.now();
      unit();
      samples.push((clock.now() - start) / rep);
    }
    const sorted = samples.slice().sort((x, y) => x - y);
    const mid = sorted.length >> 1;
    const med = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    const spreadPct = med > 0 ? Math.round(((sorted[sorted.length - 1] - sorted[0]) / med) * 10000) / 100 : 0;
    return {
      ms: Math.round(sorted[0] * 1000) / 1000,
      medianMs: Math.round(med * 1000) / 1000,
      runs,
      rows,
      repeat: rep,
      spreadPct,
    };
  };

  const noop = () => {};
  const list1k = () => build(1_000);
  const list10k = () => build(10_000);

  const ops = [
    { id: 'create-1k', rows: 1_000, repeat: 1, fn: () => build(1_000), prepare: noop },
    { id: 'replace-all-1k', rows: 1_000, repeat: 2, fn: replaceAll, prepare: list1k },
    { id: 'partial-update-1k', rows: 1_000, repeat: 10, fn: partialUpdate, prepare: list1k },
    { id: 'select-1k', rows: 1_000, repeat: 500, fn: select, prepare: list1k },
    { id: 'swap-rows-1k', rows: 1_000, repeat: 100, fn: swapRows, prepare: list1k },
    { id: 'remove-row-1k', rows: 1_000, repeat: 500, fn: removeRow, prepare: list1k },
    { id: 'create-10k', rows: 10_000, repeat: 1, fn: () => build(10_000), prepare: noop },
    {
      id: 'append-1k-to-10k',
      rows: 10_000,
      repeat: 1,
      // ⚠️ هرگز `children.length` خوانده نمی‌شود: خواندن یک HTMLCollection زنده
      // در jsdom کش را فعال می‌کند و پاک‌کردن لیست در نمونهٔ بعدی O(n²) می‌شود
      // (اندازه‌گیری‌شده: ۷s برای ۱۱k ردیف به‌جای ۰٫۲s). شناسه از ۱۰۰۰۰ شروع می‌شود.
      fn: () => fill(tbodyOf(), 1_000, 10_000),
      prepare: list10k,
    },
    { id: 'clear-1k', rows: 1_000, repeat: 128, fn: clear, prepare: list1k },
  ];

  // `only` (اختیاری): اجرای زیرمجموعه — suite.mjs هر عملیات را در یک سند تازه
  // اجرا می‌کند تا کش‌های live collection سند از عملیات قبلی آلوده نشوند.
  const only = opts.only;
  const selected = only ? ops.filter((op) => only.indexOf(op.id) !== -1) : ops;

  return selected.map((op) => ({
    id: op.id,
    ...timed(op.fn, op.prepare, op.rows, op.repeat),
  }));
}
