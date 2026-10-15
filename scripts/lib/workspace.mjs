// scripts/lib/workspace.mjs — small workspace helpers shared by scripts and their tests.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * True when EVERY package that has a `src/index.ts` also has `dist/index.js`.
 * Real-workspace gates (attw, d.ts parity) are only meaningful on a complete build; a partial
 * `dist/` (e.g. the few packages the scaffold test builds on its own) must skip, not fail.
 */
export function isFullyBuilt(root) {
  const dir = join(root, 'packages');
  for (const name of readdirSync(dir)) {
    if (name.startsWith('tmp-')) continue;
    if (!existsSync(join(dir, name, 'src', 'index.ts'))) continue;
    if (!existsSync(join(dir, name, 'dist', 'index.js'))) return false;
  }
  return true;
}
