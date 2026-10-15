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
