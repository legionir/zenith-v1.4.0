#!/usr/bin/env node
/**
 * #50 — بررسی یکتا بودن نام نوع‌های عمومی (Type/Interface) در سطح پکیج‌های مخزن.
 * هیچ دو پکیجی نباید یک نام نوع غیر-deprecated یکسان با معنای متفاوت صادر کنند.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

export function auditUniqueTypeNames(rootDir = process.cwd()) {
  const pkgsDir = join(rootDir, 'packages');
  const dirs = readdirSync(pkgsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== 'zenith' && d.name !== 'devtools-extension')
    .map((d) => d.name)
    .sort();

  /** @type {Map<string, Array<{ pkg: string, deprecated: boolean, file: string }>>} */
  const exportedTypes = new Map();

  for (const pkg of dirs) {
    const srcDir = join(pkgsDir, pkg, 'src');
    if (!existsSync(srcDir)) continue;
    const files = readdirSync(srcDir)
      .filter((f) => f.endsWith('.ts'))
      .map((f) => join(srcDir, f));

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      const regex = /(\/\*\*[\s\S]*?\*\/\s*)?export\s+(?:interface|type)\s+([A-Za-z0-9_]+)\b/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        const jsdoc = match[1] || '';
        const typeName = match[2];
        const deprecated = /@deprecated\b/.test(jsdoc);
        if (!exportedTypes.has(typeName)) {
          exportedTypes.set(typeName, []);
        }
        const list = exportedTypes.get(typeName);
        if (!list.some((item) => item.pkg === pkg)) {
          list.push({ pkg, deprecated, file: resolve(file) });
        }
      }
    }
  }

  // Known intentional shared protocol/re-exported types across layers:
  const ALLOWED_SHARED_TYPES = new Set([
    'Cleanup',
    'Disposable',
    'Readable',
    'MaybeSignal',
    'ReadonlySignal',
    'Signal',
    'Computed',
    'ZenithError',
    'ErrorCode',
    'ErrorCategory',
    'ErrorHandler',
    'DirectiveMeta',
    'Schema',
    'HydrationResult',
    'HydrationMismatch',
  ]);

  const conflicts = [];
  for (const [typeName, entries] of exportedTypes.entries()) {
    if (ALLOWED_SHARED_TYPES.has(typeName)) continue;
    const activeEntries = entries.filter((e) => !e.deprecated);
    if (activeEntries.length > 1) {
      conflicts.push({
        typeName,
        packages: activeEntries.map((e) => e.pkg),
      });
    }
  }

  return { conflicts, totalTypes: exportedTypes.size };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { conflicts, totalTypes } = auditUniqueTypeNames();
  if (conflicts.length > 0) {
    console.error('❌ Duplicate non-deprecated public type names found (#50):');
    for (const c of conflicts) {
      console.error(`  - ${c.typeName}: ${c.packages.join(', ')}`);
    }
    process.exit(1);
  }
  console.log(`✅ unique-type-names (#50): ${totalTypes} exported types checked, 0 conflicts.`);
}
