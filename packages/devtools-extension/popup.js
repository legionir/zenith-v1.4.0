// popup.js — Zenith DevTools popup with 5 panels:
//   1. Signal Inspector — list all signals with values and subscriber counts
//   2. Timeline — state change history
//   3. Component Tree — hierarchical view of registered components
//   4. Effect Viewer — active/disposed effects with dependencies
//   5. Graph Viewer  — opens the live dependency-graph viewer in a new tab

// #67 (SEC): همهٔ داده‌ای که از صفحهٔ بازدید‌شده می‌آید از این schema رد می‌شود و
// رندر — بدون استثنا — با DOM API (`textContent`) انجام می‌شود؛ هیچ رشتهٔ HTML
// ساخته نمی‌شود، پس هیچ `innerHTML` با دادهٔ غیرقابل‌اعتماد نداریم.
const schema = globalThis.ZenithDevtoolsSchema;
if (!schema) {
  throw new Error('[Zenith DevTools] message-schema.js must be loaded before popup.js');
}

/** ساخت یک element سادهٔ متن‌محور (بدون HTML). */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

/** جایگزینی کامل محتوای یک container با گره‌های ساخته‌شده. */
function replaceChildren(container, nodes) {
  container.replaceChildren();
  for (const node of nodes) container.appendChild(node);
}

document.addEventListener('DOMContentLoaded', () => {
  const statusBar = document.getElementById('status-bar');
  const clearBtn = document.getElementById('clear');

  // ─── Tab switching ──────────────────────────────────────────
  let activeTab = 'signals';
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      const tabName = tab.dataset.tab;
      activeTab = tabName;
      document.getElementById('panel-' + tabName).classList.add('active');
      // Clicking the Graph tab also opens the live graph viewer in a new tab.
      if (tabName === 'graph') loadGraph();
      // Lazy render v1 features when tab becomes active (BUG-DEVTEXT-05)
      if (tabName === 'v1' && window._v1Data) {
        renderV1Features(window._v1Data);
      }
    });
  });

  // ─── Refresh ────────────────────────────────────────────────
  document.getElementById('refresh').addEventListener('click', () => fetchData());
  clearBtn.addEventListener('click', () => {
    if (confirm('Clear all DevTools data?')) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'ZENITH_CLEAR' }, () => fetchData());
        }
      });
    }
  });

  // Graph Viewer button — opens the live dependency-graph viewer in a new tab.
  const openGraphBtn = document.getElementById('open-graph');
  if (openGraphBtn) {
    openGraphBtn.addEventListener('click', () => loadGraph());
  }

  // ─── Configurable refresh interval (BUG-DEVTEXT-02 / IMP-DEVTEXT-01) ──
  // ذخیره‌سازی interval در localStorage تا بین جلسات حفظ شود
  const STORAGE_KEY = 'zenith_devtools_refresh_interval';
  function getRefreshInterval() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      var val = stored ? parseInt(stored, 10) : 2000;
      // محدوده: 500ms تا 30000ms
      return Math.max(500, Math.min(30000, isNaN(val) ? 2000 : val));
    } catch (e) {
      return 2000;
    }
  }
  function setRefreshInterval(ms) {
    try {
      localStorage.setItem(STORAGE_KEY, String(ms));
    } catch (e) {
      /* ignore */
    }
  }

  // Interval control UI
  var intervalInput = document.createElement('input');
  intervalInput.type = 'range';
  intervalInput.min = '500';
  intervalInput.max = '5000';
  intervalInput.step = '100';
  intervalInput.value = String(getRefreshInterval());
  intervalInput.title = 'Refresh interval: ' + intervalInput.value + 'ms';
  intervalInput.style.width = '80px';
  intervalInput.style.marginRight = '6px';
  intervalInput.style.verticalAlign = 'middle';
  intervalInput.addEventListener('input', function () {
    restartAutoRefresh(parseInt(this.value, 10));
    this.title = 'Refresh interval: ' + this.value + 'ms';
  });

  var intervalLabel = document.createElement('span');
  intervalLabel.style.fontSize = '0.65rem';
  intervalLabel.style.color = '#64748b';
  intervalLabel.textContent = intervalInput.value + 'ms';

  intervalInput.addEventListener('input', function () {
    intervalLabel.textContent = this.value + 'ms';
  });

  // اضافه کردن interval control به نوار کنترل
  var controls = document.querySelector('.controls');
  if (controls) {
    var wrapper = document.createElement('span');
    wrapper.style.display = 'inline-flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '4px';
    wrapper.style.marginLeft = 'auto';
    wrapper.appendChild(intervalLabel);
    wrapper.appendChild(intervalInput);
    controls.appendChild(wrapper);
  }

  // Initial fetch
  fetchData();

  // ─── Auto-refresh ───────────────────────────────────────────
  var autoRefreshTimer = null;
  function restartAutoRefresh(intervalMs) {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
    var ms = intervalMs || getRefreshInterval();
    setRefreshInterval(ms);
    intervalLabel.textContent = ms + 'ms';
    intervalInput.value = String(ms);
    autoRefreshTimer = setInterval(fetchData, ms);
  }
  restartAutoRefresh();

  function fetchData() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) {
        statusBar.textContent = '❌ تب فعالی یافت نشد';
        statusBar.className = 'status-bar disconnected';
        return;
      }

      chrome.tabs.sendMessage(tabs[0].id, { type: 'ZENITH_REFRESH' }, (response) => {
        if (chrome.runtime.lastError) {
          // BUG-DEVTEXT-07: نمایش خطای دقیق‌تر به جای پیام generic
          var errMsg = chrome.runtime.lastError.message || 'خطای ناشناخته';
          statusBar.textContent = '❌ خطا در ارتباط: ' + errMsg.substring(0, 50);
          statusBar.className = 'status-bar disconnected';
          document.querySelectorAll('.empty').forEach(function (e) {
            e.textContent = '—';
          });
          return;
        }

        if (!response || !response.installed) {
          statusBar.textContent = '❌ Zenith در این صفحه فعال نیست';
          statusBar.className = 'status-bar disconnected';
          document.querySelectorAll('.empty').forEach(function (e) {
            e.textContent = '—';
          });
          return;
        }

        // #67: پاسخ content script پیش از هر رندری schema-check می‌شود
        // (فیلدهای ناشناخته حذف، متن‌ها سقف‌دار، اعداد clamp).
        const data = schema.sanitizeInspectionResponse(response);
        if (!data || !data.installed) {
          statusBar.textContent = '❌ پاسخ نامعتبر از content script (schema)';
          statusBar.className = 'status-bar disconnected';
          return;
        }

        statusBar.textContent =
          '✅ Zenith v' + data.version + ' — ' + data.signalCount + ' signals';
        statusBar.className = 'status-bar connected';
        document.getElementById('version').textContent = 'v' + data.version;
        renderSignals(data.signals);
        renderTimeline(data.timeline);
        renderComponents(data.components);
        renderEffects(data.effects);
        // FEATURE (v1.0.0): lazy render — فقط در صورت فعال بودن تب v1 رندر کن
        // در غیر این صورت داده رو ذخیره کن تا وقتی تب فعال شد رندر بشه
        window._v1Data = data;
        if (activeTab === 'v1') {
          renderV1Features(data);
        }
      });
    });
  }

  // ─── Graph Viewer ───────────────────────────────────────────
  // Queries the active tab, runs window.__ZENITH__.getDependencyGraph() in the
  // page via chrome.scripting.executeScript, base64-encodes the resulting
  // GraphSnapshot, and opens graph-viewer.html?data=<b64> in a new tab so the
  // existing self-contained SVG viewer can render it.
  function loadGraph() {
    const statusEl = document.getElementById('graph-status');
    if (statusEl) statusEl.textContent = 'در حال دریافت گراف...';

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) {
        if (statusEl) statusEl.textContent = '❌ تب فعالی یافت نشد';
        return;
      }
      const tabId = tabs[0].id;

      chrome.scripting.executeScript(
        {
          target: { tabId },
          func: () => {
            const hook = window.__ZENITH__;
            if (!hook || typeof hook.getDependencyGraph !== 'function') return null;
            try {
              return hook.getDependencyGraph();
            } catch (e) {
              return { error: String(e) };
            }
          },
        },
        (results) => {
          if (chrome.runtime.lastError || !results || !results[0]) {
            if (statusEl) statusEl.textContent = '❌ تزریق اسکریپت ناموفق بود';
            return;
          }
          const raw = results[0].result;
          if (!raw) {
            if (statusEl) statusEl.textContent = '❌ Zenith در این صفحه فعال نیست';
            return;
          }
          // #67: دادهٔ صفحهٔ میزبان قبل از رمزگذاری اعتبارسنجی می‌شود؛ گراف ناسازگار
          // هرگز به `graph-viewer.html` نمی‌رسد (سقف node/edge + نوع فیلدها).
          const check = schema.sanitizeGraphPayload(raw);
          if (!check.ok) {
            if (statusEl) statusEl.textContent = '❌ دادهٔ گراف نامعتبر (' + check.reason + ')';
            return;
          }
          let json;
          try {
            json = JSON.stringify(check.value);
          } catch (e) {
            json = '{}';
          }
          // UTF-8 safe base64 encode (handles non-ASCII signal names / values).
          const b64 = btoa(unescape(encodeURIComponent(json)));
          const url = chrome.runtime.getURL('graph-viewer.html') + '?data=' + b64;
          chrome.tabs.create({ url });
          if (statusEl) statusEl.textContent = '✅ گراف در تب جدید باز شد';
        },
      );
    });
  }

  function renderSignals(signals) {
    const list = document.getElementById('signals-list');
    const empty = document.getElementById('signals-empty');

    if (!signals || signals.length === 0) {
      empty.style.display = 'block';
      replaceChildren(list, []);
      return;
    }
    empty.style.display = 'none';

    replaceChildren(
      list,
      signals.map((s) => {
        let valStr;
        try {
          valStr = typeof s.value === 'object' ? JSON.stringify(s.value, null, 2) : String(s.value);
        } catch {
          valStr = String(s.value);
        }
        if (valStr.length > 200) valStr = valStr.substring(0, 200) + '...';

        const item = el('div', 'signal-item');
        const header = el('div', 'signal-header');
        const left = el('span', null);
        left.appendChild(el('span', 'signal-id', '#' + s.id));
        if (s.name) left.appendChild(el('span', 'signal-name', s.name));
        header.appendChild(left);
        header.appendChild(el('span', 'signal-count', s.subscriberCount + ' subs'));
        item.appendChild(header);
        item.appendChild(el('div', 'signal-value', valStr));
        return item;
      }),
    );
  }

  function renderTimeline(timeline) {
    const list = document.getElementById('timeline-list');
    const empty = document.getElementById('timeline-empty');

    if (!timeline || timeline.length === 0) {
      empty.style.display = 'block';
      replaceChildren(list, []);
      return;
    }
    empty.style.display = 'none';

    const recent = timeline.slice(-20).reverse();
    replaceChildren(
      list,
      recent.map((c) => {
        const time = new Date(c.timestamp).toLocaleTimeString();
        const oldStr = formatVal(c.oldValue);
        const newStr = formatVal(c.newValue);

        const item = el('div', 'timeline-item');
        const label =
          time + ' — Signal #' + c.signalId + (c.signalName ? ' (' + c.signalName + ')' : '');
        item.appendChild(el('div', 'timeline-time', label));
        const change = el('div', 'timeline-change');
        change.appendChild(el('span', 'timeline-old', oldStr));
        change.appendChild(document.createTextNode(' → '));
        change.appendChild(el('span', 'timeline-new', newStr));
        item.appendChild(change);
        return item;
      }),
    );
  }

  function renderComponents(components) {
    const tree = document.getElementById('components-tree');
    const empty = document.getElementById('components-empty');

    if (!components || components.length === 0) {
      empty.style.display = 'block';
      replaceChildren(tree, []);
      return;
    }
    empty.style.display = 'none';

    replaceChildren(
      tree,
      components.map((c) => {
        const node = el('div', 'tree-node');
        node.appendChild(el('span', 'tree-tag', '<' + c.name + '>'));
        if (c.used) node.appendChild(el('span', 'tree-attr', 'used ' + c.used + 'x'));
        return node;
      }),
    );
  }

  function renderEffects(effects) {
    const list = document.getElementById('effects-list');
    const empty = document.getElementById('effects-empty');

    if (!effects || effects.length === 0) {
      empty.style.display = 'block';
      replaceChildren(list, []);
      return;
    }
    empty.style.display = 'none';

    replaceChildren(
      list,
      effects.map((e) => {
        const item = el('div', 'effect-item');
        const header = el('div', 'signal-header');
        const left = el('span', null);
        left.appendChild(el('span', 'effect-id', 'Effect #' + e.id));
        if (e.source) left.appendChild(el('span', 'effect-deps', e.source));
        header.appendChild(left);
        header.appendChild(
          el(
            'span',
            'effect-status ' + (e.disposed ? 'disposed' : 'active'),
            e.disposed ? 'Disposed' : 'Active',
          ),
        );
        item.appendChild(header);
        if (e.dependencies && e.dependencies.length > 0) {
          item.appendChild(el('div', 'effect-deps', 'Deps: ' + e.dependencies.join(', ')));
        }
        return item;
      }),
    );
  }

  // ─── FEATURE (v1.0.0): v1.0 Features Rendering ──────────────
  function renderV1Features(response) {
    // zen-static Fast Path
    const staticFors = response.staticFors || [];
    document.getElementById('static-count').textContent = staticFors.length;
    document.getElementById('static-detail').textContent =
      staticFors.length > 0
        ? `${staticFors.reduce((s, f) => s + f.itemCount, 0)} آیتم total`
        : 'لیست‌های فقط‌خواندنی با fast path';

    const staticList = document.getElementById('static-list');
    replaceChildren(
      staticList,
      staticFors.map((f) => {
        const item = el('div', 'signal-item');
        item.style.borderColor = '#166534';
        const header = el('div', 'signal-header');
        const left = el('span', null);
        left.appendChild(el('span', 'badge-static', 'STATIC'));
        left.appendChild(el('span', 'signal-name', f.expr));
        header.appendChild(left);
        header.appendChild(el('span', 'signal-count', f.itemCount + ' items'));
        item.appendChild(header);
        return item;
      }),
    );

    // Resource Destroyed
    const destroyed = response.destroyedResources || [];
    document.getElementById('destroyed-count').textContent = destroyed.length;
    document.getElementById('destroyed-detail').textContent =
      destroyed.length > 0
        ? 'آخرین: ' + new Date(destroyed[destroyed.length - 1].destroyedAt).toLocaleTimeString()
        : 'Resource های teardown شده';

    const destroyedList = document.getElementById('destroyed-list');
    replaceChildren(
      destroyedList,
      destroyed
        .slice(-10)
        .reverse()
        .map((r) => {
          const item = el('div', 'resource-item');
          const header = el('div', 'signal-header');
          const left = el('span', null);
          left.appendChild(el('span', 'badge-destroyed', 'DESTROYED'));
          left.appendChild(el('span', 'resource-name', r.name));
          header.appendChild(left);
          header.appendChild(
            el('span', 'resource-time', new Date(r.destroyedAt).toLocaleTimeString()),
          );
          item.appendChild(header);
          item.appendChild(el('div', 'resource-url', r.url));
          return item;
        }),
    );

    // compileExpression Cache Stats
    const cache = response.cacheStats;
    if (cache) {
      document.getElementById('cache-hits').textContent = cache.hits;
      document.getElementById('cache-misses').textContent = cache.misses;
      const ratio = cache.total > 0 ? (cache.hitRatio * 100).toFixed(1) : 0;
      document.getElementById('cache-ratio').textContent = `Hit Ratio: ${ratio}%`;
      document.getElementById('cache-bar-fill').style.width = ratio + '%';
      document.getElementById('cache-size').textContent =
        `Unique expressions: ${cache.uniqueExpressions}`;
    }

    // SSR Stores
    const ssrStores = response.activeSSRStores || [];
    document.getElementById('ssr-count').textContent = ssrStores.length;
    document.getElementById('ssr-detail').textContent =
      ssrStores.length > 0 ? 'درخواست‌های SSR concurrent فعال' : 'درخواست‌های SSR concurrent';

    const ssrList = document.getElementById('ssr-list');
    replaceChildren(
      ssrList,
      ssrStores.map((store) => el('div', 'ssr-store-item', '🌐 Request: ' + store.id)),
    );
  }

  function formatVal(val) {
    if (val === null) return 'null';
    if (val === undefined) return 'undefined';
    if (typeof val === 'object') {
      try {
        return JSON.stringify(val).substring(0, 50);
      } catch {
        return '[Object]';
      }
    }
    return String(val).substring(0, 50);
  }
});
