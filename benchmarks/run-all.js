// benchmarks/run-all.js
//
// ⚠️ DEPRECATED — از #86 فقط یک اجراکننده وجود دارد: `npm run bench`.
//
// این فایل دیگر خودش اندازه‌گیری نمی‌کند (اسکریپت‌های قدیمی `benchmarks/src`,
// `runtime`, `resource`, `ssr` تاریخی‌اند و اعدادشان ثبت‌نشده/غیرقابل‌بازتولید
// بود). حالا فقط پاس‌دهنده است تا اسکریپت‌ها و اسناد قدیمی نشکنند و همه به همان
// سوئیت ثبت‌شده برسند:
//
//   node benchmarks/run-all.js            → مانند `npm run bench`
//   node benchmarks/run-all.js -- --json  → آرگومان‌ها پاس داده می‌شوند
//
// خروجی مرجع (اعداد + گیت): `docs/BENCHMARKS.md`
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const forwarded = process.argv.slice(2).filter((arg, i, all) => !(arg === '--' && i === 0));
const args = [join(ROOT, 'scripts', 'bench.mjs'), ...forwarded];

console.log(
  '⚠️  benchmarks/run-all.js منسوخ شده است — از `npm run bench` استفاده کنید (docs/BENCHMARKS.md).\n',
);

const result = spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' });
process.exit(result.status ?? 1);
