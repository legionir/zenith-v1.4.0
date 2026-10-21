# `@zenith/codemod`

> AST codemods for the Zenith 1.x → 2.0 migration: nine separately-runnable
> transforms with dry-run, check mode, and a JSON-serializable report. [#167]

Each transform runs on its own (`transformText` picks a subset); anything the
machine cannot prove safe becomes a `ManualItem` with a file, a line number,
and an action — never a silent rewrite.

## Usage

```ts
import { runCodemods, transformText } from '@zenith/codemod';

// Dry-run over a tree (writes nothing; checkFailed mirrors `--check` exit codes).
const report = runCodemods({ root: 'src', write: false });
if (report.checkFailed) {
  for (const item of report.manual) {
    console.log(`${item.file}:${item.line} [${item.transform}] ${item.message}`);
  }
}

// One file, one transform, in memory.
const out = transformText('app.ts', 'const x = 1;\n', ['form-unify']);
console.log(out.text);
```

## The nine transforms (SPEC §4.7)

| id | What it does |
|----|---|
| `destroy-to-dispose` | `.destroy()` ⇒ `.dispose()` on tracked Zenith owned instances (binding-aware; `cancel()` is intentionally out of scope) |
| `process-to-bind` | Manual-only: `processTrack` ⇒ `bindTrack` needs an `analytics` instance |
| `clear-to-reset` | Deprecated `clearX()` globals ⇒ `resetForTesting()` in test files; manual elsewhere |
| `form-unify` | `createReactiveForm/createAdvancedForm/createWizardForm` ⇒ `createForm` (same args) |
| `error-class` | `throw new Error(msg)` ⇒ `ZenithError` (reviewer picks a real `ZEN-xxxx` code) |
| `console-to-logger` | Single-arg `console.*` ⇒ `logger.*`; the rest is manual |
| `cache-unify` | `registerCache` ⇒ `registerDevtoolsCache`; hand-rolled caches are flagged for `createCache` |
| `i18n-jalali` | Jalali helpers move from `@zenith/i18n` to `@zenith/jalali` (behavioral notes stay manual) |
| `runtime-imports` | `@zenith/runtime` imports split into origin packages; runtime-owned names stay manual |

`throw new Error` maps `message` (and `{ cause }`) and injects the
`ZenithError` import; the emitted `code: ''` placeholder always comes with a
manual item. Single-argument `console.log/info` map to `logger.info`;
`warn`/`error`/`debug` keep their level.

## Report

`runCodemods` returns `{ files, manual, changedCount, checkFailed }` — the
same shape `zenith upgrade --report json` prints (#109 consumes this
package; the CLI flags themselves live there).
