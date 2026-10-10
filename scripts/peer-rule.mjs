#!/usr/bin/env node
// #46 — قاعدهٔ peerDependency برای singletonهای reactivity:
// هر پکیجی جز خودِ `@zenith/state` و `@zenith/scheduler` باید این دو را
// **فقط** در peerDependencies (با بازهٔ caret `^<major>.<minor>.<patch>`)
// داشته باشد و هرگز در dependencies. دلیل: این دو پکیج «نمونهٔ مشترک»
// (signal graph / scheduler queue) هستند؛ اگر دو نسخه نصب شود، reactivity
// بی‌صدا می‌شکند. state→scheduler عمداً استثناست (هستهٔ پایین‌تر؛ DEC-018).
//
// بررسی‌ها (برای هر دو پکیج هدف state و scheduler):
//   1. در `dependencies` هیچ مصرف‌کننده‌ای آن را نداشته باشد (به‌جز state→scheduler).
//   2. اگر در peerDependencies اعلام شده باشد، بازه باید caret هماهنگ با
//      نسخهٔ فعلی repo (`^X.Y.Z`) باشد (نه pin دقیق، نه >=، نه *).
//   3. لبهٔ مجاز state→scheduler باید همچنان به‌عنوان dependency باقی بماند.
//
// کد خروج 0 = رعایت قاعده؛ 1 = لیست نقض‌ها.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { collectUsed } from './unused-zenith-deps.mjs';

const TARGETS = ['@zenith/state', '@zenith/scheduler'];
// استثنای هسته‌ای: state، scheduler را به‌عنوان dependency واقعی می‌گیرد.
const ALLOWED_RUNTIME_EDGE = new Set(['@zenith/state>@zenith/scheduler']);

export function checkPeerRule(packagesDir, currentVersion = '1.4.0') {
  const violations = [];
  const dirs = readdirSync(packagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .filter((d) => existsSync(join(packagesDir, d.name, 'package.json')))
    .map((d) => d.name);

  const caret = new RegExp(`^\\^${currentVersion.replace(/\./g, '\\.')}$`);

  for (const dir of dirs) {
    const pkgPath = join(packagesDir, dir, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    if (pkg.name !== `@zenith/${dir}`) continue;
    if (TARGETS.includes(pkg.name)) continue; // خودِ state/scheduler بررسی نمی‌شوند

    // فقط src (runtime) — import در test در ورک‌اسپس اجرا می‌شود و peer لازم ندارد.
    const used = collectUsed(join(packagesDir, dir), ['src']);
    for (const target of TARGETS) {
      const short = target.slice('@zenith/'.length);
      const inDeps = !!(pkg.dependencies && pkg.dependencies[target]);
      if (inDeps && !ALLOWED_RUNTIME_EDGE.has(`${pkg.name}>${target}`)) {
        violations.push(`${dir}: ${target} must be peerDependencies only (found in dependencies)`);
      }
      const peer = pkg.peerDependencies && pkg.peerDependencies[target];
      if (peer && !caret.test(peer)) {
        violations.push(`${dir}: peer ${target} range "${peer}" must match ^${currentVersion}`);
      }
      // مصرف‌کننده‌ای که target را واقعاً import می‌کند باید آن را peer اعلام کند.
      if (used.has(short) && !peer && !inDeps) {
        violations.push(`${dir}: imports ${target} but does not declare it as a peerDependency`);
      }
    }
  }

  // state→scheduler (the one allowed runtime edge) must stay declared.
  const statePkg = JSON.parse(readFileSync(join(packagesDir, 'state', 'package.json'), 'utf8'));
  if (!statePkg.dependencies || !statePkg.dependencies['@zenith/scheduler']) {
    violations.push('state: @zenith/scheduler must remain a dependency of state (core pairing)');
  }

  return violations;
}

function main() {
  const root = process.cwd();
  const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
  const violations = checkPeerRule(join(root, 'packages'), version);
  console.log(
    `🔎 peer-rule (state/scheduler singleton): ${violations.length === 0 ? 'OK' : violations.length + ' violation(s)'}`,
  );
  for (const v of violations) console.log('  ✗ ' + v);
  if (violations.length > 0) {
    console.error('\n❌ قاعدهٔ #46 نقض شده: state/scheduler فقط peer (با ^' + version + ').');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
