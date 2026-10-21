// benchmarks/lib/env.mjs
// #86 — environment probing. A benchmark number without its environment is an
// anecdote: the doc must record hardware, OS, runtime AND the DOM engine (the
// list suite runs in jsdom here — see docs/BENCHMARKS.md, «محدودیت‌ها»).
import os from 'node:os';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/**
 * نسخهٔ یک پکیج نصب‌شده (null اگر نصب نباشد — مثلاً قبل از `npm install`).
 * اگر `exports` پکیج `./package.json` را ندهد (مثل `@preact/signals-core`)،
 * از مسیر ورودی resolveشده بالا می‌رویم تا package.json خودش را پیدا کنیم.
 */
export function installedVersion(pkgName) {
  try {
    const version = require(`${pkgName}/package.json`).version;
    if (version) return version;
  } catch {
    // ادامه: fallback مسیر ورودی
  }
  try {
    let dir = dirname(require.resolve(pkgName));
    for (let i = 0; i < 6; i++) {
      const candidate = join(dir, 'package.json');
      if (existsSync(candidate)) {
        const pkg = JSON.parse(readFileSync(candidate, 'utf8'));
        if (pkg.name === pkgName && pkg.version) return pkg.version;
      }
      dir = dirname(dir);
    }
  } catch {
    // نصب‌نشده
  }
  return null;
}

/** مشخصات سخت‌افزار/سیستم/رانتایم + موتور DOM. */
export function collectEnvironment() {
  const cpus = os.cpus();
  const totalMemGb = Number((os.totalmem() / 1024 ** 3).toFixed(1));
  const jsdomVersion = installedVersion('jsdom');
  const env = {
    node: process.version,
    v8: process.versions.v8,
    platform: `${process.platform} ${process.arch}`,
    osRelease: `${os.type()} ${os.release()}`,
    cpuModel: (cpus[0]?.model ?? 'unknown').replace(/\s+/g, ' ').trim(),
    cpuCores: cpus.length,
    cpuSpeedMhz: cpus[0]?.speed ?? null,
    totalMemGb,
    domEngine: jsdomVersion ? `jsdom@${jsdomVersion}` : 'none',
    archived: process.arch,
  };
  env.signature = environmentSignature(env);
  return env;
}

/**
 * «اثر انگشتِ محیط» — مبنای مقایسهٔ ۵٪. اگر سخت‌افزار/نسخهٔ Node/jsdom عوض شود،
 * اعداد baseline قابلِ مقایسه نیستند و `npm run bench` فقط هشدار می‌دهد.
 */
export function environmentSignature(env) {
  return [env.node, env.platform, env.cpuModel, `${env.cpuCores}c`, env.domEngine].join(' | ');
}

/**
 * همان محیطی که baseline در آن ثبت شده؟
 * امضا از **مؤلفه‌های زنده** بازمحاسبه می‌شود (نه رشتهٔ ذخیره‌شده) تا مقایسه با
 * یک محیط دست‌کاری‌شده (`{...env, domEngine: 'none'}`) هم درست جواب بدهد.
 */
export function sameEnvironment(a, b) {
  if (!a || !b) return false;
  return environmentSignature(a) === environmentSignature(b);
}
