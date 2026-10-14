// packages/cli/src/telemetry.ts
//
// #94 (STABILITY): telemetry اختیاری با opt-in صریح — پیش‌فرض همیشه خاموش.
//
// اصول طراحی (هم‌راستا با docs/PRIVACY.md):
//   1. بدون `zenith telemetry on` (کانفیگ) یا `ZENITH_TELEMETRY=1` هیچ سایه‌ای از
//      ارسال شبکه وجود ندارد — حتی lazy import ماژول این رفتار را تغییر نمی‌دهد.
//   2. `ZENITH_TELEMETRY=0` بر هر کانفیگی غالب است (kill switch).
//   3. بدون تعیین `ZENITH_TELEMETRY_ENDPOINT` حتی کاربرِ راضی هم هیچ درخواستی
//      خارج نمی‌شود (هیچ سرور پیش‌فرضی وجود ندارد؛ endpoint متعلق به تیم خود
//      کاربر است).
//   4. دادهٔ ارسالی مستند و مینیمال است: نام رویداد، نسخهٔ zenith، نسخهٔ major
//      Node، platform و فلگ ci. مسیر فایل، نام پروژه، نام کاربر و هر PII هرگز
//      ارسال نمی‌شود (فیلتر sanitizeTelemetryProps کلیدهای حساس را حذف می‌کند).
//   5. خطای ارسال هرگز سطح کاربر نمی‌بیند (best-effort fire-and-forget).

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface TelemetryStatus {
  enabled: boolean;
  /** منشأ تصمیم: env غلبه دارد، بعد config file، وگرنه پیش‌فرض خاموش. */
  source: 'default-off' | 'config' | 'env';
  configPath: string;
  endpoint?: string;
}

/** TELEMETRY_FIELDS (#94): تنها فیلدهایی که در هر رویداد ممکن است برود. */
export const TELEMETRY_FIELDS = [
  'event (نام رویداد انگلیسی، مثل build.start)',
  'zenithVersion (نسخهٔ پکیج CLI)',
  'nodeMajor (major نسخهٔ Node، مثل 22)',
  'platform (linux|darwin|win32)',
  'ci (true/false)',
] as const;

const SENSITIVE_KEY =
  /path|dir|file|home|name|user|email|token|secret|key|url|host|repo|project|cwd/i;

function configDir(): string {
  return process.env.ZENITH_CONFIG_HOME?.trim() || path.join(os.homedir(), '.zenith');
}

function configPath(): string {
  return path.join(configDir(), 'telemetry.json');
}

function readConfig(): { enabled: boolean } | null {
  try {
    const raw = fs.readFileSync(configPath(), 'utf8');
    const j = JSON.parse(raw) as { enabled?: unknown };
    return { enabled: j.enabled === true };
  } catch {
    return null;
  }
}

/** #94: وضعیت فعلی telemetry (پیش‌فرض خاموش؛ env غالب). */
export function telemetryStatus(): TelemetryStatus {
  const env = process.env.ZENITH_TELEMETRY?.trim();
  if (env === '0') {
    return { enabled: false, source: 'env', configPath: configPath() };
  }
  if (env === '1') {
    return { enabled: true, source: 'env', configPath: configPath(), endpoint: endpoint() };
  }
  const cfg = readConfig();
  const enabled = cfg?.enabled === true;
  return {
    enabled,
    source: cfg ? 'config' : 'default-off',
    configPath: configPath(),
    endpoint: enabled ? endpoint() : undefined,
  };
}

/** #94: تنظیم دائمی on/off در فایل کانفیگ کاربر. */
export function setTelemetryEnabled(enabled: boolean): void {
  fs.mkdirSync(configDir(), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify({ enabled }, null, 2) + '\n', 'utf8');
}

function endpoint(): string | undefined {
  const e = process.env.ZENITH_TELEMETRY_ENDPOINT?.trim();
  return e && /^https:\/\//.test(e) ? e : undefined;
}

/** حذف کلیدهای بالقوهٔ PII از props — هر چیزی که به مسیر/نام/توکن شبیه باشد. */
export function sanitizeTelemetryProps(props?: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!props) return out;
  for (const [k, v] of Object.entries(props)) {
    if (SENSITIVE_KEY.test(k)) continue;
    if (typeof v === 'string' && (v.includes('/') || v.includes('\\'))) continue;
    if (v === null || v === undefined) continue;
    if (typeof v === 'object') continue;
    out[k] = v;
  }
  return out;
}

let pending: Promise<unknown>[] = [];

/**
 * #94: ثبت رویداد. اگر telemetry غیرفعال/endpoint ناموجود باشد، no-op کامل است.
 * منتظر نمی‌ماند و هرگز throw نمی‌کند.
 */
export function telemetryEvent(event: string, props?: Record<string, unknown>): void {
  const status = telemetryStatus();
  if (!status.enabled || !status.endpoint) return;
  const payload = {
    event,
    ...sanitizeTelemetryProps(props),
    zenithVersion: cliVersion(),
    nodeMajor: Number(process.versions.node.split('.')[0]),
    platform: process.platform,
    ci: process.env.CI === 'true',
  };
  try {
    pending.push(
      fetch(status.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => undefined),
    );
    if (pending.length > 8) pending = pending.slice(-8);
  } catch {
    /* telemetry هرگز سطح کاربر نمی‌بیند */
  }
}

function cliVersion(): string {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** #94: پیاده‌سازی دستور `zenith telemetry on|off|status`. */
export function runTelemetry(action: string | undefined): number {
  switch (action) {
    case 'on': {
      setTelemetryEnabled(true);
      console.log(
        '✅ [#94] telemetry فعال شد — فقط: ' +
          TELEMETRY_FIELDS.join('، ') +
          '. قطع هر وقت خواستید: zenith telemetry off یا ZENITH_TELEMETRY=0.',
      );
      return 0;
    }
    case 'off': {
      setTelemetryEnabled(false);
      console.log('✅ [#94] telemetry خاموش شد؛ کانفیگ به‌روزرسانی شد.');
      return 0;
    }
    case 'status':
    case undefined: {
      const s = telemetryStatus();
      console.log(`telemetry: ${s.enabled ? 'فعال ✅' : 'خاموش ⛔ (پیش‌فرض)'}`);
      console.log(`  منشأ: ${s.source} | کانفیگ: ${s.configPath}`);
      if (s.enabled && !s.endpoint) {
        console.log('  ⚠️  توجه: بدون ZENITH_TELEMETRY_ENDPOINT هیچ ارسالی انجام نمی‌شود.');
      }
      if (s.endpoint) console.log(`  endpoint: ${s.endpoint}`);
      return 0;
    }
    default:
      console.error(`zenith telemetry: action ناشناخته «${action}» — مجاز: on | off | status`);
      return 1;
  }
}
