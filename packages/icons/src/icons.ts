// packages/icons/src/icons.ts
//
// @zenith/icons (#170) — رجیستری و رندر آیکن SVG با sanitize.

import { sanitizeHTML } from '@zenith/security';
import type { Cleanup } from '@zenith/shared';

export interface IconDefinition {
  /** بدنهٔ SVG داخلی (path/circle/...) — با sanitize امن رندر می‌شود */
  body: string;
  viewBox?: string;
  width?: number;
  height?: number;
}

export interface IconSet {
  [name: string]: IconDefinition | string;
}

const registries = new Map<string, Map<string, IconDefinition>>();
/** ترتیب prefix-fallback: set default اولویت دارد. */
let defaultRegistry = 'default';

function ensureRegistry(name: string): Map<string, IconDefinition> {
  let r = registries.get(name);
  if (!r) {
    r = new Map();
    registries.set(name, r);
  }
  return r;
}

function normalize(set: IconSet, prefix?: string): Map<string, IconDefinition> {
  const out = new Map<string, IconDefinition>();
  for (const [key, value] of Object.entries(set)) {
    const name = prefix ? `${prefix}:${key}` : key;
    out.set(name, typeof value === 'string' ? { body: value } : value);
  }
  return out;
}

/**
 * #170: ثبت مجموعهٔ آیکن با prefix؛ Cleanup همهٔ آیکن‌های این set را حذف می‌کند.
 */
export function registerIcons(set: IconSet, options?: { prefix?: string; registry?: string }): Cleanup {
  const registry = ensureRegistry(options?.registry ?? defaultRegistry);
  const normalized = normalize(set, options?.prefix);
  for (const [k, v] of normalized.entries()) registry.set(k, v);
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    for (const k of normalized.keys()) registry.delete(k);
  };
}

export function getIcon(name: string, registry?: string): IconDefinition | null {
  const direct = registries.get(registry ?? defaultRegistry)?.get(name);
  if (direct) return direct;
  if (registry && registry !== defaultRegistry) {
    return registries.get(defaultRegistry)?.get(name) ?? null;
  }
  return null;
}

export function hasIcon(name: string, registry?: string): boolean {
  return getIcon(name, registry) !== null;
}

export function listIcons(registry?: string): string[] {
  return Array.from(registries.get(registry ?? defaultRegistry)?.keys() ?? []);
}

export function unregisterIcon(name: string, registry?: string): boolean {
  return registries.get(registry ?? defaultRegistry)?.delete(name) ?? false;
}

export function defineIconSet(name: string, set: IconSet, options?: { prefix?: string }): Cleanup {
  defaultRegistry = name;
  return registerIcons(set, { ...options, registry: name });
}

const SCRIPT_RE = /<script[\s\S]*?>(?:[\s\S]*?)<\/script\s*>/gi;
const FOREIGN_RE = /<foreignObject[\s\S]*?>(?:[\s\S]*?)<\/foreignObject\s*>/gi;
const EVENT_ATTR_RE = /\s+on[a-zA-Z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g;

/**
 * #170: پاک‌سازی بدنهٔ آیکن — حذف تگ script، attributeهای on-… و foreignObject.
 * ترکیب @zenith/security.sanitizeHTML + حذف اضافی تگ‌های meta SVG.
 */
export function sanitizeIconBody(body: string): string {
  const securitySafe = sanitizeHTML(body);
  return securitySafe
    .replace(SCRIPT_RE, '')
    .replace(FOREIGN_RE, '')
    .replace(EVENT_ATTR_RE, '');
}

/**
 * #170: رندر markdown کامل آیکن برای استفاده در html/string.
 */
export function renderIcon(
  name: string,
  options?: {
    registry?: string;
    size?: string | number;
    label?: string;
    set?: string;
    spin?: boolean;
    title?: string;
  },
): string {
  const registryName = options?.set ?? options?.registry;
  const icon = getIcon(name, registryName);
  if (!icon) return '';

  const sizeVal = options?.size ?? '1em';
  const sizeCss = typeof sizeVal === 'number' ? `${sizeVal}px` : sizeVal;
  const viewBox = icon.viewBox ?? '0 0 24 24';
  const body = sanitizeIconBody(icon.body);
  const label = options?.label;
  const spin = options?.spin ? ' class="zen-icon-spin"' : '';
  const titlePart = label
    ? ` role="img" aria-label="${escapeAttr(label)}"`
    : ' aria-hidden="true"';
  const titleTag = label ? `<title>${escapeHtml(label)}</title>` : '';
  const w = icon.width ?? 24;
  const h = icon.height ?? 24;

  return (
    `<svg${titlePart}${spin} xmlns="http://www.w3.org/2000/svg" ` +
    `viewBox="${escapeAttr(viewBox)}" width="${escapeAttr(sizeCss)}" height="${escapeAttr(sizeCss)}" ` +
    `data-icon-width="${w}" data-icon-height="${h}" fill="currentColor" focusable="false">` +
    `${titleTag}${body}` +
    `</svg>`
  );
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * #170: مجموعهٔ پایه (5 آیکن رایج) — import جداگانه تا tree-shakable بماند.
 */
export const BASIC_ICONS: IconSet = {
  'menu': { body: '<path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>' },
  'close': { body: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>' },
  'check': { body: '<path d="M4 12l5 5 11-11" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' },
  'chevron-down': { body: '<path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' },
  'search': { body: '<circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" fill="none"/><path d="M21 21l-4.3-4.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' },
};
