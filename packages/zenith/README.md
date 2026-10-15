# zenith

Single-entry umbrella package for the Zenith framework (`L5` — SPEC §2.9, `#149`).

## Entry Points

- `zenith`: `createApp`, `createZenith`, `assertCompatible`, `defineDirective`, `definePlugin`, `signal`, `computed`, `effect`, `batch`, `watch`, plus single-source namespaces (`http`, `router`, `store`, `form`, `i18n`, `resource`, `auth`, `cache`, `storage`, `schema`, `logger`, `jalali`, `notifications`, `errorBoundary`, `events`, `security`, `actions`, `components`, `suspense`, `transition`).
- `zenith/core`: `@zenith/runtime-core` + `@zenith/state` + `watch`.
- `zenith/ssr`: `@zenith/ssr`.
- `zenith/testing`: `@zenith/testing`.
- `zenith/presets/minimal`: core + `events` + `security`.
- `zenith/presets/spa`: `minimal` + `router`, `http`, `resource`, `store`, `form`, `error-boundary`, `notifications`, `i18n`.
- `zenith/presets/full`: `spa` + all L2 capabilities (`auth`, `cache`, `storage`, `jalali`, `components`, `suspense`, `transition`, `actions`).
- `zenith/browser`: browser bundle exposing `window.Zenith` (`dist/browser.global.js` with `.map` and `.sri`).

## License

MIT
