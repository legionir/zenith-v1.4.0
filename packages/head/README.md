# @zenith/head

Explicit per-App/per-request head ownership, reactive entries and safe SSR output.
ESM L2; no dependency on runtime or Node/ALS. Do not share managers across requests.

```ts
import { createHead, useHead, renderHead } from '@zenith/head';
const head = createHead({ titleTemplate: '%s | Shop', nonce: responseNonce });
const entry = useHead(() => ({ title: titleSignal, meta: [
  { name: 'description', content: descriptionSignal.get() }
] }), { head });
const { headTags, htmlAttrs, bodyAttrs } = renderHead(head);
entry.patch({ title: 'Checkout' });
entry.dispose();
head.dispose();
```

Pass `document` for client reconciliation. Stable `data-zen-head` markers reuse
hydrated nodes, entries dedupe last-wins, and disposing an entry restores earlier
entries. Manager disposal removes its nodes and restores root attributes.
`headPlugin()` provides `zenith:head` and reactive title/description/canonical/OG
bindings. A factory App used by SSR is request-owned and disposed after serialization.

Only JSON-LD scripts are permitted; executable script types are rejected, not
silently trusted. Supply `json`, or valid JSON via `innerHTML`, never JavaScript.
Titles/attributes are escaped, event attributes omitted, dangerous URL schemes
rejected, and JSON closing tags/Unicode separators escaped. `maxTags` defaults to
100. Use the response's nonce for JSON-LD; never a hardcoded nonce.

Migration: old SSR `createHead()` no longer changes a process-global active head.
Use `manager.push()`, `useHead(input, { head })` here, or the isolated-request legacy
SSR `useHead(input, manager?)` facade. `titleFromRoute` needs no router singleton.
Tests and package scaffolding are written; final execution/security/browser gates
and package budget measurement remain pending.

## Managed DOM and authored content (candidate contract)

Managers sharing a document coordinate ownership. Later-created managers win a
shared key while active; releasing one reveals the other manager's value.
Existing SSR-marked nodes and singleton title/base nodes may be borrowed. Final
release restores their original attributes and text-node identities instead of
deleting them. New owned nodes are removed, and nodes moved elsewhere externally
are not reclaimed. Each entry and manager has an idempotent disposal boundary.

`titleTemplate` accepts a `%s` string or `(title: string) => string`. `dedupe`
accepts a boolean or a readonly list of `title`, `meta`, `link` and `script` rules;
`false` disables charset deduplication too. Options are schema-validated in
production, and the returned options and selective rule array are frozen.

Install `app.use(headPlugin())` for reactive `zen-head-title`, `zen-head-description`,
`zen-head-canonical` and `zen-head-og-image`. Literal authored content uses the custom
`<zen-head>` element or an empty `zen-head` attribute:

```html
<zen-head>
  <title>Account</title>
  <meta name="description" content="Manage your account">
  <link rel="canonical" href="https://example.com/account">
  <script type="application/ld+json">{"@type":"WebPage","name":"Account"}</script>
</zen-head>
<div zen-head-title="$pageTitle"></div>
```

The plugin **projects** supported title/meta/link/base/JSON-LD content into the
manager, holding the original child nodes for restoration on release; it does not
promise those same node identities in `document.head`. `zen-head-key` is the
companion key. Nonempty `zen-head` expressions are rejected. Authored content is
literal rather than a nested directive subtree, requiring the runtime's
`skipChildren` binder capability. Executable scripts, event-handler attributes
and unsafe link protocols are rejected. JSON-LD serialization escapes markup and
uses the manager nonce; an empty `allowScript` denies JSON-LD too.

SSR Apps expose their manager as `zenith:head`; the SSR renderer captures it before
App cleanup. Router installation can receive `head`, explicit `routes`, and a
`titleTemplate`, then announces the resolved title through the shared a11y owner.

Unit/type, browser and overlapping SSR fixtures have been authored but **not run**.
The ≤3 KB budget, generated API/metadata snapshots, and compatibility decisions
for these additions remain pending. Cleanup-failure/reentrancy fixtures are not
proof of execution success.
