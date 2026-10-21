# `@zenith/templates`

> Data-driven project templates (`spa`/`ssr`/`pwa`/`dashboard`/`minimal`) and the scaffold engine behind `zenith create` and `create-zenith`. [#158]

Template content lives in **real files** under `templates/` — `templates/shared/` (base) plus one optional overlay directory per kind — never nested escaped literals. The single exception is `.gitignore`, kept as a tiny code constant because dotfiles cannot live under `src/`.

## Installation

```bash
npm install @zenith/templates
```

## Usage

```ts
import { getTemplateManifest, scaffoldProject, TEMPLATE_KINDS } from '@zenith/templates';

// In-memory manifest (relative path → content):
const files = getTemplateManifest('my-app', 'spa');

// Write a project (dry-run writes nothing):
const result = scaffoldProject({ name: 'my-app', kind: 'ssr', dryRun: true });
console.log(result.destination, Object.keys(result.files));
```

## Options (`DEFAULTS`)

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `kind` | `'spa' \| 'ssr' \| 'pwa' \| 'dashboard' \| 'minimal'` | `'spa'` | Template kind. |
| `force` | `boolean` | `false` | Write into an existing non-empty directory (overwrite). |
| `dryRun` | `boolean` | `false` | Compute the manifest without writing anything. |
| `cwd` | `string` | `process.cwd()` | Reference directory the project is created inside. |

Project names follow `validateProjectName` (same rules as `zenith create`): ASCII
letters/digits plus `-_.`, no path separators, no absolute paths, no Windows
device names, containment inside `cwd` verified after resolve.
