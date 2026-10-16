// scripts/test/attribute-coverage.test.mjs
// #120 — گرامر نهایی attribute: جدول کامل، seed کامل و ممنوعیت JSON.parse روی attribute.
import { describe, it, expect } from 'vitest';
import {
  readFileSync,
  readdirSync,
  statSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  auditAttributeJsonParsing,
  auditDirectiveCoverage,
  extractAttributeSurface,
  extractRegisteredDirectives,
  extractTabledNames,
} from '../attribute-grammar.mjs';

const ROOT = process.cwd();

/** همهٔ فایل‌های src پکیج‌ها به‌صورت {path, text}. */
function srcFiles() {
  const out = [];
  for (const pkg of readdirSync(join(ROOT, 'packages'))) {
    const dir = join(ROOT, 'packages', pkg, 'src');
    let entries;
    try {
      if (!statSync(dir).isDirectory()) continue;
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.endsWith('.ts') || entry.endsWith('.d.ts')) continue;
      out.push({
        path: `packages/${pkg}/src/${entry}`,
        text: readFileSync(join(dir, entry), 'utf8'),
      });
    }
  }
  return out;
}

const doc = readFileSync(join(ROOT, 'docs/ATTRIBUTE-GRAMMAR.md'), 'utf8');
const seed = JSON.parse(readFileSync(join(ROOT, 'docs/meta/zenith.meta.seed.json'), 'utf8'));
const surface = extractAttributeSurface(
  readFileSync(join(ROOT, 'packages/runtime/src/attributes.ts'), 'utf8'),
);

describe('#120 — attribute grammar: full coverage + one shared parse path', () => {
  it('extracts the real attribute surface from ZenithAttributes', () => {
    expect(surface.length).toBeGreaterThanOrEqual(30);
    expect(surface).toContain('zen-if');
    expect(surface).toContain('zen-bind'); // zen-bind:class → zen-bind
    expect(surface.every((n) => n.startsWith('zen-'))).toBe(true);
  });

  it('every attribute in the code surface has a §۴ row and a metadata seed entry', () => {
    const errors = auditDirectiveCoverage(doc, surface, [], seed);
    expect(errors).toEqual([]);
    const tabled = extractTabledNames(doc);
    for (const name of surface) {
      if (name === 'zen-state') continue;
      expect(tabled.has(name)).toBe(true);
      expect(seed.directives.some((d) => d.name === name)).toBe(true);
    }
  });

  it('every directive registered in code (defineDirective / handler registry) is documented', () => {
    const registered = extractRegisteredDirectives(srcFiles());
    expect(registered.length).toBeGreaterThanOrEqual(10);
    expect(registered.map((d) => d.name)).toContain('zen-for');
    // fragment snippetهای افزونهٔ VS Code دایرکتیو واقعی شمرده نمی‌شوند.
    expect(registered.map((d) => d.name)).not.toContain('prop:*');
    expect(auditDirectiveCoverage(doc, [], registered, seed)).toEqual([]);
  });

  it('has no direct JSON.parse of an attribute value anywhere in src', () => {
    const violations = auditAttributeJsonParsing(srcFiles());
    expect(violations).toEqual([]);
  });

  it('flags an attribute-driven JSON.parse (negative probe for the gate)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'attr-json-'));
    try {
      mkdirSync(join(dir, 'packages', 'demo', 'src'), { recursive: true });
      const bad = [
        'export function readCfg(el: HTMLElement): unknown {',
        "  const attr = el.getAttribute('zen-demo-options');",
        '  return attr ? JSON.parse(attr) : {};',
        '}',
        '',
        'export function readOther(el: HTMLElement): unknown {',
        "  const piece = el.getAttribute('data-x'); // attribute-json-allowlist: داده‌ی غیر-Zenith",
        '  return piece ? JSON.parse(piece) : null;',
        '}',
      ].join('\n');
      writeFileSync(join(dir, 'packages/demo/src/demo.ts'), bad);
      const violations = auditAttributeJsonParsing([
        { path: 'packages/demo/src/demo.ts', text: bad },
      ]);
      expect(violations).toHaveLength(1);
      expect(violations[0].line).toBe(3);

      // خط کامنت کد نیست.
      expect(
        auditAttributeJsonParsing([
          { path: 'packages/demo/src/notes.ts', text: '// JSON.parse روی attribute ممنوع\n' },
        ]),
      ).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('keeps the doc, the seed snapshot and the VS Code data file in sync', () => {
    const meta = JSON.parse(readFileSync(join(ROOT, 'docs/meta/zenith.meta.json'), 'utf8'));
    expect(meta.directives.length).toBe(seed.directives.length);
    const custom = JSON.parse(readFileSync(join(ROOT, 'docs/meta/html.customData.json'), 'utf8'));
    for (const name of surface) {
      if (name === 'zen-state') continue;
      expect(
        custom.globalAttributes?.[name] ??
          custom.attributes?.[name] ??
          Object.keys(custom).includes(name),
      ).toBeTruthy();
    }
  });

  it('documents the canonical attribute grammar (§۰.۳) with the zen-<name> family', () => {
    for (const token of ['zen-<name>', 'zen-<name>-<option>', 'zen-<name>-options', 'zen-state']) {
      expect(doc).toContain(token);
    }
    expect(doc).toMatch(/#120/);
  });
});
