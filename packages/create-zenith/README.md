# `create-zenith`

> Standalone project scaffolder for the Zenith framework. [#158] Uses
> [`@zenith/templates`](../templates/README.md) as its engine — the same engine
> behind `zenith create`.

```bash
npx @zenith/create-zenith my-app --template ssr
cd my-app
npm run dev
```

## Usage

```bash
create-zenith <name> [options]
```

| Option | Description |
| --- | --- |
| `-t, --template <kind>` | `spa` (default) \| `ssr` \| `pwa` \| `dashboard` \| `minimal` |
| `--pwa` | Alias for `--template pwa` (conflicts with any other `--template`). |
| `--pm <npm\|pnpm\|yarn\|bun>` | Package manager for `--install` (default: auto-detect). |
| `--install` / `--no-install` | Run `<pm> install` after scaffolding (default: install). |
| `--git` / `--no-git` | Run `git init` after scaffolding (default: init). |
| `--force` | Write into an existing non-empty directory (overwrite). |
| `--dry-run` | Print the plan; write, install and init nothing. |
| `--yes` | Accept all defaults (reserved for future prompts). |
| `--json` | Print the machine-readable result to stdout. |
| `--ts` | TypeScript templates (the only variant today). |
| `-V, --version` | Print the version. `-h, --help` prints usage. |

Exit codes: `0` success · `1` usage/validation error · `2` operational failure
(files already written are kept and reported). Errors go to stderr; `--json`
output and next-step hints go to stdout.

`--dry-run` performs zero writes, zero installs and zero git operations.
Installs run through `execFile` with an argv array — never a shell string.
