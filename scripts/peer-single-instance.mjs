#!/usr/bin/env node
// #46 — راستی‌آزمایی «یک نمونه» از طریق نصب واقعی tarball در پروژهٔ تازه.
//
// ادعا: وقتی مصرف‌کننده‌ها state/scheduler را peer می‌گیرند، یک `npm install`
// در پروژهٔ تازه دقیقاً **یک** کپی از هر singleton در درخت node_modules می‌سازد
// (تودرتو شدن نسخه‌های جدا، که reactivity را می‌شکند، رخ نمی‌دهد).
//
// روش:
//   1) npm pack روی state، scheduler و دو مصرف‌کننده (store و form).
//   2) ساخت پروژهٔ موقت و نصب هم‌زمان همهٔ tarballها.
//   3) شمارش کپی‌های @zenith/state و @zenith/scheduler در کل درخت
//      node_modules (ریشه + nested) → هر کدام باید دقیقاً ۱ باشد.
//   4) پروب reactivity بین‌پکیجی: یک signal از @zenith/state به درون
//      `defineStore` (که خودش @zenith/state را import می‌کند) وصل می‌شود؛
//      اگر دو نمونهٔ state وجود داشت، اثر مشترک نمی‌شد.
//
// نیازمند `npm run build` (dist موجود باشد). کد خروج 0 = تأیید؛ غیرصفر = نقض.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const PACKAGES = ['state', 'scheduler', 'store', 'form'];
const SINGLETONS = ['state', 'scheduler'];

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', ...opts }).trim();
}

/**
 * تعداد نصب‌های `@scope/name` در کل درخت node_modules ریشه (شامل nested).
 * هر node_modules در هر عمق بررسی می‌شود.
 */
function countInstalls(appDir, scope, name) {
  let count = 0;
  const seen = new Set();
  const visit = (dir) => {
    // دایرکتوری‌های node_modules در این سطح
    const nm = join(dir, 'node_modules');
    if (existsSync(nm)) {
      const target = join(nm, scope, name);
      if (existsSync(join(target, 'package.json'))) count += 1;
      // پایین‌تر: هر پکیج داخل nm ممکن است node_modules خودش داشته باشد
      for (const e of readdirSync(nm, { withFileTypes: true })) {
        if (!e.isDirectory()) continue;
        if (e.name.startsWith('@')) {
          for (const sub of readdirSync(join(nm, e.name), { withFileTypes: true })) {
            if (sub.isDirectory()) visit(join(nm, e.name, sub.name));
          }
        } else if (e.name !== '.bin') {
          visit(join(nm, e.name));
        }
      }
    }
  };
  visit(appDir);
  void seen;
  return count;
}

function main() {
  const repo = process.cwd();
  const work = mkdtempSync(join(tmpdir(), 'zen-peer-install-'));
  try {
    const tarballs = [];
    for (const p of PACKAGES) {
      const dir = join(repo, 'packages', p);
      if (!existsSync(join(dir, 'dist'))) {
        throw new Error(`packages/${p}/dist missing — run \`npm run build\` first`);
      }
      const out = sh('npm', ['pack', '--pack-destination', work], { cwd: dir });
      tarballs.push(join(work, out));
    }

    const app = join(work, 'app');
    mkdirSync(app, { recursive: true });
    writeFileSync(
      join(app, 'package.json'),
      JSON.stringify(
        { name: 'peer-single-instance-app', version: '0.0.0', private: true, type: 'module' },
        null,
        2,
      ),
    );
    sh('npm', ['install', '--no-audit', '--no-fund', '--ignore-scripts', ...tarballs], {
      cwd: app,
      stdio: 'pipe',
    });

    const failures = [];
    const counts = {};
    for (const name of SINGLETONS) {
      const c = countInstalls(app, '@zenith', name);
      counts[name] = c;
      if (c !== 1) failures.push(`expected exactly 1 @zenith/${name}, found ${c}`);
    }
    console.log(
      `🔎 peer single-instance: @zenith/state=${counts.state} copies, @zenith/scheduler=${counts.scheduler} copies`,
    );

    if (failures.length === 0) {
      const probe = join(app, 'probe.mjs');
      writeFileSync(
        probe,
        [
          `import { signal } from '@zenith/state';`,
          `import { flushSync } from '@zenith/scheduler';`,
          `import { defineStore } from '@zenith/store';`,
          `// یک signal از @zenith/state (نسخهٔ برنامه) را به store وصل کن.`,
          `// اگر store نمونهٔ دومی از state داشت، این getter واکنش نشان نمی‌داد.`,
          `const outside = signal(1);`,
          `const useStore = defineStore('probe', {`,
          `  state: () => ({ seed: 0 }),`,
          `  getters: { doubled() { return outside.get() * 2; } },`,
          `});`,
          `const st = useStore();`,
          `const read = () => (st.doubled && typeof st.doubled.get === 'function' ? st.doubled.get() : st.doubled);`,
          `flushSync();`,
          `if (read() !== 2) {`,
          `  console.error('cross-instance reactivity failed: got ' + read()); process.exit(1);`,
          `}`,
          `outside.set(3);`,
          `flushSync();`,
          `if (read() !== 6) {`,
          `  console.error('shared graph broken after set: got ' + read()); process.exit(1);`,
          `}`,
          `console.log('OK: single shared state instance across app + store');`,
        ].join('\n'),
      );
      try {
        sh('node', ['probe.mjs'], { cwd: app });
      } catch (e) {
        failures.push('cross-package reactivity probe failed: ' + (e.stderr || e.message || e));
      }
    }

    if (failures.length > 0) {
      console.error('\n❌ ' + failures.join('\n❌ '));
      process.exit(1);
    }
    console.log('✅ دقیقاً یک نمونه از state و scheduler — قاعدهٔ peer کار می‌کند (#46).');
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

main();
