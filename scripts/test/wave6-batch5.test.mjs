// @vitest-environment jsdom
// scripts/test/wave6-batch5.test.mjs
// Wave 6 P2 Batch 5: سه هدف —
//   #11  compiler: مسیر پاک‌سازی listenerهای تولیدشده (root.__zenDispose)
//   #94  telemetry اختیاری: gateهای env/config، sanitize PII، بدون endpoint پیش‌فرض
//   #102 پیام‌های خطای i18n: parity کاتالوگ EN با RESERVED_ERROR_CODES + drift مستندات
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { compileTemplate } from '../../packages/compiler/src/index.ts';
import {
  RESERVED_ERROR_CODES,
  ERROR_MESSAGES_EN,
  LEGACY_ERROR_MESSAGES_EN,
  createReservedError,
  getErrorMessage,
  setErrorLocale,
  ZenithError,
} from '../../packages/errors/src/index.ts';

// ─────────────────────────────────────────────────────────────
// #11 — compiler cleanup path (root.__zenDispose)
// ─────────────────────────────────────────────────────────────
describe('#11: compiler dispose path for generated listeners', () => {
  it('کد تولیدی: آرایهٔ __disposers اول بدنه، handler نام‌دار، disposer ثبت‌شده', async () => {
    const res = await compileTemplate('<input zen-model="$search" type="text">');
    const code = res.code;

    expect(code).toContain('const __disposers = [];');
    // __disposers پیش از نخستین addEventListener تعریف شده است.
    expect(code.indexOf('const __disposers = [];')).toBeLessThan(code.indexOf('addEventListener'));

    // handler نام‌دار (نه anon) تا removeEventListener واقعی انجام شود.
    const named = code.match(/const __(el\d+)InputHandler = \(e\) => \{/);
    expect(named, 'handler باید با نام __elNInputHandler تعریف شود').toBeTruthy();
    const el = named[1];
    expect(code).toContain(`${el}.addEventListener('input', __${el}InputHandler);`);
    expect(code).toContain(
      `__disposers.push(() => ${el}.removeEventListener('input', __${el}InputHandler));`,
    );

    // dispose غیرقابل‌شمارش و idempotent (splice(0) خالی‌کردن آرایه).
    expect(code).toContain('Object.defineProperty(root, "__zenDispose", { configurable: true, value: function () {');
    expect(code).toContain('__disposers.splice(0)');
    // سازگاری: render همچنان root را برمی‌گرداند.
    expect(code.trimEnd().endsWith('return root;\n}')).toBe(true);
  });

  it('قالب ایستای بدون listener نیز __zenDispose دارد (رفتار یکنواخت)', async () => {
    const res = await compileTemplate('<div>hello</div>');
    expect(res.isStatic).toBe(true);
    expect(res.code).not.toContain('addEventListener');
    expect(res.code).toContain('__zenDispose');
  });

  it('رفتاری: dispose اتصال listener را واقعاً می‌شکند، دوبار صدا زدن بی‌اثر است، render root را برمی‌گرداند', async () => {
    const res = await compileTemplate('<input zen-model="$search" type="text">');
    // اجرای خروجی compile با حداقل محدودهٔ runtime.
    /* global document */
    const render = new Function(`${res.code}\nreturn render;`)();
    const root = document.createElement('div');
    const setSpy = vi.fn();
    const state = { search: { set: setSpy, get: () => '' } };
    const noop = () => {};
    const identity = (x) => x;
    const out = render(
      root,
      { $search: '' }, // ctx
      (fn) => fn(), // effect — اجرای فوری
      noop, // signal (بدون مصرف در این قالب)
      identity, // sanitizeHTML
      state,
      noop, // processChildren
      identity, // sanitizeHTMLTrusted
      noop, // evalExpr
    );

    expect(out).toBe(root);
    // __zenDispose غیرقابل‌شمارش است.
    expect(Object.keys(root)).not.toContain('__zenDispose');
    expect(typeof root.__zenDispose).toBe('function');

    const input = root.querySelector('input');
    expect(input).toBeTruthy();
    input.value = 'abc';
    input.dispatchEvent(new Event('input'));
    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalledWith('abc');

    root.__zenDispose();
    input.value = 'xyz';
    input.dispatchEvent(new Event('input'));
    expect(setSpy).toHaveBeenCalledTimes(1); // listener برداشته شد

    // idempotent: فراخوان دوم هیچ اثری ندارد و throw نمی‌کند.
    expect(() => root.__zenDispose()).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────
// #94 — telemetry opt-in gates
// ─────────────────────────────────────────────────────────────
const TELEMETRY_ENV_KEYS = [
  'ZENITH_TELEMETRY',
  'ZENITH_TELEMETRY_ENDPOINT',
  'ZENITH_CONFIG_HOME',
  'CI',
];

describe('#94: telemetry gates (default-off + env/config precedence + PII)', () => {
  /** ذخیره/بازیابی env و config-home موقت برای هر تست (await شده). */
  async function withIsolatedEnv(fn) {
    const saved = Object.fromEntries(TELEMETRY_ENV_KEYS.map((k) => [k, process.env[k]]));
    for (const k of TELEMETRY_ENV_KEYS) delete process.env[k];
    const home = mkdtempSync(join(tmpdir(), 'zen-telemetry-test-'));
    process.env.ZENITH_CONFIG_HOME = home;
    try {
      await fn(home);
    } finally {
      for (const k of TELEMETRY_ENV_KEYS) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
      rmSync(home, { recursive: true, force: true });
    }
  }

  it('پیش‌فرض همیشه خاموش است (default-off) حتی بدون هیچ کانفیگی', async () => {
    await withIsolatedEnv(async () => {
      const t = await import('../../packages/cli/src/telemetry.ts');
      const s = t.telemetryStatus();
      expect(s.enabled).toBe(false);
      expect(s.source).toBe('default-off');
      expect(s.endpoint).toBeUndefined();
    });
  });

  it('کانفیگ on فقط وقتی اثر دارد که env غایب باشد؛ kill-switch (0) بر همه غالب است', () => {
    return withIsolatedEnv(async (home) => {
      const t = await import('../../packages/cli/src/telemetry.ts');
      t.setTelemetryEnabled(true);
      expect(readFileSync(join(home, 'telemetry.json'), 'utf8')).toContain('"enabled": true');
      expect(t.telemetryStatus()).toMatchObject({ enabled: true, source: 'config' });

      process.env.ZENITH_TELEMETRY = '0';
      expect(t.telemetryStatus()).toMatchObject({ enabled: false, source: 'env' });

      process.env.ZENITH_TELEMETRY = '1';
      expect(t.telemetryStatus()).toMatchObject({ enabled: true, source: 'env' });
    });
  });

  it('endpoint فقط با URL امن https از env پذیرفته می‌شود؛ بدون آن هیچ ارسالی انجام نمی‌شود', () => {
    return withIsolatedEnv(async () => {
      const t = await import('../../packages/cli/src/telemetry.ts');
      process.env.ZENITH_TELEMETRY = '1';
      process.env.ZENITH_TELEMETRY_ENDPOINT = 'http://insecure.example/collect';
      expect(t.telemetryStatus().endpoint).toBeUndefined();
      process.env.ZENITH_TELEMETRY_ENDPOINT = 'https://metrics.example/collect';
      expect(t.telemetryStatus().endpoint).toBe('https://metrics.example/collect');
    });
  });

  it('sanitizeTelemetryProps کلیدهای حساس و مقدارهای مسیر/شیء را حذف می‌کند، دادهٔ ساده را نگه می‌دارد', async () => {
    const t = await import('../../packages/cli/src/telemetry.ts');
    const clean = t.sanitizeTelemetryProps({
      projectPath: '/home/ali/app',
      userEmail: 'a@b.c',
      apiToken: 'secret',
      cwd: '/tmp/x',
      repoUrl: 'https://github.com/x/y',
      homeDir: 'C:\\Users\\ali',
      nested: { a: 1 },
      nothing: null,
      mode: 'fast',
      count: 3,
      ok: true,
      version: '1.4.0',
      plainWord: 'build',
    });
    expect(clean).toEqual({
      mode: 'fast',
      count: 3,
      ok: true,
      version: '1.4.0',
      plainWord: 'build',
    });
  });

  it('telemetryEvent: غیرفعال یا بدون endpoint ⇒ بدون fetch؛ فعال⇒ payload مینیمالِ مستندشده', () => {
    return withIsolatedEnv(async () => {
      const t = await import('../../packages/cli/src/telemetry.ts');
      const calls = [];
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url, init) => {
        calls.push({ url, init });
        return new Response('ok', { status: 200 });
      };
      try {
        // ۱) غیرفعال — هیچ fetchای نباید رخ دهد.
        t.telemetryEvent('build.start', { path: '/x' });
        expect(calls).toHaveLength(0);

        // ۲) فعال بدون endpoint — باز هم خیر.
        process.env.ZENITH_TELEMETRY = '1';
        t.telemetryEvent('build.start');
        expect(calls).toHaveLength(0);

        // ۳) فعال + endpoint امن — دقیقاً یک ارسال مینیمال.
        process.env.ZENITH_TELEMETRY_ENDPOINT = 'https://metrics.example/collect';
        process.env.CI = 'true';
        t.telemetryEvent('build.finish', { projectPath: '/x', mode: 'prod' });
        expect(calls).toHaveLength(1);
        const [call] = calls;
        expect(call.url).toBe('https://metrics.example/collect');
        expect(call.init.method).toBe('POST');
        const body = JSON.parse(call.init.body);
        expect(body.event).toBe('build.finish');
        expect(body.mode).toBe('prod');
        expect(body.projectPath).toBeUndefined(); // PII فیلتر شد
        expect(Number.isInteger(body.nodeMajor)).toBe(true);
        expect(typeof body.zenithVersion).toBe('string');
        expect(body.platform).toBe(process.platform);
        expect(body.ci).toBe(true);
        // فقط کلیدهای مستندشده + props سالم — نه نام/توکن/مسیر.
        const bodyKeys = Object.keys(body).sort();
        expect(bodyKeys).toEqual(['ci', 'event', 'mode', 'nodeMajor', 'platform', 'zenithVersion']);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  it('runTelemetry کنترل خطا دارد: action ناشناخته ⇒ 1، on/off/status ⇒ 0', () => {
    return withIsolatedEnv(async () => {
      const t = await import('../../packages/cli/src/telemetry.ts');
      expect(t.runTelemetry('unknown')).toBe(1);
      expect(t.runTelemetry('on')).toBe(0);
      expect(t.telemetryStatus()).toMatchObject({ enabled: true, source: 'config' });
      expect(t.runTelemetry('off')).toBe(0);
      expect(t.telemetryStatus()).toMatchObject({ enabled: false });
      expect(t.runTelemetry('status')).toBe(0);
    });
  });

  it('CLI: دستور ثبت‌شده و PRIVACY.md سیاست opt-in را مستند می‌کند', () => {
    const cliIndex = readFileSync('packages/cli/src/index.ts', 'utf8');
    expect(cliIndex).toContain(".command('telemetry [action]')");
    expect(cliIndex).toContain("import('./telemetry')");
    const privacy = readFileSync('docs/PRIVACY.md', 'utf8');
    expect(privacy).toContain('opt-in');
    expect(privacy).toContain('ZENITH_TELEMETRY_ENDPOINT');
    expect(privacy).toContain('ZENITH_TELEMETRY');
  });
});

// ─────────────────────────────────────────────────────────────
// #102 — error message i18n parity + docs drift
// ─────────────────────────────────────────────────────────────
describe('#102: error i18n — EN catalog parity with RESERVED_ERROR_CODES', () => {
  const FOUR_DIGIT = /^ZEN-\d{4}$/;
  const THREE_DIGIT = /^ZEN-\d{3}$/;

  it('کاتالوگ ۴رقمی: کلیدهای RESERVED_ERROR_CODES و ERROR_MESSAGES_EN دقیقاً 1:1 هستند، همهٔ message+suggestion پرند', () => {
    const resKeys = Object.keys(RESERVED_ERROR_CODES).sort();
    const enKeys = Object.keys(ERROR_MESSAGES_EN).sort();
    // نگهبان تعداد ثابت (رشد فقط با اختصاص دارایی range جدید در تست ranges).
    expect(resKeys).toHaveLength(81);
    expect(enKeys).toHaveLength(81);
    expect(enKeys).toEqual(resKeys);
    for (const code of resKeys) {
      expect(FOUR_DIGIT.test(code), `${code} باید چهاررقمی باشد`).toBe(true);
      const en = ERROR_MESSAGES_EN[code];
      expect(en.message.length, `${code} message خالی`).toBeGreaterThan(10);
      expect(en.suggestion.length, `${code} suggestion خالی`).toBeGreaterThan(10);
    }
  });

  it('کاتالوگ ۳رقمی LEGACY_ERROR_MESSAGES_EN جدا و مستند است (46 ورودی، فقط سه‌رقمی، بدون تداخل)', () => {
    const legacyKeys = Object.keys(LEGACY_ERROR_MESSAGES_EN).sort();
    expect(legacyKeys).toHaveLength(46);
    const resKeys = new Set(Object.keys(RESERVED_ERROR_CODES));
    for (const key of legacyKeys) {
      expect(THREE_DIGIT.test(key), `${key} باید سه‌رقمی باشد`).toBe(true);
      const text = LEGACY_ERROR_MESSAGES_EN[key];
      expect(typeof text === 'string' && text.length > 10, `${key} متن legacy خالی`).toBe(true);
      // سه‌رقمی‌ها legacy runtime هستند (نه کاتالوگ ۴رقمی) — تداخل ندارند.
      expect(resKeys.has(key)).toBe(false);
    }
  });

  it('createReservedError به locale فعلی حساس است (fa پیش‌فرض کانونیک، en از کاتالوگ)', () => {
    try {
      setErrorLocale('fa');
      const fa = createReservedError('ZEN-9001');
      expect(fa).toBeInstanceOf(ZenithError);
      expect(fa.message).toBe(`[ZEN-9001] ${RESERVED_ERROR_CODES['ZEN-9001'].message}`);
      expect(fa.suggestion).toBe(RESERVED_ERROR_CODES['ZEN-9001'].suggestion);

      setErrorLocale('en');
      const en = createReservedError('ZEN-9001');
      expect(en.message).toBe(`[ZEN-9001] ${ERROR_MESSAGES_EN['ZEN-9001'].message}`);
      expect(en.suggestion).toBe(ERROR_MESSAGES_EN['ZEN-9001'].suggestion);
      // ترجمه واقعاً متفاوت از fa است (نه پس‌افتاده به fa).
      expect(en.message).not.toBe(fa.message);
    } finally {
      setErrorLocale('fa');
    }
    expect(getErrorMessage('ZEN-0000')).toBeUndefined();
  });

  it('کدهای cli در check.ts فقط بازهٔ ZEN-90NN هستند (Z### قدیمی حذف شده)', () => {
    const checkSrc = readFileSync('packages/cli/src/check.ts', 'utf8');
    expect(checkSrc).not.toMatch(/rule:\s*'Z\d{3}'/);
    expect(checkSrc).toContain("rule: 'ZEN-9001'");
    expect(checkSrc).toContain("rule: 'ZEN-9082'");
  });

  it('docs/ERROR-CODES.md بدون drift است (node scripts/generate-error-docs.mjs --check)', () => {
    const result = spawnSync('node', ['scripts/generate-error-docs.mjs', '--check'], {
      encoding: 'utf8',
    });
    expect(result.status, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
  });
});
