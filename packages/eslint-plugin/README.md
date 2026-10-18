# @zenith/eslint-plugin

ESLint flat configs for Zenith API, lifecycle, diagnostic, security and HTML
contracts. Code and regression fixtures are written; validation is pending.

```js
import zenith from '@zenith/eslint-plugin';
export default [...zenith.configs.recommended];
```

Public signatures with more than two parameters are checked independently,
including TypeScript overloads and arrow/function-expression exports. Adding an
`options` parameter does not exempt other positional configuration. Deprecated
legacy overloads are exempt, while an implementation signature is ignored only
when the actual public overloads have each been checked.

The root workspace imports this exact rule source (no generated dist or Node
TypeScript stripping required). Its existing named legacy debt is still explicit.
`createOptionsObjectRule` additionally accepts exact parameter-bound allowlist
entries so a new overload/type change cannot borrow an unrelated legacy exemption.
The standalone rule defaults to checking consumer files outside this monorepo.

Five-plus valid/invalid RuleTester fixtures and signature-bound exemption tests
are written, not run. HTML/template processors and code rules are described below; their validation is pending.
No issue or acceptance gate is marked complete before final validation.

## Code-first continuation (not executed)

The package now exports `recommended` (diagnostics/deprecations), `library`
(public contracts), `template` and `strict` (library plus templates). TypeScript
consumers supply their TypeScript parser. HTML is parsed with parse5, expressions
with the Zenith parser/validator, never JavaScript evaluation. The HTML processor
maps escaped virtual-source diagnostics back to original line/column positions;
it does not offer unsafe fixes. HTML-like template literals are checked too.

Custom directives are added with `settings.zenith.directives`. JSON configuration
key whitelists use `settings.zenith.options[attributeName]`; `zen-props` keys cannot
be inferred without the consuming component's metadata. The schema directive
registry supplies additional directive names and attributes. Dynamic JS template
holes are not executed. Static analysis is not a replacement for axe/APG browser
checks or type-checking the returned Disposable contract.

`dispose-required` catches visibly non-disposable object returns from public
createX factories; spread/call/declared-return contracts remain the type checker's
responsibility. `no-module-state` and `tsdoc-default` are advisory; strict does not
pretend to perform whole-program ownership or imported type resolution.

### Contract examples

| Rule | Reject | Prefer |
| --- | --- | --- |
| no-console | `console.warn(message)` | `logger.warn(message)` |
| no-plain-error | `throw new Error(message)` | `throw developerError(message)` |
| no-destroy-alias | public `destroy()` | public `dispose()` |
| options-object | `createX(host, width, height)` | `createX(host, { width, height })` |
| dispose-required | `createX() { return {} }` | `createX() { return { dispose() {} } }` |
| no-module-state | module `let active` / `new Map()` | factory/App-owned state |
| no-math-random-security | `const token = Math.random()` | `secureId()` |
| no-deprecated-api | `clearStores()` | owner `dispose()` / test `resetForTesting()` |
| no-global-name-collision | `export const window = ...` | `export const ownerWindow = ...` |
| tsdoc-default | undocumented optional config field | `/** @defaultValue false */ enabled?: boolean` |
| template/valid-directive | `zen-for="bad syntax"` | `zen-for="item in items"` |
| template/no-unknown-directive | `zen-txet` | `zen-text` |
| template/no-unknown-option | malformed JSON or unlisted configured option | JSON matching the consumer's option metadata |
| template/require-key-in-for | unkeyed `zen-for` | `zen-key="item.id"` |
| template/no-structural-conflict | `zen-if` and `zen-for` on one element | separate nested elements |
| template/valid-expression | `zen-text="a +"` | `zen-text="a + b"` |
| template/no-forbidden-identifier | `zen-text="globalThis"` | explicit state identifier |
| template/a11y/button-name | empty button | text/ARIA accessible name |
| template/a11y/img-alt | image without alt | meaningful alt or `alt=""` |
| template/a11y/form-label | input with only placeholder | associated label/ARIA name |
| template/a11y/no-positive-tabindex | `tabindex="3"` | natural order/0/-1 |
| template/a11y/dialog-label | unnamed dialog | `aria-label` / `aria-labelledby` |

`ruleContracts` exports the section mapping. Advisory diagnostics are not ownership
proofs. Remaining whole-program type resolution, imported factory contracts and
runtime-only/dynamic template structure must be reviewed with the final gates.
