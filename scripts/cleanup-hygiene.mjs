#!/usr/bin/env node
// #116 (DEC-032) — گیت پروتکل یکسان cleanup:
//  1. هر تابع exportشدهٔ `process*`/`bind*` در packages/*/src باید نوع
//     بازگشتی Cleanup (`() => void` یا `Cleanup`) داشته باشد — نه `void`.
//     استثنای نام‌گذاری: processFetchWithCache یک utility داده (Promise) با
//     پیشوند اشتباه است؛ در PROCESS_NAME_ALLOWLIST با دلیل ثبت شده.
//     controllerها (VirtualListController) خود تابعِ قابل‌صدازدن‌اند و در
//     DEC-032 مستند شده‌اند.
//  2. هیچ عضو عمومی `destroy`/`cancel`/`stop` نباید غیر-alias باشد:
//     alias یعنی TSDoc `@deprecated` پیش از عضو + در همان فایل
//     `deprecate('ZEN-DEPR-…', '<x>.destroy()')` فراخوانی شود و `dispose`
//     در فایل وجود داشته باشد. نام‌های رفتاری (چرخهٔ عمر نیستند) در
//     BEHAVIORAL_ALLOWLIST با اشاره به DEC-032 ثبت‌اند و خود فایل هم باید
//     کامنت DEC-032 داشته باشد.
//
// idempotency و تست‌های نشت رفتاری در packages/*/test/cleanup-protocol.test.ts
// سنجیده می‌شوند؛ این گیت قرارداد سطح API را قفل می‌کند.
//
// `checkCleanupHygiene(pkgRoot)` به‌صورت pure export می‌شود تا با fixture
// مصنوعی در scripts/test/cleanup-hygiene.test.mjs قابل تست باشد (قرمز-پیش-رفع).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * allowlist «نام رفتاری» که چرخهٔ عمر نیست (DEC-032):
 * فایل → عضو → دلیل. خود فایل هم باید کامنت DEC-032 داشته باشد (چک می‌شود
 * تا allowlist بی‌سند نماند).
 */
export const BEHAVIORAL_ALLOWLIST = {
  // TransitionRun.cancel: لغو یک *اجرای* در حال انجام (run-scoped)؛
  // خودِ controller dispose() دارد.
  'packages/transition/src/transition.ts': {
    cancel: 'run-scoped cancellation semantics, not lifecycle (DEC-032)',
  },
  // Zen.stop: فرمان خاموش‌کردن کامل اپ با usage متفاوت از dispose یک نمونه.
  'packages/runtime/src/index.ts': {
    stop: 'framework shutdown verb, not per-instance lifecycle (DEC-032)',
  },
  // فیلد بولی نتیجهٔ validate — اصلاً متد نیست.
  'packages/schema/src/validate.ts': {
    stop: 'boolean result field, not a method (DEC-032)',
  },
  // tooling CLI: هندل server تستی.
  'packages/cli/src/lighthouse.ts': {
    stop: 'tooling-only server handle (DEC-032)',
  },
};

/** استثنای rule #1 (پیشوند نام‌گذاری اشتباه) — فایل → تابع → دلیل. */
export const PROCESS_NAME_ALLOWLIST = {
  'packages/data/src/fetcher.ts': {
    processFetchWithCache:
      'data-fetch utility returning Promise (misleading legacy prefix); its directive twin processFetch returns Cleanup (#116/DEC-032)',
  },
};

function listSources(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) listSources(p, out);
    else if (e.endsWith('.ts') && !e.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

/**
 * @param {string} packagesDir مسیر packages/ مخزن
 * @param {(relPath: string) => string} read متن فایل نسبت به packages/
 * @returns {{errors: string[], processChecked: number, membersChecked: number}}
 */
export function checkCleanupHygiene(packagesDir, read) {
  const errors = [];
  let processChecked = 0;
  let membersChecked = 0;

  for (const pkg of readdirSync(packagesDir)) {
    const src = join(packagesDir, pkg, 'src');
    let files;
    try {
      files = listSources(src);
    } catch {
      continue; // پکیج بدون src
    }
    for (const f of files) {
      const relf = relative(packagesDir, f).split('\\').join('/'); // "x/src/y.ts"
      const relRepo = `packages/${relf}`;
      const text = read(relRepo);

      // ── ۱. process*/bind* ⇒ نوع بازگشتی Cleanup ──
      for (const m of text.matchAll(
        /^export (?:async )?function ((?:process|bind)[A-Za-z]*)\s*(?:<[^>]*>)?\(/gm,
      )) {
        const name = m[1];
        if (PROCESS_NAME_ALLOWLIST[relRepo]?.[name]) continue;
        // پیمایش تا )ِ بسته‌شوندهٔ پارامترها (تودرتو مجاز)، بعد اولین { بدنه.
        const openParen = m.index + m[0].length - 1;
        let depth = 0;
        let i = openParen;
        for (; i < text.length; i++) {
          if (text[i] === '(') depth++;
          else if (text[i] === ')') {
            depth--;
            if (depth === 0) break;
          }
        }
        const brace = text.indexOf('{', i);
        if (brace === -1) {
          errors.push(`${relRepo}: ${name} — پایان امضا پیدا نشد`);
          continue;
        }
        const sig = text.slice(i + 1, brace).trim(); // مثل ": T"
        processChecked += 1;
        if (!sig.startsWith(':')) {
          errors.push(`${relRepo}: ${name} — نوع بازگشتی صریح ندارد؛ باید Cleanup برگرداند (#116)`);
          continue;
        }
        const ret = sig.slice(1).trim().replace(/\s+/g, ' ');
        // controllerها خود تابع Cleanup‌اند (VirtualListController — DEC-032).
        const ok = ret === '() => void' || ret === 'Cleanup' || ret.endsWith('Controller');
        if (!ok) {
          errors.push(
            `${relRepo}: ${name} — نوع بازگشتی "${ret}" باید Cleanup (() => void) باشد (#116 acceptance)`,
          );
        }
      }

      // ── ۲. عضو destroy/cancel/stop: alias یا allowlist ──
      const lines = text.split('\n');
      const allow = BEHAVIORAL_ALLOWLIST[relRepo] ?? {};
      const nameAllow = PROCESS_NAME_ALLOWLIST[relRepo] ?? {};
      const seen = new Set();
      lines.forEach((line, idx) => {
        const m = line.match(
          /^\s{2,}(?:public\s+|readonly\s+)?(destroy|cancel|stop)\s*\??\s*(?:\([^)]*\))?\s*:/,
        );
        if (!m) return;
        const name = m[1];
        seen.add(name);
        membersChecked += 1;
        if (allow[name]) return;
        const before = lines.slice(Math.max(0, idx - 8), idx).join('\n');
        // شواهد alias در سطح فایل: deprecate('ZEN-DEPR-…', '<x>.<name>()') +
        // وجود dispose در فایل (نگاشت به آن رفتاری در تست‌ها سنجیده شده).
        const hasDeprecateCall = new RegExp(
          `deprecate\\(\\s*'ZEN-DEPR-\\d+',\\s*'[^']*\\.${name}\\(\\)'`,
        ).test(text);
        const isAlias =
          /@deprecated/.test(before) && hasDeprecateCall && /dispose\s*[(?:]/.test(text);
        if (!isAlias) {
          errors.push(
            `${relRepo}:${idx + 1} — عضو "${name}" نه alias است (نیاز: @deprecated + deprecate('ZEN-DEPR-…', '<x>.${name}()') + dispose) و نه در allowlist DEC-032`,
          );
        }
      });
      for (const name of Object.keys(allow)) {
        if (!seen.has(name)) {
          errors.push(
            `${relRepo}: ردیف allowlist "${name}" دیگر عضوی با این نام ندارد — پاکش کن (#116)`,
          );
        }
      }
      if (Object.keys(allow).length && !/DEC-032/.test(text)) {
        errors.push(`${relRepo}: در BEHAVIORAL_ALLOWLIST است اما کامنت "DEC-032" در فایل نیست`);
      }
      if (Object.keys(nameAllow).length && !/#116/.test(text)) {
        errors.push(`${relRepo}: در PROCESS_NAME_ALLOWLIST است اما کامنت "#116" در فایل نیست`);
      }
    }
  }
  return { errors, processChecked, membersChecked };
}

// ── حالت CLI ──
const isCli = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isCli) {
  const { errors, processChecked, membersChecked } = checkCleanupHygiene(
    join(ROOT, 'packages'),
    (relp) => readFileSync(join(ROOT, relp), 'utf8'),
  );
  for (const e of errors) {
    console.error(`❌ cleanup-hygiene (#116): ${e}`);
  }
  if (errors.length) {
    console.error('cleanup-hygiene: FAILED');
    process.exit(1);
  } else {
    console.log(
      `✅ cleanup-hygiene (#116): ${processChecked} process*/bind* با نوع بازگشتی Cleanup؛ ${membersChecked} عضو destroy/cancel/stop همگی alias یا allowlist (DEC-032)`,
    );
  }
}
