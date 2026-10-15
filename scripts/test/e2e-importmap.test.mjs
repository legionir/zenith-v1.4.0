// scripts/test/e2e-importmap.test.mjs
// #120 — هر specifierی که یک fixture e2e به‌صورت گذرا import می‌کند باید در
// importmap همان فایل mapped باشد؛ در غیر این صورت مرورگر ماژول را resolve
// نمی‌کند و صفحه بی‌صدا خالی می‌ماند (سناریوی e2e/events.spec.ts در آستانهٔ
// افزودن `@zenith/schema/attr` به error-boundary).
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { isFullyBuilt } from '../lib/workspace.mjs';

const ROOT = process.cwd();
const E2E = join(ROOT, 'e2e');

/** ماژول‌های `@zenith/*` که یک باندل dist وارد می‌کند. */
function distImports(pkg) {
  const file = join(ROOT, 'packages', pkg, 'dist', 'index.js');
  if (!existsSync(file)) return [];
  const raw = readFileSync(file, 'utf8').match(/from"@zenith\/[^"]+"/g) ?? [];
  return [...new Set(raw.map((m) => m.slice(5, -1)))];
}

/** `@zenith/schema/attr` → `{ pkg: 'schema', sub: 'attr' }`. */
function splitSpecifier(spec) {
  const [, pkg, ...rest] = spec.split('/');
  return { pkg, sub: rest.join('/') };
}

describe('#120 — e2e fixtures resolve every transitive @zenith import', () => {
  const built = isFullyBuilt(ROOT);

  it.skipIf(!built)('every e2e fixture importmap covers its transitive closure', () => {
    const fixtures = readdirSync(E2E).filter(
      (f) => f.endsWith('.html') && statSync(join(E2E, f)).isFile(),
    );
    const problems = [];
    for (const fixture of fixtures) {
      const text = readFileSync(join(E2E, fixture), 'utf8');
      const match = /<script type="importmap">\s*(\{[\s\S]*?\})\s*<\/script>/.exec(text);
      if (!match) continue;
      const map = JSON.parse(match[1]);
      const imports = Object.keys(map.imports ?? {});
      const seen = new Set();
      const queue = imports.filter((s) => s.startsWith('@zenith/')).map(splitSpecifier);
      while (queue.length > 0) {
        const { pkg, sub } = queue.pop();
        const key = `${pkg}/${sub}`;
        if (seen.has(key)) continue;
        seen.add(key);
        // فقط باندل اصلی پکیج‌ها پیمایش می‌شود (زیرمسیرها در همان index هم آمده‌اند).
        for (const dep of distImports(pkg)) {
          if (!imports.includes(dep)) problems.push(`${fixture}: «${dep}» در importmap نیست`);
          queue.push(splitSpecifier(dep));
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('the events fixture maps the shared attribute helper used by error-boundary', () => {
    const text = readFileSync(join(E2E, 'events-fixture.html'), 'utf8');
    expect(text).toContain('"@zenith/schema/attr": "/packages/schema/dist/attr.js"');
  });
});
