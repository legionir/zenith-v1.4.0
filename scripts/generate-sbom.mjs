#!/usr/bin/env node
// scripts/generate-sbom.mjs
//
// #78 (SEC): تولید SBOM با قالب CycloneDX 1.5 از package-lock.json.
// خروجی: فایل JSON استاندارد (پیش‌فرض sbom.json) که در انتشار به‌عنوان
// artifact ضمیمه می‌شود و امکان ردگیری دقیق وابستگی‌ها را می‌دهد.
//
// استفاده:
//   node scripts/generate-sbom.mjs [output.json]

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] ?? join(root, 'sbom.json');

const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
const rootPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

/** node_modules/a/b/path → نام پکیج (scope-aware). */
function nameFromPath(p) {
  const parts = p.split('/').filter(Boolean);
  if (parts[0] !== 'node_modules') return null;
  if (parts[1]?.startsWith('@')) return `${parts[1]}/${parts[2] ?? ''}`.replace(/\/$/, '');
  return parts[1] ?? null;
}

const components = [];
const seen = new Set();
for (const [pathKey, meta] of Object.entries(lock.packages ?? {})) {
  if (pathKey === '') continue; // ریشه
  const name = nameFromPath(pathKey);
  if (!name || seen.has(name)) continue;
  seen.add(name);
  const isWorkspace = meta.resolved === undefined && meta.link === true;
  if (isWorkspace) continue; // پکیج‌های داخلی monorepo SBOM شخصی‌سازی نمی‌شوند (بخشی از خود محصول‌اند)
  const version = meta.version ?? 'unknown';
  components.push({
    type: 'library',
    'bom-ref': `pkg:npm/${encodeURIComponent(name).replace('%40', '@')}@${version}`,
    name,
    version,
    scope: meta.dev === true ? 'excluded' : 'required',
    purl: `pkg:npm/${encodeURIComponent(name).replace('%40', '@')}@${version}`,
  });
}
components.sort((a, b) => a.name.localeCompare(b.name));

const sbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  serialNumber: `urn:uuid:${crypto.randomUUID()}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    tools: [{ vendor: 'zenith', name: 'scripts/generate-sbom.mjs', version: rootPkg.version }],
    component: {
      type: 'application',
      'bom-ref': `pkg:npm/${rootPkg.name ?? 'zenith'}@${rootPkg.version}`,
      name: rootPkg.name ?? 'zenith',
      version: rootPkg.version,
    },
  },
  components,
};

writeFileSync(out, JSON.stringify(sbom, null, 2) + '\n');
console.log(`✅ SBOM نوشته شد: ${out} (${components.length} وابستگی خارجی)`);
