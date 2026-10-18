#!/usr/bin/env node
/** Final built-package check; source inventory is not a substitute. */
import { declarationEntries } from './lib/declaration-api.mjs';
import { inspectPublishedCallables } from './lib/published-callables.mjs';
import { loadAllowlist } from './positional-config-audit.mjs';
import { pathToFileURL } from 'node:url';
export function auditPublishedPositionalConfig(root = process.cwd()) {
  return inspectPublishedCallables(declarationEntries(root), { root, allowlist: loadAllowlist(root), includeDirectories: [`${root}/packages`] });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = auditPublishedPositionalConfig();
  if (process.argv.includes('--json')) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else {
    for (const row of report.violations) process.stderr.write(`${row.entry}: ${row.exposedAs.join(', ')} (${row.params.join(', ')}) — ${row.file}:${row.line}\n`);
    process.stdout.write(`${report.signatures.length} published signatures; ${report.violations.length} positional configuration violations.\n`);
  }
  process.exitCode = report.violations.length ? 1 : 0;
}
