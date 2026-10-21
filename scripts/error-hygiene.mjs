#!/usr/bin/env node
// #115 (DEC-031) — گیت بهداشت مدل خطای واحد:
//  1. `throw new Error` فقط در allowlist (توضیح‌دار) مجاز است.
//  2. هیچ پکیجی حق ندارد interface/class موازی `ZenithError` export کند —
//     تنها @zenith/errors (core.ts). state/error-boundary فقط alias دارند.
//  3. `onError` فقط در @zenith/errors/hub.ts پیاده‌سازی می‌شود؛ بقیه re-export/wrapper.
//  4. ceiling شمارش console.error/warn در packages/*/src — فقط رو به پایین
//     (کاهش پلکانی در #112/#137؛ hub تنها لاگر مجاز error-path است).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const fail = (msg) => {
  console.error(`❌ error-hygiene (#115): ${msg}`);
  process.exitCode = 1;
};

/** allowlist throw new Error — فایل → پیش‌شرط توضیح (کامنت #115 در فایل یا خود خط). */
const THROW_ALLOWLIST = {
  // expressions: خطاهای parse داخلی که در لایهٔ بالاتر به
  // expressionSyntaxError/compileSyntaxError (ZEN-004/ZEN-503) تبدیل می‌شوند.
  'packages/expressions/src/parser.ts': 'internal parse errors wrapped by expressionSyntaxError',
  'packages/expressions/src/evaluator.ts': 'internal dispatch errors wrapped by callers',
  'packages/expressions/src/validator.ts': 'internal validation errors wrapped by callers',
  // compiler: strict-mode warning throws (ZEN-501/ZEN-502 مسیر اصلی‌شان reportError است).
  'packages/compiler/src/compiler.ts': 'strict-mode compile warnings (documented; #138 parity)',
  // tooling: cli/lighthouse — زیرسهام tooling، خارج از مسیر runtime.
  'packages/cli/src/lighthouse.ts': 'tooling (CLI) — not a runtime library path',
  // tooling (#163): cli/ssg — پیام‌های سطح CLI برای کاربر، خارج از مسیر runtime.
  'packages/cli/src/ssg.ts': 'tooling (CLI) — not a runtime library path',
  // internal invariant fallbacks (هرگز نباید رخ دهند؛ گیت #171 catalog را قفل کرده).
  'packages/shared/src/assert.ts': 'fail-fast catalog invariant',
  'packages/errors/src/core.ts': 'fail-fast catalog invariant (createReservedError)',
};

// ceiling شمارش console.error/console.warn در src — فقط رو به پایین (DEC-031:
// «حذف پیشوندهای اختصاصی و console.* مستقیم در error-path»؛ ۲۰۲ از baseline ۲۴۷
// در #115؛ ۲۰۱ در #117 (تک‌مسیر نصب stateful ⇒ حذف یک console.warn تکراری)؛
// هدف‌های ۱۲۰/۸۰/۴۰ پلکانی در #112/#137 و موج‌های بعدی).
// پایین‌آوردن ceiling آزاد، بالا بردن آن باید در DEC ثبت شود.
// توجه: باقی‌مانده‌ها عمدتاً لاگ‌های غیرerror-path (debug/diagnostic) یا فایل‌های
// allowlist-شده (cli/compiler/vite-plugin tooling) هستند که در #137 هدف‌گیری می‌شوند.
// DEC-033 (#94): دو console.error UX در دستور CLI «zenith telemetry» (201 → 203)؛
// با مهاجرت CLI در #39 به 201 بازمی‌گردد.
const CONSOLE_CEILING = 203;

function listSources(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...listSources(p));
    else if (e.endsWith('.ts') && !e.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const pkgRoot = join(ROOT, 'packages');
let consoleCount = 0;
for (const pkg of readdirSync(pkgRoot)) {
  const src = join(pkgRoot, pkg, 'src');
  let files;
  try {
    files = listSources(src);
  } catch {
    continue;
  }
  for (const f of files) {
    const rel = relative(ROOT, f).split('\\').join('/');
    const text = readFileSync(f, 'utf8');
    const lines = text.split('\n');

    // 1) throw new Error خارج از allowlist
    lines.forEach((line, i) => {
      if (/throw new Error\(/.test(line) && !line.trim().startsWith('//')) {
        if (!THROW_ALLOWLIST[rel]) {
          fail(
            `${rel}:${i + 1}: throw new Error بدون allowlist (#115) — از ZenithError/developerError استفاده کن`,
          );
        }
      }
    });

    // 2) interface/class ZenithError موازی
    if (
      rel !== 'packages/errors/src/core.ts' &&
      /^(export )?(interface|class) ZenithError\b/m.test(text)
    ) {
      fail(`${rel}: declares its own ZenithError — مدل واحد در @zenith/errors است (#115)`);
    }

    // 3) onError: پیاده‌سازی (listener array) فقط در hub. بیرون از hub فقط
    //    re-export یا wrapper که به hub delegate می‌کند مجاز است.
    if (
      rel !== 'packages/errors/src/hub.ts' &&
      /export (?:function onError\(|const onError =)/.test(text)
    ) {
      const reexport =
        /export \{[^}]*\bonError\b[^}]*\} from '@zenith\/(errors|state)'/.test(text) ||
        /export (?:const|type) onError\b[^\n]*from '@zenith\/(errors|state)'/.test(text);
      // wrapper مجاز: hub onError را (با نام onErrorFrom یا مستقیم) import و
      // داخل بدنه صدا می‌زند — یعنی listener موازی نمی‌سازد.
      const importsHub = /import\s*\{[^}]*\bonError\b[^}]*\}\s*from\s*'@zenith\/errors'/.test(text);
      const delegates =
        /\bonErrorFrom\s*\(/.test(text) ||
        /export (?:const|function) onError\b[\s\S]{0,400}?\bonErrorFrom\s*\(/.test(text);
      if (!reexport && !(importsHub && delegates)) {
        fail(`${rel}: export عمومی onError جدید (#115) — فقط re-export/wrapper روی hub مجاز است`);
      }
    }

    // 4) شمارش console.*
    consoleCount += (text.match(/console\.(error|warn)\(/g) || []).length;
  }
}

if (consoleCount > CONSOLE_CEILING) {
  fail(
    `console.error/warn در packages/*/src = ${consoleCount} > ceiling ${CONSOLE_CEILING} (#115: فقط رو به پایین)`,
  );
}

if (process.exitCode) {
  console.error('error-hygiene: FAILED');
} else {
  console.log(
    `✅ error-hygiene: throw-allowlist + single-model + console ceiling (${consoleCount}/${CONSOLE_CEILING}) OK`,
  );
}
