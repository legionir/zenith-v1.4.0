// scripts/lib/exports-shape.mjs
// #74 — the ONE definition of how a package's `exports` entries are shaped, shared by the
// standardizer, the scaffold, the build and the audits.
//
//   dual (ESM + CJS)  "." : { import: { types: ./dist/x.d.ts,  default: ./dist/x.js  },
//                             require: { types: ./dist/x.d.cts, default: ./dist/x.cjs } }
//     — separate declaration files per format, otherwise `require` consumers get ESM-flavoured
//       types ("Masquerading as ESM", arethetypeswrong FalseESM).
//   ESM-only          "." : { types: ./dist/x.d.ts, import: ./dist/x.js, default: ./dist/x.js }
//     — `default` lets Node's `require(esm)` (>=20.19 / >=22.12) load it, which is what the CJS
//       builds of the dual packages do for their ESM-only workspace dependencies (DEC-034).

/** Build the entry object for `./dist/<name>` in the given format. */
export function entryFor(name, { dual }) {
  const base = `./dist/${name}`;
  if (dual) {
    return {
      import: { types: `${base}.d.ts`, default: `${base}.js` },
      require: { types: `${base}.d.cts`, default: `${base}.cjs` },
    };
  }
  return { types: `${base}.d.ts`, import: `${base}.js`, default: `${base}.js` };
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Resolve a condition to its file for either the flat or the nested shape. */
export function conditionTarget(entry, condition) {
  if (typeof entry === 'string') return condition === 'types' ? undefined : entry;
  if (!isObj(entry)) return undefined;
  if (condition === 'types') {
    const t = entry.types ?? entry.import?.types ?? entry.default?.types;
    return typeof t === 'string' ? t : undefined;
  }
  const v = entry[condition];
  if (typeof v === 'string') return v;
  if (isObj(v)) return typeof v.default === 'string' ? v.default : undefined;
  return undefined;
}

/** True when the entry ships a CommonJS build. */
export function isDualEntry(entry) {
  return isObj(entry) && entry.require !== undefined;
}

/** `./dist/foo/bar.js` → `foo/bar` (null when the target is not under ./dist/). */
export function distName(target) {
  const m = /^\.\/dist\/(.+?)\.(?:d\.)?c?m?[jt]s$/.exec(target ?? '');
  return m ? m[1] : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Subpath entry points (#142, #120, DEC-036 §پیوست الف)
//
// The 11 public subpaths of the workspace used to be hand-written JSON in three
// package.json files — a shape that could silently drift from what the build,
// the audits and the tests assume. They now come from ONE table, exactly like
// `entryFor` does for the `.` entry: `scripts/test/exports-shape.test.mjs`
// fails CI when a package declares a subpath this table does not know about,
// when a tabled source file is missing, or when a declared entry drifts from
// the generated shape.
//
// Size-isolation subpaths are ESM-only; explicit dual Node/worker entries below
// preserve separate import/require declarations. They exist to keep
// the *main* entry inside its size budget (e.g. `@zenith/schema/attr` keeps
// `@zenith/schema` itself under the frozen 4 KB of #142), and the packages that
// own subpaths are ESM-only by DEC-027.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * پکیج → زیرمسیرهای عمومی (`src/<name>.ts` ⇒ `exports["./<name>"]`).
 * ترتیب کلیدها همان ترتیبی است که در package.json نوشته می‌شود.
 */
export const PUBLIC_SUBPATHS = {
  '@zenith/errors': ['internal'],
  '@zenith/state': ['internal'],
  '@zenith/router': ['node'],
  '@zenith/service-worker': ['sw', 'strategies'],
  '@zenith/ssr': ['edge'],
  '@zenith/ui': ['position', 'dialog', 'popover', 'tooltip', 'tabs', 'menu', 'accordion', 'combobox', 'date-picker', 'portal'],
  '@zenith/mock': ['worker'],
  '@zenith/schema': ['zod', 'json-schema', 'attr'],
  '@zenith/storage': ['signal'],
  '@zenith/realtime': ['testing', 'legacy'],
  '@zenith/analytics': ['legacy'],
  '@zenith/testing-e2e': ['browser'],
  zenith: ['core', 'ssr', 'testing', 'presets/minimal', 'presets/spa', 'presets/full', 'browser'],
};

/** `presets/minimal` → `./presets/minimal`. */
export function subpathKey(name) {
  return `./${name}`;
}

/** `./presets/minimal` → `presets/minimal` (null when the key is not a subpath). */
export function subpathName(key) {
  if (typeof key !== 'string' || !key.startsWith('./')) return null;
  const name = key.slice(2);
  if (name === '' || name === 'package.json') return null;
  return name;
}

/** نام‌های زیرمسیر یک پکیج (کپی؛ هرگز به جدول بیرون دست نده). */
export function subpathNames(pkgName) {
  return [...(PUBLIC_SUBPATHS[pkgName] ?? [])];
}

/** شیء `exports` برای زیرمسیرها — با همین تابع، build و audits هم تغذیه می‌شوند. */
export function subpathExports(pkgName) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const name of subpathNames(pkgName)) {
    out[subpathKey(name)] = entryFor(name, { dual: ['@zenith/errors', '@zenith/state', '@zenith/router', '@zenith/service-worker'].includes(pkgName) });
  }
  return out;
}

/**
 * `exports` کامل یک پکیج: `.` (شکل موجود)، سپس زیرمسیرهای جدول، سپس
 * `./package.json`. زیرمسیرهای خارج از جدول حذف می‌شوند تا «منبع یکتا» واقعاً
 * یکتا بماند — تست exports-shape همان لحظه قرمز می‌شود.
 */
export function exportsFor(pkgName, dotEntry) {
  return {
    '.': dotEntry,
    ...subpathExports(pkgName),
    './package.json': './package.json',
  };
}

/** همهٔ زیرمسیرهای اعلام‌شده در ورک‌اسپیس (package.json واقعی) → نام پکیج. */
export function declaredSubpaths(pkgJson) {
  return Object.keys(pkgJson?.exports ?? {})
    .map((key) => subpathName(key))
    .filter((name) => name !== null);
}
