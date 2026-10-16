/**
 * message-schema.js — اعتبارسنجی پیام‌ها و داده‌های ورودی افزونهٔ Zenith DevTools (#67).
 *
 * چرا این فایل جداست؟ صفحه‌های افزونه (`popup.js`، `graph-viewer.js`) و
 * service-worker (`background.js`) و content script (`content.js`) داده را از
 * منابع **غیرقابل‌اعتماد** می‌گیرند:
 *   - `chrome.runtime.onMessage` (هر script داخل صفحهٔ بازدید‌شده می‌تواند پیام بفرستد)
 *   - `chrome.scripting.executeScript` ⇒ مقدار `window.__ZENITH__` صفحهٔ میزبان
 *   - `?data=<base64-JSON>` در `graph-viewer.html`
 *
 * قرارداد امنیتی این ماژول:
 *   1. «allowlist» به‌جای «denylist» — هر پیام/داده‌ای که دقیقاً با schema نخواند
 *      **نادیده** گرفته می‌شود (نه warn، نه throw، نه رندر).
 *   2. هرگز روی پروتوتایپ دست نمی‌بریم: فقط plain object با کلیدهای own پذیرفته
 *      می‌شود و کلیدهای `__proto__`/`constructor`/`prototype` رد می‌شوند.
 *   3. هر رشته‌ای که به DOM می‌رود سقف طول دارد و (در مسیر HTML) escape می‌شود.
 *
 * این ماژول یک اسکریپت کلاسیک است و خودش را روی `globalThis` می‌گذارد تا در
 * مرورگر با `<script src>`/`importScripts()` بار شود. تست‌ها همان مسیر را
 * شبیه‌سازی می‌کنند (`vm.runInContext` — بدون `require`، چون ریشهٔ مخزن
 * `"type": "module"` است و این فایل باید دقیقاً همان چیزی باشد که مرورگر می‌بیند).
 */
(function (root, factory) {
  if (!root || typeof root !== 'object') throw new Error('DevTools schema: no global object');
  root.ZenithDevtoolsSchema = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** سقف‌های سخت — هر مقدار بزرگ‌تر «نامعتبر» است، نه «بریده‌شده». */
  var LIMITS = {
    stringLength: 500,
    notificationText: 200,
    graphNodes: 2000,
    graphEdges: 5000,
    graphStringLength: 300,
    graphArrayLength: 200,
  };

  /** پیام‌هایی که افزونه می‌پذیرد (بقیه نادیده گرفته می‌شوند). */
  var RUNTIME_MESSAGE_TYPES = [
    'ZENITH_CHECK',
    'ZENITH_REFRESH',
    'ZENITH_CLEAR',
    'ZENITH_NOTIFICATION',
  ];

  /** کلیدهایی که هرگز از ورودی غیرقابل‌اعتماد پذیرفته نمی‌شوند (prototype pollution). */
  var UNSAFE_KEYS = ['__proto__', 'constructor', 'prototype'];

  function isPlainObject(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    var proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }

  function hasUnsafeKeys(value, depth) {
    if (depth > 4 || !isPlainObject(value)) return false;
    var keys = Object.keys(value);
    for (var i = 0; i < keys.length; i++) {
      if (UNSAFE_KEYS.indexOf(keys[i]) !== -1) return true;
      if (isPlainObject(value[keys[i]]) && hasUnsafeKeys(value[keys[i]], depth + 1)) return true;
    }
    return false;
  }

  /** کنترل‌کاراکتر/خط جدید در متن (بدون regex تا `no-control-regex` نیفتد). */
  function hasControlChars(text) {
    for (var i = 0; i < text.length; i++) {
      var code = text.charCodeAt(i);
      if (code < 32 || code === 127) return true;
    }
    return false;
  }

  /** `sender` فقط وقتی معتبر است که از خود همین افزونه باشد. */
  function isTrustedSender(sender, runtimeId) {
    if (!isPlainObject(sender)) return false;
    if (typeof runtimeId !== 'string' || runtimeId.length === 0) return false;
    return sender.id === runtimeId;
  }

  /**
   * اعتبارسنجی پیام ورودی از `chrome.runtime.onMessage`.
   * @returns {{ok: true, type: string, message: object} | {ok: false, reason: string}}
   */
  function validateRuntimeMessage(message, options) {
    var allowed = (options && options.allowedTypes) || RUNTIME_MESSAGE_TYPES;
    if (!isPlainObject(message)) return { ok: false, reason: 'not-a-plain-object' };
    if (hasUnsafeKeys(message, 0)) return { ok: false, reason: 'unsafe-keys' };
    if (typeof message.type !== 'string') return { ok: false, reason: 'missing-type' };
    if (allowed.indexOf(message.type) === -1) return { ok: false, reason: 'unknown-type' };
    return { ok: true, type: message.type, message: message };
  }

  /**
   * پیام `ZENITH_NOTIFICATION`: فقط `{type, text}` با متن رشته‌ای کوتاه.
   * @returns {{text: string} | null}
   */
  function validateNotification(message) {
    var res = validateRuntimeMessage(message, { allowedTypes: ['ZENITH_NOTIFICATION'] });
    if (!res.ok) return null;
    var text = message.text;
    if (typeof text !== 'string' || text.length === 0) return null;
    if (text.length > LIMITS.notificationText) return null;
    // no control characters / newlines — notification bodies are single-line
    if (hasControlChars(text)) return null;
    return { text: text };
  }

  /** رشتهٔ محدود و امن برای متن (بدون HTML). */
  function cleanText(value, maxLength) {
    var limit = typeof maxLength === 'number' ? maxLength : LIMITS.stringLength;
    if (typeof value === 'string')
      return value.length > limit ? value.slice(0, limit) + '…' : value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
  }

  /** HTML-escape خالص (بدون DOM) برای جاهایی که ساخت رشتهٔ HTML لازم است. */
  function escapeHtml(value) {
    return cleanText(value, LIMITS.graphStringLength * 4)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function clampCount(value, max) {
    var n = typeof value === 'number' && isFinite(value) ? Math.floor(value) : 0;
    if (n < 0) return 0;
    return n > max ? max : n;
  }

  function isArrayOfStrings(value) {
    return (
      Array.isArray(value) &&
      value.every(function (v) {
        return typeof v === 'string' && v.length <= LIMITS.graphStringLength;
      })
    );
  }

  /** یک node گراف: فقط فیلدهای شناخته‌شده، با نوع و طول درست. */
  function sanitizeGraphNode(node) {
    if (!isPlainObject(node)) return null;
    if (hasUnsafeKeys(node, 0)) return null;
    if (typeof node.id !== 'string' || node.id.length === 0) return null;
    if (node.id.length > LIMITS.graphStringLength) return null;
    if (node.type !== undefined && typeof node.type !== 'string') return null;

    var out = { id: node.id, type: typeof node.type === 'string' ? node.type : 'signal' };
    if (typeof node.label === 'string') out.label = cleanText(node.label, LIMITS.graphStringLength);
    if (node.value !== undefined) {
      var t = typeof node.value;
      if (t === 'string' || t === 'number' || t === 'boolean' || node.value === null) {
        out.value =
          typeof node.value === 'string'
            ? cleanText(node.value, LIMITS.graphStringLength)
            : node.value;
      } else {
        return null; // objects/functions از صفحهٔ میزبان پذیرفته نمی‌شوند
      }
    }
    if (node.deps !== undefined) {
      if (!isArrayOfStrings(node.deps) || node.deps.length > LIMITS.graphArrayLength) return null;
      out.deps = node.deps.slice(0, LIMITS.graphArrayLength);
    }
    if (typeof node.directiveType === 'string') {
      out.directiveType = cleanText(node.directiveType, LIMITS.graphStringLength);
    }
    if (typeof node.elementSelector === 'string') {
      out.elementSelector = cleanText(node.elementSelector, LIMITS.graphStringLength);
    }
    if (typeof node.expression === 'string') {
      out.expression = cleanText(node.expression, LIMITS.graphStringLength);
    }
    if (typeof node.domTag === 'string')
      out.domTag = cleanText(node.domTag, LIMITS.graphStringLength);
    return out;
  }

  function sanitizeGraphEdge(edge) {
    if (!isPlainObject(edge)) return null;
    if (hasUnsafeKeys(edge, 0)) return null;
    if (typeof edge.from !== 'string' || typeof edge.to !== 'string') return null;
    if (!edge.from || !edge.to) return null;
    if (edge.from.length > LIMITS.graphStringLength || edge.to.length > LIMITS.graphStringLength)
      return null;
    var out = { from: edge.from, to: edge.to };
    if (typeof edge.type === 'string') out.type = cleanText(edge.type, LIMITS.graphStringLength);
    return out;
  }

  /**
   * اعتبارسنجی کامل داده‌ی گراف پیش از رندر — یال‌های معلق حذف می‌شوند و
   * nodeهای ناسازگار کل payload را رد می‌کنند (نه رندر نیمه‌کاره).
   * @returns {{ok: true, value: object} | {ok: false, reason: string}}
   */
  function sanitizeGraphPayload(data) {
    if (!isPlainObject(data)) return { ok: false, reason: 'not-a-plain-object' };
    if (hasUnsafeKeys(data, 0)) return { ok: false, reason: 'unsafe-keys' };
    if (!Array.isArray(data.nodes)) return { ok: false, reason: 'missing-nodes' };
    if (data.nodes.length > LIMITS.graphNodes) return { ok: false, reason: 'too-many-nodes' };
    var edgesInput = data.edges === undefined ? [] : data.edges;
    if (!Array.isArray(edgesInput)) return { ok: false, reason: 'bad-edges' };
    if (edgesInput.length > LIMITS.graphEdges) return { ok: false, reason: 'too-many-edges' };

    var nodes = [];
    for (var i = 0; i < data.nodes.length; i++) {
      var node = sanitizeGraphNode(data.nodes[i]);
      if (!node) return { ok: false, reason: 'bad-node' };
      nodes.push(node);
    }
    var ids = {};
    for (var k = 0; k < nodes.length; k++) ids[nodes[k].id] = true;

    var edges = [];
    for (var j = 0; j < edgesInput.length; j++) {
      var edge = sanitizeGraphEdge(edgesInput[j]);
      if (!edge) return { ok: false, reason: 'bad-edge' };
      if (!ids[edge.from] || !ids[edge.to]) continue; // یال معلق = دور ریخته می‌شود
      edges.push(edge);
    }

    var counts = isPlainObject(data.counts)
      ? {
          signals: clampCount(data.counts.signals, LIMITS.graphNodes),
          effects: clampCount(data.counts.effects, LIMITS.graphNodes),
          directives: clampCount(data.counts.directives, LIMITS.graphNodes),
          dom: clampCount(data.counts.dom, LIMITS.graphNodes),
          edges: clampCount(data.counts.edges, LIMITS.graphEdges),
        }
      : undefined;

    var value = { nodes: nodes, edges: edges };
    if (counts) value.counts = counts;
    if (typeof data.generatedAt === 'number' && isFinite(data.generatedAt)) {
      value.generatedAt = data.generatedAt;
    }
    return { ok: true, value: value };
  }

  /**
   * پاسخ content script پیش از رندر در popup اعتبارسنجی می‌شود: هر لیست آرایه،
   * هر رکورد plain object، هر متن سقف‌دار. مقدار نامعتبر = بخش خالی (без throw).
   */
  function sanitizeInspectionResponse(response) {
    if (!isPlainObject(response)) return null;
    if (response.installed !== true) return { installed: false };
    var out = {
      installed: true,
      version: cleanText(response.version, 64) || 'unknown',
      signals: [],
      timeline: [],
      components: [],
      effects: [],
      staticFors: [],
      destroyedResources: [],
      activeSSRStores: [],
      cacheStats: null,
    };
    var i, item;
    if (Array.isArray(response.signals)) {
      for (i = 0; i < Math.min(response.signals.length, LIMITS.graphNodes); i++) {
        item = response.signals[i];
        if (!isPlainObject(item)) continue;
        out.signals.push({
          id: cleanText(item.id, LIMITS.graphStringLength),
          name: cleanText(item.name, LIMITS.graphStringLength),
          value: item.value === undefined ? '' : cleanText(item.value, LIMITS.graphStringLength),
          subscriberCount: clampCount(item.subscriberCount, 1000000),
        });
      }
    }
    if (Array.isArray(response.timeline)) {
      for (i = 0; i < Math.min(response.timeline.length, LIMITS.graphArrayLength); i++) {
        item = response.timeline[i];
        if (!isPlainObject(item)) continue;
        out.timeline.push({
          signalId: cleanText(item.signalId, 64),
          signalName: cleanText(item.signalName, LIMITS.graphStringLength),
          oldValue: cleanText(item.oldValue, LIMITS.graphStringLength),
          newValue: cleanText(item.newValue, LIMITS.graphStringLength),
          timestamp:
            typeof item.timestamp === 'number' && isFinite(item.timestamp) ? item.timestamp : 0,
        });
      }
    }
    if (Array.isArray(response.components)) {
      for (i = 0; i < Math.min(response.components.length, LIMITS.graphArrayLength); i++) {
        item = response.components[i];
        if (!isPlainObject(item)) continue;
        out.components.push({
          name: cleanText(item.name, LIMITS.graphStringLength),
          used: clampCount(item.used, 1000000),
          hasTemplate: item.hasTemplate === true,
        });
      }
    }
    if (Array.isArray(response.effects)) {
      for (i = 0; i < Math.min(response.effects.length, LIMITS.graphArrayLength); i++) {
        item = response.effects[i];
        if (!isPlainObject(item)) continue;
        out.effects.push({
          id: cleanText(item.id, 64),
          disposed: item.disposed === true,
          source: cleanText(item.source, LIMITS.graphStringLength),
          dependencies: isArrayOfStrings(item.dependencies)
            ? item.dependencies.slice(0, LIMITS.graphArrayLength).map(function (d) {
                return cleanText(d, LIMITS.graphStringLength);
              })
            : [],
          deps: isArrayOfStrings(item.deps) ? item.deps.slice(0, LIMITS.graphArrayLength) : [],
        });
      }
    }
    if (Array.isArray(response.staticFors)) {
      for (i = 0; i < Math.min(response.staticFors.length, LIMITS.graphArrayLength); i++) {
        item = response.staticFors[i];
        if (!isPlainObject(item)) continue;
        out.staticFors.push({
          expr: cleanText(item.expr, LIMITS.graphStringLength),
          itemCount: clampCount(item.itemCount, 1000000),
        });
      }
    }
    if (Array.isArray(response.destroyedResources)) {
      for (i = 0; i < Math.min(response.destroyedResources.length, LIMITS.graphArrayLength); i++) {
        item = response.destroyedResources[i];
        if (!isPlainObject(item)) continue;
        out.destroyedResources.push({
          name: cleanText(item.name, LIMITS.graphStringLength),
          url: cleanText(item.url, LIMITS.graphStringLength),
          destroyedAt:
            typeof item.destroyedAt === 'number' && isFinite(item.destroyedAt)
              ? item.destroyedAt
              : 0,
        });
      }
    }
    if (Array.isArray(response.activeSSRStores)) {
      for (i = 0; i < Math.min(response.activeSSRStores.length, LIMITS.graphArrayLength); i++) {
        item = response.activeSSRStores[i];
        out.activeSSRStores.push({ id: cleanText(item, LIMITS.graphStringLength) });
      }
    }
    if (isPlainObject(response.cacheStats)) {
      var hits = clampCount(response.cacheStats.hits, 1000000000);
      var misses = clampCount(response.cacheStats.misses, 1000000000);
      out.cacheStats = {
        hits: hits,
        misses: misses,
        total: clampCount(response.cacheStats.total, 2000000000) || hits + misses,
        hitRatio:
          typeof response.cacheStats.hitRatio === 'number' && isFinite(response.cacheStats.hitRatio)
            ? Math.min(1, Math.max(0, response.cacheStats.hitRatio))
            : hits + misses > 0
              ? hits / (hits + misses)
              : 0,
        uniqueExpressions: clampCount(response.cacheStats.uniqueExpressions, 1000000000),
        size: clampCount(response.cacheStats.size, 1000000000),
      };
    }
    out.signalCount =
      typeof response.signalCount === 'number' && isFinite(response.signalCount)
        ? clampCount(response.signalCount, 1000000)
        : out.signals.length;
    return out;
  }

  return {
    LIMITS: LIMITS,
    RUNTIME_MESSAGE_TYPES: RUNTIME_MESSAGE_TYPES,
    UNSAFE_KEYS: UNSAFE_KEYS,
    isPlainObject: isPlainObject,
    hasUnsafeKeys: hasUnsafeKeys,
    isTrustedSender: isTrustedSender,
    validateRuntimeMessage: validateRuntimeMessage,
    validateNotification: validateNotification,
    cleanText: cleanText,
    escapeHtml: escapeHtml,
    clampCount: clampCount,
    sanitizeGraphNode: sanitizeGraphNode,
    sanitizeGraphEdge: sanitizeGraphEdge,
    sanitizeGraphPayload: sanitizeGraphPayload,
    sanitizeInspectionResponse: sanitizeInspectionResponse,
  };
});
