// #142 — متادیتای directive و تولید فایل‌های ابزار (SPEC §۲.۲):
//   defineDirectiveMeta (اعتبار + freeze) و toDirectiveManifest که هم
//   `zenith.meta.json` (اسنپ‌شات CI) و هم `html.customData.json` (فرمت VS Code
//   data form) را از همان منبع واحد می‌سازد.

import { defineDefaults } from '@zenith/shared';
import { createReservedError } from '@zenith/errors';
import type { DirectiveMeta } from './types';

/** ثبت و اعتبارسنجی یک متادیتا؛ خروجی عمیقاً فریزشده است. */
export function defineDirectiveMeta(meta: DirectiveMeta): DirectiveMeta {
  if (!meta || typeof meta.name !== 'string' || !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(meta.name)) {
    throw createReservedError('ZEN-1001', {
      details: {
        path: 'name',
        expected: 'kebab-case directive name',
        received: String(meta?.name),
      },
    });
  }
  if (typeof meta.description !== 'string' || meta.description === '') {
    throw createReservedError('ZEN-1001', {
      details: {
        path: 'description',
        expected: 'non-empty string',
        received: typeof meta.description,
      },
    });
  }
  // کپی + فریز عمیق (از mutate شدن registry بیرونی جلوگیری می‌کند).
  const frozen = defineDefaults(structuredCloned(meta) as DirectiveMeta);
  // ثبت در رجیستری استاندارد — همان‌ها که `zenith.meta.json` را می‌سازند.
  registeredMetas.set(frozen.name, frozen);
  return frozen;
}

const registeredMetas = new Map<string, DirectiveMeta>();

/** کپی مرتب‌شدهٔ رجیستری ثبت‌شده (ورودی toDirectiveManifest در CI). */
export function getRegisteredDirectiveMetas(): DirectiveMeta[] {
  return [...registeredMetas.values()];
}

function structuredCloned<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** ساختار سند zenith.meta.json (نسخۀ ثابت — اسنپ‌شات CI). */
export interface ZenithMetaDoc {
  readonly $schema: './zenith.meta.schema.json';
  readonly version: 1;
  readonly generatedFrom: 'defineDirectiveMeta registry';
  readonly directives: readonly DirectiveMeta[];
}

export function toDirectiveManifest(metas: readonly DirectiveMeta[]): ZenithMetaDoc {
  const names = new Set<string>();
  for (const m of metas) {
    if (names.has(m.name)) {
      throw createReservedError('ZEN-1001', {
        details: { path: 'name', expected: 'unique directive name', received: m.name },
      });
    }
    names.add(m.name);
  }
  return {
    $schema: './zenith.meta.schema.json',
    version: 1,
    generatedFrom: 'defineDirectiveMeta registry',
    directives: [...metas]
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
      .map((m) => structuredCloned(m) as DirectiveMeta),
  };
}

/** تبدیل manifest به فرمت VS Code html.customData (tags همیشگی [] است). */
export interface HtmlCustomData {
  version: 1;
  tags: unknown[];
  globalAttributes: Record<
    string,
    {
      description: { kind: 'markdown'; value: string };
      references?: { name: string; url: string }[];
    }
  >;
}

export function toHtmlCustomData(metas: readonly DirectiveMeta[]): HtmlCustomData {
  const globalAttributes: HtmlCustomData['globalAttributes'] = {};
  for (const m of toDirectiveManifest(metas).directives) {
    const parts: string[] = [`\`${m.name}\``];
    if (m.syntax) parts.push('', '```html', m.syntax, '```');
    parts.push('', m.description);
    if (m.values?.length) parts.push('', `مقدارها: ${m.values.map((v) => `\`${v}\``).join(' | ')}`);
    if (m.attributes?.length)
      parts.push('', `sub-attributes: ${m.attributes.map((v) => `\`${v}\``).join(', ')}`);
    const entry: {
      description: { kind: 'markdown'; value: string };
      references?: { name: string; url: string }[];
    } = {
      description: { kind: 'markdown', value: parts.join('\n') },
    };
    if (m.docs) entry.references = [{ name: 'Zenith docs', url: m.docs }];
    globalAttributes[m.name] = entry;
  }
  return { version: 1, tags: [], globalAttributes };
}
