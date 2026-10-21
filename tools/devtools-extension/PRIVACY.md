# Privacy Policy — Zenith DevTools (Chrome / Firefox)

> Version 1.4.0 · This policy ships inside the installable package
> (`PRIVACY.md`) and must stay identical to the extension's real behavior
> (#97). Any new permission, host access, or data flow requires a policy
> update in the same change (gate: `scripts/test/extension-store.test.mjs`).

## Short version

**Zenith DevTools collects nothing, transmits nothing, and stores nothing
outside your browser.** All inspection happens locally, in memory, on pages
you explicitly open the tool on. There is no account, no analytics, no
remote server, and no third-party code.

## Data practices

- **No collection:** the extension never reads browsing history, keystrokes,
  passwords, or page content beyond the Zenith debug hook
  (`window.__ZENITH__`) it renders for you.
- **No transmission:** the extension makes zero network requests. There is
  no `fetch`/`WebSocket` in the codebase and no remote `<script>`/`<link>`
  (build gate rejects remote executable/style assets).
- **No persistent storage:** no `chrome.storage`, no cookies, no
  IndexedDB. State lives in memory and disappears when the panel closes.
- **Notifications are local:** `chrome.notifications.create` renders
  on-device alerts about framework state changes (e.g. cache stats);
  notification text never leaves the machine.
- **Content Security Policy:** extension pages run under
  `default-src 'self'; script-src 'self'; style-src 'self'` — no inline
  code, no remote code (see `README.md` § امنیت).

## Permissions (why each one exists)

| Permission | Where it is used | Why it is needed |
|---|---|---|
| `activeTab` | `popup.js` (`chrome.tabs.query` + `sendMessage` to the active tab) | Inspect the tab you opened DevTools on — nothing else. |
| `scripting` | reading the page's `window.__ZENITH__` debug hook via `chrome.scripting.executeScript` | Reach the framework's in-page debug data; never page DOM scraping. |
| `notifications` | `background.js` (`chrome.notifications.create`, no `iconUrl`) | Local state-change alerts; no content leaves the device. |
| `optional_host_permissions` (`http://*/*`, `https://*/*`) | granted only after your explicit opt-in | Deep inspection of non-active tabs, only when you allow it. |

The manifest declares **no** `host_permissions` (so no silent global
access) and the Firefox build declares `data_collection_permissions:
{ required: ['none'] }`.

## Contact & store pages

- Source & changelog: the Zenith repository (`tools/devtools-extension/`).
- Security reports: see `SECURITY.md` (never file a public issue).
- Store listings (Chrome Web Store / AMO) link to this exact file; the
  published description must not promise anything this policy does not say
  (owner step on every release, #97).
