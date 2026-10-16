// packages/vscode-extension/src/webview.ts
//
// #67 (SEC) — Zenith DevTools WebView: سخت‌گیرانه‌سازی امنیتی.
//
// این ماژول عمداً به `vscode` وابسته نیست (فقط `crypto` نود) تا بتوان آن را در
// تست‌های vitest بدون extension host اجرا کرد. مسئولیت‌ها:
//   1. CSP با **nonce** و بدون `'unsafe-inline'` برای script (هیچ inline handler).
//   2. اعتبارسنجی schema پیام‌های webview ⇒ host (allowlist: refresh/connect).
//   3. ساخت payloadهای host ⇒ webview با سقف سخت (طول/تعداد) و نوع‌های صریح.
//   4. رندر سمت webview فقط با DOM API (`textContent`) — هیچ `innerHTML` با
//      دادهٔ متغیر (نام signal/directive از فایل کاربر می‌آید).
import { randomBytes } from 'crypto';

/** پیام‌های مجازی که webview اجازه دارد به host بفرستد (allowlist). */
export const WEBVIEW_MESSAGE_TYPES = ['refresh', 'connect'] as const;

/** نوع پیام مجاز webview → host. */
export type WebviewMessageType = (typeof WEBVIEW_MESSAGE_TYPES)[number];

/** پیام معتبر webview → host. */
export interface WebviewMessage {
  /** فقط یکی از مقادیر `WEBVIEW_MESSAGE_TYPES`. */
  type: WebviewMessageType;
}

/** سقف‌های سختِ دادهٔ ورودی/خروجی webview (بیشتر از این = نادیده/کوتاه‌شده). */
export const WEBVIEW_LIMITS = Object.freeze({
  /** حداکثر طول نام فایل نمایش‌داده‌شده. */
  fileName: 512,
  /** حداکثر تعداد signalهای نمایش‌داده‌شده. */
  signals: 200,
  /** حداکثر تعداد directiveهای شمارش‌شده. */
  directives: 500,
  /** حداکثر طول هر برچسب/نام. */
  label: 200,
  /** حداکثر تعداد نوع‌های هر signal. */
  types: 8,
  /** حداکثر طول پیام وضعیت. */
  statusMessage: 300,
});

/** تنظیمات ساخت HTML webview. */
export interface DevToolsWebviewConfig {
  /** nonce یکتا برای `<script nonce>` و `script-src` (از `createNonce()`). */
  nonce: string;
  /** مقدار `webview.cspSource` (میزبان منابع محلی VS Code). */
  cspSource: string;
}

/** خلاصهٔ یک signal برای نمایش در webview. */
export interface DevToolsSignalSummary {
  /** نام signal (بدون `$`). */
  name: string;
  /** نوع‌های استنباط‌شده (هر کدام ≤ `WEBVIEW_LIMITS.label`). */
  types: string[];
}

/** payload جدول دادهٔ DevTools (host → webview). */
export interface DevToolsDataPayload {
  /** discriminator پیام. */
  type: 'devtools-data';
  /** مسیر فایل فعال. */
  fileName: string;
  /** نام directiveهای پیداشده (سقف `directives`). */
  directives: string[];
  /** تعداد کل directiveها. */
  directiveCount: number;
  /** تعداد directiveهای یکتا. */
  uniqueDirectives: number;
  /** signalهای companion file. */
  signals: DevToolsSignalSummary[];
  /** تعداد کل signalها. */
  totalSignals: number;
  /** تعداد خطوط فایل فعال. */
  lineCount: number;
}

/** payload پیام وضعیت (host → webview). */
export interface DevToolsStatusPayload {
  /** discriminator پیام. */
  type: 'status';
  /** متن وضعیت (سقف `statusMessage`). */
  message: string;
  /** آیا خطا است (کلاس `error`). */
  isError?: boolean;
}

/** هر پیام host → webview. */
export type DevToolsHostMessage = DevToolsDataPayload | DevToolsStatusPayload;

/** نتیجهٔ اعتبارسنجی پیام ورودی. */
export type WebviewValidation =
  { ok: true; message: WebviewMessage } | { ok: false; reason: string };

const UNSAFE_KEYS = ['__proto__', 'constructor', 'prototype'];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

function hasUnsafeKeys(value: Record<string, unknown>): boolean {
  return Object.keys(value).some((key) => UNSAFE_KEYS.includes(key));
}

/**
 * متن امن برای نمایش: فقط رشته/عدد/بولین، کوتاه‌شده به `max` کاراکتر.
 * کاراکترهای کنترلی حذف می‌شوند تا متن در UI نشکند.
 * @param value مقدار خام (هر نوعی)
 * @param max حداکثر طول مجاز خروجی
 */
export function cleanText(value: unknown, max: number = WEBVIEW_LIMITS.label): string {
  let text: string;
  if (typeof value === 'string') text = value;
  else if (typeof value === 'number' || typeof value === 'boolean') text = String(value);
  else return '';
  // eslint-disable-next-line no-control-regex -- حذف کاراکترهای کنترلی عمدی است
  text = text.replace(/[\u0000-\u001f\u007f]/g, ' ');
  return text.length > max ? text.slice(0, max) : text;
}

/**
 * nonce یکتا (۱۶ بایت تصادفی امن ⇒ 24 کاراکتر base64).
 * `Math.random` کاربرد امنیتی ندارد (DEC-014) — همیشه CSPRNG.
 */
export function createNonce(): string {
  return randomBytes(16).toString('base64');
}

/**
 * CSP سخت‌گیرانهٔ webview: هیچ منبعی به‌صورت پیش‌فرض مجاز نیست، اسکریپت فقط با
 * nonce، استایل فقط از cspSource (+ inline style چون HTML از پیش ساخته می‌شود).
 * @param config nonce و cspSource
 */
export function buildWebviewCsp(config: DevToolsWebviewConfig): string {
  return [
    "default-src 'none'",
    `style-src ${config.cspSource} 'unsafe-inline'`,
    `img-src ${config.cspSource} data:`,
    `font-src ${config.cspSource}`,
    `script-src 'nonce-${config.nonce}'`,
    "connect-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}

/**
 * اعتبارسنجی پیام webview → extension host.
 * هر چیزی که دقیقاً `{ type: 'refresh' | 'connect' }` نباشد **نادیده** می‌شود.
 * @param data مقدار خام `event.data` / `onDidReceiveMessage`
 */
export function validateWebviewMessage(data: unknown): WebviewValidation {
  if (!isPlainObject(data)) return { ok: false, reason: 'not-a-plain-object' };
  if (hasUnsafeKeys(data)) return { ok: false, reason: 'unsafe-keys' };
  const type = data.type;
  if (typeof type !== 'string') return { ok: false, reason: 'missing-type' };
  if (!(WEBVIEW_MESSAGE_TYPES as readonly string[]).includes(type)) {
    return { ok: false, reason: 'unknown-type' };
  }
  return { ok: true, message: { type: type as WebviewMessageType } };
}

/**
 * ساخت payload جدول دادهٔ DevTools با سقف‌های سخت.
 * @param input دادهٔ خام (نام فایل، directiveها، signalها)
 * @returns payload معتبر یا `null` وقتی نام فایل معتبر نباشد
 */
export function buildDevToolsData(input: {
  fileName: unknown;
  directives?: unknown;
  signals?: unknown;
  lineCount?: unknown;
}): DevToolsDataPayload | null {
  // نام فایل باید رشته باشد (عدد/شیء = payload نامعتبر، نه متن ساخته‌شده).
  if (typeof input.fileName !== 'string') return null;
  const fileName = cleanText(input.fileName, WEBVIEW_LIMITS.fileName);
  if (!fileName) return null;

  const rawDirectives = Array.isArray(input.directives) ? input.directives : [];
  const directives = rawDirectives
    .slice(0, WEBVIEW_LIMITS.directives)
    .map((d) => cleanText(d, WEBVIEW_LIMITS.label))
    .filter((d) => d.length > 0);

  const rawSignals = Array.isArray(input.signals) ? input.signals : [];
  const signals: DevToolsSignalSummary[] = [];
  for (const item of rawSignals.slice(0, WEBVIEW_LIMITS.signals)) {
    if (!isPlainObject(item)) continue;
    const name = cleanText(item.name, WEBVIEW_LIMITS.label);
    if (!name) continue;
    const types = (Array.isArray(item.types) ? item.types : [])
      .slice(0, WEBVIEW_LIMITS.types)
      .map((t) => cleanText(t, WEBVIEW_LIMITS.label))
      .filter((t) => t.length > 0);
    signals.push({ name, types });
  }

  const lineCount =
    typeof input.lineCount === 'number' && Number.isFinite(input.lineCount)
      ? Math.max(0, Math.floor(input.lineCount))
      : 0;

  return {
    type: 'devtools-data',
    fileName,
    directives,
    directiveCount: rawDirectives.length,
    uniqueDirectives: new Set(directives).size,
    signals,
    totalSignals: signals.length,
    lineCount,
  };
}

/**
 * ساخت پیام وضعیت (host → webview) با متن کوتاه‌شده.
 * @param message متن وضعیت
 * @param isError نمایش به‌عنوان خطا
 */
export function buildStatusMessage(message: unknown, isError = false): DevToolsStatusPayload {
  const text = cleanText(message, WEBVIEW_LIMITS.statusMessage) || '—';
  return isError
    ? { type: 'status', message: text, isError: true }
    : { type: 'status', message: text };
}

/**
 * type guard برای پیام‌های host که خود webview هم دوباره اعتبارسنجی می‌کند
 * (دفاع در عمق: حتی پیام دست‌ساز از devtools هم نباید رندر ناسالم بسازد).
 * @param data مقدار خام `event.data`
 */
export function isDevToolsHostMessage(data: unknown): data is DevToolsHostMessage {
  if (!isPlainObject(data)) return false;
  if (data.type === 'status') return typeof data.message === 'string';
  if (data.type !== 'devtools-data') return false;
  if (typeof data.fileName !== 'string') return false;
  if (!Array.isArray(data.directives) || !data.directives.every((d) => typeof d === 'string')) {
    return false;
  }
  if (!Array.isArray(data.signals)) return false;
  return data.signals.every(
    (s) =>
      isPlainObject(s) &&
      typeof s.name === 'string' &&
      Array.isArray(s.types) &&
      s.types.every((t) => typeof t === 'string'),
  );
}

/**
 * اسکریپت سمت webview (داخل `<script nonce>`).
 *
 * قواعد سخت: هیچ inline handler (`onclick=`) وجود ندارد، هیچ رشتهٔ HTML ساخته
 * نمی‌شود (`innerHTML` صفر بار)، و هر پیام ورودی قبل از مصرف schema-check می‌شود.
 */
export const DEVTOOLS_CLIENT_SCRIPT = `
(function () {
  'use strict';

  var vscodeApi = acquireVsCodeApi();
  var MAX_LABEL = ${WEBVIEW_LIMITS.label};
  var MAX_SIGNALS = ${WEBVIEW_LIMITS.signals};

  function cleanText(value, max) {
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return '';
    var text = String(value).replace(/[\\u0000-\\u001f\\u007f]/g, ' ');
    var limit = max || MAX_LABEL;
    return text.length > limit ? text.slice(0, limit) : text;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = cleanText(text);
    return node;
  }

  function replaceChildren(container, nodes) {
    container.replaceChildren();
    for (var i = 0; i < nodes.length; i++) container.appendChild(nodes[i]);
  }

  function setStatus(msg, isError) {
    var el0 = document.getElementById('status');
    el0.textContent = cleanText(msg, ${WEBVIEW_LIMITS.statusMessage});
    el0.className = 'status-msg' + (isError ? ' error' : '');
  }

  function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  function isHostMessage(msg) {
    if (!isRecord(msg) || typeof msg.type !== 'string') return false;
    if (msg.type === 'status') return typeof msg.message === 'string';
    if (msg.type !== 'devtools-data') return false;
    if (typeof msg.fileName !== 'string') return false;
    if (!Array.isArray(msg.directives)) return false;
    if (!Array.isArray(msg.signals)) return false;
    for (var i = 0; i < msg.signals.length; i++) {
      var s = msg.signals[i];
      if (!isRecord(s) || typeof s.name !== 'string' || !Array.isArray(s.types)) return false;
    }
    return true;
  }

  function renderDevToolsData(msg) {
    document.getElementById('fileInfo').style.display = 'block';
    document.getElementById('filePath').textContent = cleanText(msg.fileName, 512);
    document.getElementById('dirCount').textContent = String(Number(msg.directiveCount) || 0);
    document.getElementById('uniqueDirs').textContent = String(Number(msg.uniqueDirectives) || 0);
    document.getElementById('signalCount').textContent = String(Number(msg.totalSignals) || 0);
    document.getElementById('lineCount').textContent = String(Number(msg.lineCount) || 0);

    var signalList = document.getElementById('signalList');
    var signalsCard = document.getElementById('signalsCard');
    var signals = msg.signals.slice(0, MAX_SIGNALS);
    if (signals.length > 0) {
      signalsCard.style.display = 'block';
      document.getElementById('signalBadge').textContent = String(signals.length);
      replaceChildren(
        signalList,
        signals.map(function (s) {
          var li = document.createElement('li');
          li.appendChild(el('span', 'signal-name', '$' + cleanText(s.name)));
          li.appendChild(document.createTextNode(' : '));
          var types = s.types.filter(function (t) { return typeof t === 'string'; }).slice(0, 8);
          li.appendChild(el('span', null, types.length ? types.join(', ') : 'unknown'));
          return li;
        }),
      );
    } else {
      signalsCard.style.display = 'none';
      replaceChildren(signalList, []);
    }

    var directiveList = document.getElementById('directiveList');
    var directivesCard = document.getElementById('directivesCard');
    if (msg.directives.length > 0) {
      directivesCard.style.display = 'block';
      document.getElementById('dirBadge').textContent = String(msg.directives.length);
      var counts = Object.create(null);
      msg.directives.slice(0, ${WEBVIEW_LIMITS.directives}).forEach(function (d) {
        var key = cleanText(d);
        if (!key) return;
        counts[key] = (counts[key] || 0) + 1;
      });
      var names = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
      replaceChildren(
        directiveList,
        names.map(function (name) {
          return el('span', 'directive-tag', name + ' (' + counts[name] + ')');
        }),
      );
    } else {
      directivesCard.style.display = 'none';
      replaceChildren(directiveList, []);
    }

    setStatus(
      '✅ ' +
        (Number(msg.directiveCount) || 0) +
        ' directive, ' +
        (Number(msg.totalSignals) || 0) +
        ' signal in ' +
        cleanText(msg.fileName, 512),
      false,
    );
    resetConnectButton();
  }

  function resetConnectButton() {
    var btn = document.getElementById('connectBtn');
    btn.disabled = false;
    btn.textContent = '🔌 Connect CDP';
  }

  window.addEventListener('message', function (event) {
    var msg = event.data;
    // #67: پیام نامعتبر (شکل ناسازگار/schema ناخوانا) کاملاً نادیده گرفته می‌شود.
    if (!isHostMessage(msg)) return;

    if (msg.type === 'status') {
      setStatus(msg.message, msg.isError === true);
      if (msg.isError === true) resetConnectButton();
      return;
    }

    if (msg.type === 'devtools-data') renderDevToolsData(msg);
  });

  document.getElementById('refreshBtn').addEventListener('click', function () {
    setStatus('در حال دریافت اطلاعات...', false);
    vscodeApi.postMessage({ type: 'refresh' });
  });

  document.getElementById('connectBtn').addEventListener('click', function () {
    var btn = document.getElementById('connectBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Connecting...';
    vscodeApi.postMessage({ type: 'connect' });
  });
})();
`;

const DEVTOOLS_STYLE = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; padding: 16px; background: var(--vscode-editor-background, #1e1e1e); color: var(--vscode-editor-foreground, #d4d4d4); }
    h2 { color: var(--vscode-textLink-foreground, #3794ff); margin-bottom: 12px; font-size: 18px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; background: var(--vscode-badge-background, #3c3c3c); color: var(--vscode-badge-foreground, #fff); }
    .card { background: var(--vscode-editorWidget-background, #252526); border: 1px solid var(--vscode-widget-border, #3c3c3c); border-radius: 8px; padding: 14px; margin-bottom: 12px; }
    .card-title { font-weight: 600; font-size: 13px; margin-bottom: 8px; color: var(--vscode-textLink-foreground, #3794ff); }
    .stat-row { display: flex; gap: 12px; flex-wrap: wrap; margin: 8px 0; }
    .stat { background: var(--vscode-input-background, #3c3c3c); border-radius: 6px; padding: 8px 14px; text-align: center; flex: 1; min-width: 80px; }
    .stat-value { font-size: 22px; font-weight: 700; display: block; }
    .stat-label { font-size: 11px; opacity: 0.7; display: block; margin-top: 2px; }
    .status-msg { padding: 8px 12px; border-radius: 6px; margin: 8px 0; font-size: 12px; background: var(--vscode-inputValidation-infoBackground, #063b4a); border: 1px solid var(--vscode-inputValidation-infoBorder, #3794ff); }
    .status-msg.error { background: var(--vscode-inputValidation-errorBackground, #5a1d1d); border-color: var(--vscode-inputValidation-errorBorder, #e51400); }
    button { background: var(--vscode-button-background, #0e639c); color: var(--vscode-button-foreground, #fff); border: none; border-radius: 4px; padding: 8px 16px; cursor: pointer; font-size: 13px; margin: 4px 4px 4px 0; }
    button:hover { background: var(--vscode-button-hoverBackground, #1177bb); }
    button.secondary { background: var(--vscode-button-secondaryBackground, #3a3d41); }
    button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground, #45494e); }
    ul { list-style: none; padding: 0; }
    li { padding: 4px 8px; font-size: 12px; font-family: 'Cascadia Code', 'Fira Code', monospace; border-bottom: 1px solid var(--vscode-widget-border, #3c3c3c); }
    li:last-child { border-bottom: none; }
    .signal-name { color: var(--vscode-symbolIcon-variableForeground, #9cdcfe); }
    .directive-tag { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 11px; background: var(--vscode-editor-selectionBackground, #264f78); margin: 1px; }
    .file-path { font-size: 11px; opacity: 0.6; margin-bottom: 8px; word-break: break-all; }
    .actions { margin: 8px 0; }
`;

/**
 * HTML کامل webview با CSP سخت‌گیرانه و nonce.
 * @param config nonce و cspSource
 */
export function buildDevToolsHtml(config: DevToolsWebviewConfig): string {
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${buildWebviewCsp(config)}">
  <style>${DEVTOOLS_STYLE}  </style>
</head>
<body>
  <h2>🔧 Zenith DevTools</h2>
  <p style="font-size:12px;opacity:0.7;margin-bottom:12px;">VSCode Extension — Signal &amp; Directive Inspector</p>

  <div id="fileInfo" class="card" style="display:none;">
    <div class="card-title">📄 File</div>
    <div class="file-path" id="filePath"></div>
    <div class="stat-row">
      <div class="stat"><span class="stat-value" id="dirCount">0</span><span class="stat-label">Directives</span></div>
      <div class="stat"><span class="stat-value" id="uniqueDirs">0</span><span class="stat-label">Unique</span></div>
      <div class="stat"><span class="stat-value" id="signalCount">0</span><span class="stat-label">Signals</span></div>
      <div class="stat"><span class="stat-value" id="lineCount">0</span><span class="stat-label">Lines</span></div>
    </div>
  </div>

  <div class="actions">
    <button id="refreshBtn">🔄 Refresh</button>
    <button class="secondary" id="connectBtn">🔌 Connect CDP</button>
  </div>

  <div id="status" class="status-msg">برای شروع، روی Refresh کلیک کنید.</div>

  <div id="signalsCard" class="card" style="display:none;">
    <div class="card-title">📡 Signals <span class="badge" id="signalBadge">0</span></div>
    <ul id="signalList"></ul>
  </div>

  <div id="directivesCard" class="card" style="display:none;">
    <div class="card-title">🏷️ Directives <span class="badge" id="dirBadge">0</span></div>
    <div id="directiveList"></div>
  </div>

  <script nonce="${config.nonce}">${DEVTOOLS_CLIENT_SCRIPT}</script>
</body>
</html>`;
}
