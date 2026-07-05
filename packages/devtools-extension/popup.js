// popup.js — Zenith DevTools popup with 5 panels:
//   1. Signal Inspector — list all signals with values and subscriber counts
//   2. Timeline — state change history
//   3. Component Tree — hierarchical view of registered components
//   4. Effect Viewer — active/disposed effects with dependencies
//   5. Graph Viewer  — opens the live dependency-graph viewer in a new tab

document.addEventListener('DOMContentLoaded', () => {
  const statusBar = document.getElementById('status-bar');
  const clearBtn = document.getElementById('clear');

  // ─── Tab switching ──────────────────────────────────────────
  let activeTab = 'signals';
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
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
    } catch (e) { return 2000; }
  }
  function setRefreshInterval(ms) {
    try { localStorage.setItem(STORAGE_KEY, String(ms)); } catch (e) { /* ignore */ }
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
    if (autoRefreshTimer) { clearInterval(autoRefreshTimer); autoRefreshTimer = null; }
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
          document.querySelectorAll('.empty').forEach(function (e) { e.textContent = '—'; });
          return;
        }

        if (!response || !response.installed) {
          statusBar.textContent = '❌ Zenith در این صفحه فعال نیست';
          statusBar.className = 'status-bar disconnected';
          document.querySelectorAll('.empty').forEach(function (e) { e.textContent = '—'; });
          return;
        }

        statusBar.textContent = '✅ Zenith v' + response.version + ' — ' + (response.signalCount || 0) + ' signals';
        statusBar.className = 'status-bar connected';
        document.getElementById('version').textContent = 'v' + response.version;
        renderSignals(response.signals || []);
        renderTimeline(response.timeline || []);
        renderComponents(response.components || []);
        renderEffects(response.effects || []);
        // FEATURE (v1.0.0): lazy render — فقط در صورت فعال بودن تب v1 رندر کن
        // در غیر این صورت داده رو ذخیره کن تا وقتی تب فعال شد رندر بشه
        window._v1Data = response;
        if (activeTab === 'v1') {
          renderV1Features(response);
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
            try { return hook.getDependencyGraph(); }
            catch (e) { return { error: String(e) }; }
          },
        },
        (results) => {
          if (chrome.runtime.lastError || !results || !results[0]) {
            if (statusEl) statusEl.textContent = '❌ تزریق اسکریپت ناموفق بود';
            return;
          }
          const data = results[0].result;
          if (!data) {
            if (statusEl) statusEl.textContent = '❌ Zenith در این صفحه فعال نیست';
            return;
          }
          let json;
          try { json = JSON.stringify(data); }
          catch (e) { json = '{}'; }
          // UTF-8 safe base64 encode (handles non-ASCII signal names / values).
          const b64 = btoa(unescape(encodeURIComponent(json)));
          const url = chrome.runtime.getURL('graph-viewer.html') + '?data=' + b64;
          chrome.tabs.create({ url });
          if (statusEl) statusEl.textContent = '✅ گراف در تب جدید باز شد';
        }
      );
    });
  }

  function renderSignals(signals) {
    const list = document.getElementById('signals-list');
    const empty = document.getElementById('signals-empty');

    if (!signals || signals.length === 0) {
      empty.style.display = 'block';
      list.innerHTML = '';
      return;
    }
    empty.style.display = 'none';

    list.innerHTML = signals.map(s => {
      let valStr;
      try {
        valStr = typeof s.value === 'object'
          ? JSON.stringify(s.value, null, 2)
          : String(s.value);
      } catch { valStr = String(s.value); }
      if (valStr.length > 200) valStr = valStr.substring(0, 200) + '...';

      return `
        <div class="signal-item">
          <div class="signal-header">
            <span>
              <span class="signal-id">#${s.id}</span>
              ${s.name ? `<span class="signal-name">${s.name}</span>` : ''}
            </span>
            <span class="signal-count">${s.subscriberCount} subs</span>
          </div>
          <div class="signal-value">${escapeHtml(valStr)}</div>
        </div>
      `;
    }).join('');
  }

  function renderTimeline(timeline) {
    const list = document.getElementById('timeline-list');
    const empty = document.getElementById('timeline-empty');

    if (!timeline || timeline.length === 0) {
      empty.style.display = 'block';
      list.innerHTML = '';
      return;
    }
    empty.style.display = 'none';

    const recent = timeline.slice(-20).reverse();
    list.innerHTML = recent.map(c => {
      const time = new Date(c.timestamp).toLocaleTimeString();
      const oldStr = formatVal(c.oldValue);
      const newStr = formatVal(c.newValue);
      return `
        <div class="timeline-item">
          <div class="timeline-time">${time} — Signal #${c.signalId}${c.signalName ? ` (${c.signalName})` : ''}</div>
          <div class="timeline-change">
            <span class="timeline-old">${oldStr}</span> →
            <span class="timeline-new">${newStr}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderComponents(components) {
    const tree = document.getElementById('components-tree');
    const empty = document.getElementById('components-empty');

    if (!components || components.length === 0) {
      empty.style.display = 'block';
      tree.innerHTML = '';
      return;
    }
    empty.style.display = 'none';

    tree.innerHTML = components.map(c => {
      return `
        <div class="tree-node">
          <span class="tree-tag">&lt;${c.name}&gt;</span>
          ${c.used ? `<span class="tree-attr">used ${c.used}x</span>` : ''}
        </div>
      `;
    }).join('');
  }

  function renderEffects(effects) {
    const list = document.getElementById('effects-list');
    const empty = document.getElementById('effects-empty');

    if (!effects || effects.length === 0) {
      empty.style.display = 'block';
      list.innerHTML = '';
      return;
    }
    empty.style.display = 'none';

    list.innerHTML = effects.map(e => {
      return `
        <div class="effect-item">
          <div class="signal-header">
            <span>
              <span class="effect-id">Effect #${e.id}</span>
              ${e.source ? `<span class="effect-deps">${e.source}</span>` : ''}
            </span>
            <span class="effect-status ${e.disposed ? 'disposed' : 'active'}">
              ${e.disposed ? 'Disposed' : 'Active'}
            </span>
          </div>
          ${e.dependencies ? `<div class="effect-deps">Deps: ${e.dependencies.join(', ')}</div>` : ''}
        </div>
      `;
    }).join('');
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
    staticList.innerHTML = staticFors.map(f => `
      <div class="signal-item" style="border-color: #166534;">
        <div class="signal-header">
          <span>
            <span class="badge-static">STATIC</span>
            <span class="signal-name">${escapeHtml(f.expr)}</span>
          </span>
          <span class="signal-count">${f.itemCount} items</span>
        </div>
      </div>
    `).join('');

    // Resource Destroyed
    const destroyed = response.destroyedResources || [];
    document.getElementById('destroyed-count').textContent = destroyed.length;
    document.getElementById('destroyed-detail').textContent =
      destroyed.length > 0
        ? 'آخرین: ' + new Date(destroyed[destroyed.length - 1].destroyedAt).toLocaleTimeString()
        : 'Resource های teardown شده';

    const destroyedList = document.getElementById('destroyed-list');
    destroyedList.innerHTML = destroyed.slice(-10).reverse().map(r => {
      const time = new Date(r.destroyedAt).toLocaleTimeString();
      return `
        <div class="resource-item">
          <div class="signal-header">
            <span>
              <span class="badge-destroyed">DESTROYED</span>
              <span class="resource-name">${escapeHtml(r.name)}</span>
            </span>
            <span class="resource-time">${time}</span>
          </div>
          <div class="resource-url">${escapeHtml(r.url)}</div>
        </div>
      `;
    }).join('');

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
      ssrStores.length > 0
        ? 'درخواست‌های SSR concurrent فعال'
        : 'درخواست‌های SSR concurrent';

    const ssrList = document.getElementById('ssr-list');
    ssrList.innerHTML = ssrStores.map(id => `
      <div class="ssr-store-item">🌐 Request: ${escapeHtml(id)}</div>
    `).join('');
  }

  function formatVal(val) {
    if (val === null) return 'null';
    if (val === undefined) return 'undefined';
    if (typeof val === 'object') {
      try { return JSON.stringify(val).substring(0, 50); } catch { return '[Object]'; }
    }
    return String(val).substring(0, 50);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
});
