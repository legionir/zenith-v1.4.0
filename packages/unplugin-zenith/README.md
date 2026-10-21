# `@zenith/unplugin-zenith`

> Unified Zenith build plugin: one compile/options core for
> Vite, Rollup, Webpack, esbuild and Rspack, built on [`unplugin`](https://unplugin.unjs.io). [#164]

`@zenith/vite-plugin` is a thin wrapper over `@zenith/unplugin-zenith/vite`
with identical options and output.

## Installation

```bash
npm install @zenith/unplugin-zenith unplugin
```

## Usage

```ts
// vite.config.ts
import { zenithVite } from '@zenith/unplugin-zenith/vite';

// rollup.config.mjs
import { zenithRollup } from '@zenith/unplugin-zenith/rollup';

// webpack.config.mjs
import { zenithWebpack } from '@zenith/unplugin-zenith/webpack';

// esbuild
import { zenithEsbuild } from '@zenith/unplugin-zenith/esbuild';

// rspack.config.mjs
import { zenithRspack } from '@zenith/unplugin-zenith/rspack';
```

Each adapter accepts the same `ZenithUnpluginOptions` (resolved by
`resolveUnpluginOptions`, defaults in `UNPLUGIN_OPTIONS_DEFAULTS`).

## Options (`DEFAULTS`)

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `include` | `string[]` | `['**/*.html']` | Globs compiled by the shared transform. |
| `exclude` | `string[]` | `['node_modules/**']` | Globs never compiled. |
| `strict` | `boolean` | `false` | Turn compile warnings into errors. |
| `compile` | `CompileOptions` | (nested defaults) | Nested compile options (kept for `vite-plugin` parity). |
| `meta` | `boolean \| { file }` | `false` | Emit a per-build JSON manifest of compiled modules. |
| `watchPatterns` | `string[]` | `[]` | Vite dev HMR watch globs (Vite only). |
| `autoInjectDevtools` | `boolean` | `true` | Vite dev DevTools injection (Vite only). |
| `enableHtmlHMR` | `boolean` | `true` | Vite dev HTML HMR (Vite only). |

Vite-only options on other bundlers throw `ZEN-2520`/`ZEN-2521`
(`createReservedError`): dev HMR and DevTools injection exist only on Vite.
