// tools/vscode-extension/test/webview.test.ts
// #67 (SEC) — DevTools webview: CSP با nonce، اعتبارسنجی پیام‌ها، و رندر بدون
// innerHTML. این تست به `vscode` وابسته نیست (وب‌ویو ماژول خالص است).
import { describe, it, expect } from 'vitest';
import {
  DEVTOOLS_CLIENT_SCRIPT,
  WEBVIEW_LIMITS,
  WEBVIEW_MESSAGE_TYPES,
  buildDevToolsData,
  buildDevToolsHtml,
  buildStatusMessage,
  buildWebviewCsp,
  cleanText,
  createNonce,
  isDevToolsHostMessage,
  validateWebviewMessage,
} from '../src/webview';

const CONFIG = { nonce: 'nonce-abc123', cspSource: 'vscode-webview://1abc' };

describe('#67 webview — CSP سخت‌گیرانه با nonce', () => {
  it('locks everything down and allows scripts only through the nonce', () => {
    const csp = buildWebviewCsp(CONFIG);
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'nonce-nonce-abc123'");
    // object-src لازم نیست: `default-src 'none'` همهٔ fetch directiveها را می‌بندد.
    expect(csp).not.toContain("object-src 'self'");
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("form-action 'none'");
    expect(csp).toContain(`style-src ${CONFIG.cspSource} 'unsafe-inline'`);
    // هیچ‌جا script اجازهٔ inline/remote ندارد.
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-eval'/);
    expect(csp).not.toMatch(/script-src[^;]*https?:/);
  });

  it('embeds the CSP meta tag and a nonce-carrying script tag in the HTML', () => {
    const html = buildDevToolsHtml(CONFIG);
    expect(html).toContain('<meta http-equiv="Content-Security-Policy"');
    expect(html).toContain(buildWebviewCsp(CONFIG));
    expect(html).toContain(`<script nonce="${CONFIG.nonce}">`);
    // هیچ <script src> بیرونی و هیچ inline handler.
    expect(html).not.toMatch(/<script[^>]*\bsrc=/);
    expect(html).not.toMatch(/\son(click|load|error|input|change|submit|focus|blur|mouseover)=/i);
    // بدون eval/new Function در اسکریپت سمت webview.
    expect(DEVTOOLS_CLIENT_SCRIPT).not.toContain('eval(');
    expect(DEVTOOLS_CLIENT_SCRIPT).not.toContain('new Function(');
  });

  it('never writes data through innerHTML — the webview renders with textContent only', () => {
    const html = buildDevToolsHtml(CONFIG);
    expect(html).not.toContain('.innerHTML');
    expect(html).not.toContain('insertAdjacentHTML');
    expect(html).not.toContain('outerHTML');
    // رندر با APIهای DOM انجام می‌شود.
    expect(DEVTOOLS_CLIENT_SCRIPT).toContain('textContent');
    expect(DEVTOOLS_CLIENT_SCRIPT).toContain('replaceChildren');
  });

  it('issues a fresh CSPRNG nonce per call', () => {
    const a = createNonce();
    const b = createNonce();
    expect(a).not.toBe(b);
    // ۱۶ بایت base64 ⇒ 24 کاراکتر (با padding).
    expect(a).toHaveLength(24);
    expect(a).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  });
});

describe('#67 webview — اعتبارسنجی پیام‌های ورودی', () => {
  it('accepts exactly the allow-listed message types', () => {
    for (const type of WEBVIEW_MESSAGE_TYPES) {
      const res = validateWebviewMessage({ type });
      expect(res.ok, type).toBe(true);
      if (res.ok) expect(res.message.type).toBe(type);
    }
  });

  it('ignores malformed, unknown and prototype-polluted payloads', () => {
    const hostile: unknown[] = [
      undefined,
      null,
      'refresh',
      42,
      ['refresh'],
      {},
      { type: 7 },
      { type: 'refresh ' },
      { type: 'REFRESH' },
      { type: 'execute' },
      { type: 'refresh', __proto__: { polluted: true } },
    ];
    for (const payload of hostile) {
      const res = validateWebviewMessage(payload);
      expect(res.ok, JSON.stringify(payload)).toBe(false);
    }
    // شیء بدون پروتوتایپ (Object.create(null)) مجاز است: plain است و کلید ناامن ندارد.
    const nullProto = Object.create(null) as Record<string, unknown>;
    nullProto.type = 'connect';
    expect(validateWebviewMessage(nullProto)).toEqual({
      ok: true,
      message: { type: 'connect' },
    });
    const polluting = JSON.parse('{"type":"refresh","__proto__":{"x":1}}');
    Object.defineProperty(polluting, '__proto__', {
      value: { x: 1 },
      enumerable: true,
      configurable: true,
    });
    expect(validateWebviewMessage(polluting).ok).toBe(false);
  });

  it('rejects every payload that is not exactly { type: "refresh" | "connect" }', () => {
    expect(validateWebviewMessage({ type: 'connect', extra: 'x' }).ok).toBe(true); // فیلد اضافه بی‌اثر است
    expect(validateWebviewMessage({}).ok).toBe(false);
    expect(validateWebviewMessage({ type: 'connect', type2: 'refresh' }).ok).toBe(true);
  });
});

describe('#67 webview — ساخت payloadهای host با سقف سخت', () => {
  it('caps directive/signal counts, label lengths and drops unknown fields', () => {
    const payload = buildDevToolsData({
      fileName: '/tmp/x.html',
      directives: Array.from({ length: WEBVIEW_LIMITS.directives + 50 }, (_, i) => `zen-${i}`),
      signals: [
        { name: 'count', types: ['number'], secret: 'must-not-pass' },
        { name: '<img src=x onerror=alert(1)>', types: ['string', 42 as unknown as string] },
        { name: '', types: ['number'] },
        'not-an-object',
      ],
      lineCount: 12.7,
    })!;
    expect(payload.directiveCount).toBe(WEBVIEW_LIMITS.directives + 50); // شمارش واقعی
    expect(payload.directives).toHaveLength(WEBVIEW_LIMITS.directives); // نمایش سقف‌دار
    expect(payload.signals).toHaveLength(2);
    expect(payload.totalSignals).toBe(2);
    expect(payload.signals[0]).toEqual({ name: 'count', types: ['number'] });
    expect(JSON.stringify(payload)).not.toContain('must-not-pass');
    expect(payload.signals[1]!.name).toContain('<img');
    expect(payload.lineCount).toBe(12);
  });

  it('clamps long labels and drops control characters', () => {
    const long = 'x'.repeat(WEBVIEW_LIMITS.label + 100);
    expect(cleanText(long)).toHaveLength(WEBVIEW_LIMITS.label);
    expect(cleanText('a\u0000b\nc')).toBe('a b c');
    expect(cleanText({ nope: 1 })).toBe('');
    expect(cleanText(12)).toBe('12');
  });

  it('returns null when the file name is unusable and caps status messages', () => {
    expect(buildDevToolsData({ fileName: '' })).toBeNull();
    expect(buildDevToolsData({ fileName: 42 })).toBeNull();
    expect(buildDevToolsData({ fileName: null })).toBeNull();
    expect(buildDevToolsData({ fileName: '  ' })?.fileName).toBe('  ');
    const status = buildStatusMessage('y'.repeat(1000), true);
    expect(status.type).toBe('status');
    expect(status.isError).toBe(true);
    expect(status.message).toHaveLength(WEBVIEW_LIMITS.statusMessage);
  });

  it('type-guards host messages so the webview can re-validate them', () => {
    const good = buildDevToolsData({ fileName: 'a.html', directives: ['zen-if'] })!;
    expect(isDevToolsHostMessage(good)).toBe(true);
    expect(isDevToolsHostMessage(buildStatusMessage('ok'))).toBe(true);
    expect(isDevToolsHostMessage(null)).toBe(false);
    expect(isDevToolsHostMessage({ type: 'devtools-data' })).toBe(false);
    expect(
      isDevToolsHostMessage({
        type: 'devtools-data',
        fileName: 'a',
        directives: [],
        signals: [{}],
      }),
    ).toBe(false);
    expect(
      isDevToolsHostMessage({
        type: 'devtools-data',
        fileName: 'a',
        directives: ['zen-if', 5],
        signals: [],
      }),
    ).toBe(false);
    expect(isDevToolsHostMessage({ type: 'status', message: 5 })).toBe(false);
  });
});
