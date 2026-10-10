#!/usr/bin/env node
// #142 — تولید اسنپ‌شات zenith.meta.json + html.customData.json (SPEC §۲.۲
// «ابزار تولید zenith.meta.json در CI با snapshot»).
//
// منبع: docs/meta/zenith.meta.seed.json — فهرست DirectiveMeta که hand-maintained
// است و در #52/#148/#173 (اعمال schema به directiveهای واقعی) از راه
// defineDirectiveMeta پر می‌شود. صحت منطق manifest/customData با همان API در
// packages/schema/test/manifest.test.ts تضمین شده است؛ اینجا فقط serialize می‌کنیم.
//
// --check: اگر محتوای فعلی با تولید مجدد فرق داشت exit 1 (گیت تازگی در CI؛
// الگوی scripts/sync-license.mjs --check).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'docs', 'meta');
const SEED = join(OUT_DIR, 'zenith.meta.seed.json');
const META_OUT = join(OUT_DIR, 'zenith.meta.json');
const CUSTOM_OUT = join(OUT_DIR, 'html.customData.json');

const seed = existsSync(SEED) ? JSON.parse(readFileSync(SEED, 'utf8')) : { directives: [] };
const directives = [...(seed.directives ?? [])].sort((a, b) =>
  a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
);

const manifest = {
  $schema: './zenith.meta.schema.json',
  version: 1,
  generatedFrom: 'defineDirectiveMeta registry',
  directives,
};

// فرمت VS Code html.customData — همان خروجی toHtmlCustomData (تست‌شده).
const globalAttributes = {};
for (const m of directives) {
  const parts = [`\`${m.name}\``];
  if (m.syntax) parts.push('', '```html', m.syntax, '```');
  parts.push('', m.description);
  if (m.values?.length) parts.push('', `مقدارها: ${m.values.map((v) => `\`${v}\``).join(' | ')}`);
  if (m.attributes?.length)
    parts.push('', `sub-attributes: ${m.attributes.map((v) => `\`${v}\``).join(', ')}`);
  const entry = { description: { kind: 'markdown', value: parts.join('\n') } };
  if (m.docs) entry.references = [{ name: 'Zenith docs', url: m.docs }];
  globalAttributes[m.name] = entry;
}
const custom = { version: 1, tags: [], globalAttributes };

const serializedMeta = JSON.stringify(manifest, null, 2) + '\n';
const serializedCustom = JSON.stringify(custom, null, 2) + '\n';

if (process.argv.includes('--check')) {
  const curMeta = existsSync(META_OUT) ? readFileSync(META_OUT, 'utf8') : '';
  const curCustom = existsSync(CUSTOM_OUT) ? readFileSync(CUSTOM_OUT, 'utf8') : '';
  if (curMeta !== serializedMeta || curCustom !== serializedCustom) {
    console.error('meta snapshot out of date (run: node scripts/gen-zenith-meta.mjs)');
    process.exit(1);
  }
  console.log('meta snapshot is fresh.');
} else {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(META_OUT, serializedMeta);
  writeFileSync(CUSTOM_OUT, serializedCustom);
  console.log(`wrote ${META_OUT} and ${CUSTOM_OUT} (${directives.length} directives).`);
}
