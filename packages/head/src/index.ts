import { createHeadDOMOwner, type HeadDOMTag } from './dom';
import { s, defineOptions, validate } from '@zenith/schema';
import { installHeadPlugin, type HeadAppHost } from './plugin';
export type { HeadAppHost, HeadBindContext } from './plugin';
import { createRoot, effect, signal, untrack } from '@zenith/state';
import { isReadable, type Disposable, type Readable } from '@zenith/shared';
import { createReservedError } from '@zenith/errors';

/** @public */
export type HeadValue<T> = T | Readable<T>;
/** @public */
export interface HeadScript { type?: string; key?: string; json?: unknown; innerHTML?: unknown; }
/** @public */
export type HeadTitleTemplate = string | ((title: string) => string);
/** @public */
export type HeadDedupe = boolean | readonly ('name' | 'property' | 'rel+href' | 'key')[];
/** @public */
export interface HeadInput {
  title?: HeadValue<string | undefined>; titleTemplate?: HeadValue<HeadTitleTemplate | undefined>;
  meta?: HeadValue<Array<Record<string, string>>>; link?: HeadValue<Array<Record<string, string>>>;
  script?: HeadValue<HeadScript[]>; jsonLd?: HeadValue<Record<string, unknown> | Array<Record<string, unknown>>>;
  htmlAttrs?: HeadValue<Record<string, string>>; bodyAttrs?: HeadValue<Record<string, string>>;
  base?: HeadValue<Record<string, string>>;
}
/** @public */
export interface ResolvedHeadInput {
  title?: string; meta: Array<Record<string, string>>; link: Array<Record<string, string>>;
  jsonLd?: Array<Record<string, unknown>>; htmlAttrs: Record<string, string>; bodyAttrs: Record<string, string>;
  base?: Record<string, string>;
}
/** @public */
export interface HeadOptions { titleTemplate?: HeadTitleTemplate; dedupe?: HeadDedupe; nonce?: string; maxTags?: number; allowScript?: readonly string[]; document?: Document; }
/** @public */
export interface HeadEntry extends Disposable { patch(input: HeadInput | (() => HeadInput)): void; }
/** @public */
export interface HeadManager extends Disposable {
  push(input: HeadInput | (() => HeadInput)): HeadEntry;
  use(input: HeadInput | (() => HeadInput)): HeadEntry;
  resolve(): ResolvedHeadInput;
  readonly options: Readonly<HeadOptions>;
}
function read<T>(value: HeadValue<T>): T { return isReadable(value) ? value.get() as T : value; }
function input(value: HeadInput | (() => HeadInput)): HeadInput { return typeof value === 'function' ? value() : value; }
const escape = (value: unknown) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const allowed = /^(?:name|property|content|charset|http-equiv|rel|href|hreflang|type|media|sizes|as|crossorigin|lang|dir|class|id|nonce|target|data-[\w-]+|aria-[\w-]+)$/i;
function attributes(values: Record<string, string> = {}): string {
  return Object.entries(values).filter(([key]) => key.toLowerCase() !== 'key' && key.toLowerCase() !== 'data-zen-head' && allowed.test(key)).map(([key, value]) => {
    if ((key.toLowerCase() === 'href') && /^(?:javascript|data|vbscript):/i.test(value.replace(/[\u0000-\u0020]/g, ''))) throw createReservedError('ZEN-1501');
    return ` ${key}="${escape(value)}"`;
  }).join('');
}
function json(value: unknown): string {
  try { const result = JSON.stringify(value); if (!result || !value || typeof value !== 'object') throw new Error(); return result.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029'); }
  catch { throw createReservedError('ZEN-1502'); }
}
function tagKey(type: string, record: Record<string, string>, index: number, dedupe: HeadDedupe = true): string {
  if (dedupe === false) return `${type}:${index}`;
  const rules = Array.isArray(dedupe) ? dedupe : ['key', 'name', 'property', 'rel+href'];
  const key = rules.includes('key') ? record.key : undefined;
  const identity = key ?? (rules.includes('name') ? record.name : undefined) ?? (rules.includes('property') ? record.property : undefined) ?? record.charset ?? (type === 'link' && rules.includes('rel+href') ? `${record.rel ?? ''}:${record.href ?? ''}` : undefined);
  return `${type}:${identity ?? index}`;
}
/** Validated immutable configuration; DOM ownership remains explicit. @public */
const headSchema = s.object({
  titleTemplate: s.optional(s.union([s.string(), s.custom<(title: string) => string>(value => typeof value === 'function', 'title formatter')])),
  dedupe: s.default(s.union([s.boolean(), s.array(s.enum(['name', 'property', 'rel+href', 'key']))]), true),
  nonce: s.optional(s.string()), maxTags: s.default(s.number({ min: 1, int: true }), 100),
  allowScript: s.default(s.array(s.enum(['application/ld+json'])), ['application/ld+json']),
  document: s.optional(s.custom<Document>(value => !!value && typeof value === 'object' && (value as Document).nodeType === 9, 'Document')),
});
const baseOptions = /* @__PURE__ */ defineOptions<HeadOptions>('HeadOptions', headSchema);
/** Strict option validation also applies in production. @public */
export const headOptions = { ...baseOptions, resolve(value: unknown): HeadOptions { return Object.freeze(validate<HeadOptions>(headSchema, value === undefined ? {} : value, { name: 'HeadOptions', mode: 'throw', coerce: true })); } };
/** Explicit owner: creating one manager never changes another request's active head. @public */
export function createHead(rawOptions: HeadOptions = {}): HeadManager {
  const options = headOptions.resolve(rawOptions);
  if (!Number.isInteger(options.maxTags ?? 100) || (options.maxTags ?? 100) < 1) throw createReservedError('ZEN-1503');
  const entries = new Set<{ value: HeadInput | (() => HeadInput) }>(); const revision = signal(0);
  const doc = (options.document as (Document & { __zenithSSR__?: boolean }) | undefined)?.__zenithSSR__ ? undefined : options.document;
  const dom = doc ? createHeadDOMOwner(doc) : undefined;
  let stop: (() => void) | undefined, disposed = false;
  const cleanAttrs = (attrs: Record<string, string>) => Object.fromEntries(Object.entries(attrs).filter(([key]) => key.toLowerCase() !== 'key' && key.toLowerCase() !== 'data-zen-head' && allowed.test(key)).map(([key, value]) => [key.toLowerCase(), value]));
  const resolve = (): ResolvedHeadInput => {
    let title: string | undefined; let template = options.titleTemplate ?? '%s'; let base: Record<string, string> | undefined;
    const meta = new Map<string, Record<string, string>>(); const link = new Map<string, Record<string, string>>();
    const jsonLd = new Map<string, Record<string, unknown>>(); let scriptIndex = 0; const htmlAttrs: Record<string, string> = Object.create(null); const bodyAttrs: Record<string, string> = Object.create(null);
    for (const entry of entries) {
      const value = input(entry.value);
      if (value.title !== undefined) title = read(value.title);
      if (value.titleTemplate !== undefined) template = read(value.titleTemplate) ?? '%s';
      for (const [kind, target] of [['meta', meta], ['link', link]] as const) {
        for (const record of read(value[kind] ?? [])) { const key = options.dedupe === false ? `${kind}:${target.size}` : tagKey(kind, record, target.size, options.dedupe); attributes(record); target.set(key, { ...record }); }
      }
      if (value.jsonLd) { if (!(options.allowScript ?? ['application/ld+json']).includes('application/ld+json')) throw createReservedError('ZEN-1501'); const items = read(value.jsonLd); for (const item of Array.isArray(items) ? items : [items]) { json(item); jsonLd.set(`auto:${scriptIndex++}`, item); } }
      for (const script of read(value.script ?? [])) {
        if ((script.type ?? 'application/ld+json') !== 'application/ld+json' || !(options.allowScript ?? ['application/ld+json']).includes('application/ld+json')) throw createReservedError('ZEN-1501');
        let item: unknown = script.json ?? script.innerHTML;
        if (typeof item === 'string') { try { item = JSON.parse(item); } catch { throw createReservedError('ZEN-1502'); } }
        json(item); jsonLd.set((options.dedupe === undefined || options.dedupe === true || Array.isArray(options.dedupe) && options.dedupe.includes('key')) && script.key ? `key:${script.key}` : `auto:${scriptIndex++}`, item as Record<string, unknown>);
      }
      Object.assign(htmlAttrs, read(value.htmlAttrs ?? {})); Object.assign(bodyAttrs, read(value.bodyAttrs ?? {}));
      if (value.base) { base = { ...read(value.base) }; attributes(base); }
    }
    const count = meta.size + link.size + jsonLd.size + (title === undefined ? 0 : 1) + (base ? 1 : 0);
    if (count > (options.maxTags ?? 100)) throw createReservedError('ZEN-1503');
    const formatted = title === undefined ? undefined : typeof template === 'function' ? template(title) : template.replace('%s', () => title!);
    if (formatted !== undefined && typeof formatted !== 'string') throw createReservedError('ZEN-1501');
    return { title: formatted, meta: [...meta.values()], link: [...link.values()], jsonLd: jsonLd.size ? [...jsonLd.values()] : undefined, htmlAttrs, bodyAttrs, base };
  };
  const reconcile = () => {
    if (!dom || disposed) return; const value = resolve();
    const desired: HeadDOMTag[] = [];
    if (value.title !== undefined) desired.push({ key: 'title', tag: 'title', attrs: {}, text: value.title });
    value.meta.forEach((attrs, index) => desired.push({ key: tagKey('meta', attrs, index, options.dedupe), tag: 'meta', attrs }));
    value.link.forEach((attrs, index) => desired.push({ key: tagKey('link', attrs, index, options.dedupe), tag: 'link', attrs }));
    value.jsonLd?.forEach((item, index) => desired.push({ key: `ld:${index}`, tag: 'script', attrs: { type: 'application/ld+json', ...(options.nonce ? { nonce: options.nonce } : {}) }, text: json(item) }));
    if (value.base) desired.push({ key: 'base', tag: 'base', attrs: value.base });
    untrack(() => dom.update(desired.map(item => ({ ...item, attrs: cleanAttrs(item.attrs) })), cleanAttrs(value.htmlAttrs), cleanAttrs(value.bodyAttrs)));
  };
  const push = (value: HeadInput | (() => HeadInput)): HeadEntry => {
    if (disposed) throw createReservedError('ZEN-1501'); const entry = { value }; entries.add(entry); let active = true;
    try { untrack(resolve); } catch (error) { entries.delete(entry); throw error; }
    if (disposed) { entries.delete(entry); throw createReservedError('ZEN-1501'); }
    try {
      revision.update(v => v + 1);
      if (doc && !stop) createRoot(release => { stop = release; effect(() => { revision.get(); reconcile(); }); });
    } catch (error) { entries.delete(entry); try { stop?.(); } catch {} stop = undefined; throw error; }
    return { patch(next) { if (!active || disposed) return; const previous = entry.value; entry.value = () => ({ ...input(previous), ...input(next) }); try { untrack(resolve); } catch (error) { entry.value = previous; throw error; } revision.update(v => v + 1); },
      dispose() { if (!active) return; active = false; entries.delete(entry); if (!disposed) revision.update(v => v + 1); } };
  };
  return { options: Object.freeze({ ...options, dedupe: Array.isArray(options.dedupe) ? Object.freeze([...options.dedupe]) : options.dedupe, allowScript: Object.freeze([...(options.allowScript ?? [])]) }), push, use: push, resolve, dispose() {
    if (disposed) return; disposed = true; try { stop?.(); } finally { entries.clear(); try { revision.dispose(); } finally { dom?.dispose(); } }
  } };
}
/** Explicit owner is mandatory; never rely on a process-wide last-created manager. @public */
export function useHead(value: HeadInput | (() => HeadInput), options: { head: HeadManager }): HeadEntry { return options.head.push(value); }
/** Escape SSR output, with stable hydration ownership keys and nonce-bearing JSON-LD only. @public */
export function renderHead(head: HeadManager | HeadInput): { headTags: string; htmlAttrs: string; bodyAttrs: string } {
  const own = !('resolve' in head); const manager = own ? createHead() : head as HeadManager;
  try {
    if (own) manager.push(head as HeadInput); const value = manager.resolve(); const tags: string[] = [];
    if (value.title !== undefined) tags.push(`<title data-zen-head="title">${escape(value.title)}</title>`);
    value.meta.forEach((attrs, index) => tags.push(`<meta data-zen-head="${escape(tagKey('meta', attrs, index, manager.options.dedupe))}"${attributes(attrs)}>`));
    value.link.forEach((attrs, index) => tags.push(`<link data-zen-head="${escape(tagKey('link', attrs, index, manager.options.dedupe))}"${attributes(attrs)}>`));
    if (value.base) tags.push(`<base data-zen-head="base"${attributes(value.base)}>`);
    value.jsonLd?.forEach((item, index) => tags.push(`<script type="application/ld+json" data-zen-head="ld:${index}"${manager.options.nonce ? ` nonce="${escape(manager.options.nonce)}"` : ''}>${json(item)}</script>`));
    const result = { headTags: tags.join(''), htmlAttrs: attributes(value.htmlAttrs), bodyAttrs: attributes(value.bodyAttrs) };
    return result;
  } finally { if (own) manager.dispose(); }
}
/** @public */
export function titleFromRoute(route: { path: string; meta?: Record<string, unknown> }, template = '%s'): string { const title = typeof route.meta?.title === 'string' ? route.meta.title : route.path === '/' ? 'Home' : route.path.replace(/^\//, ''); return template.replace('%s', () => title!); }
/** Per-install manager; no shared active Head. @public */
export function headPlugin(options: HeadOptions = {}) {
  return { name: 'zenith:head', install(app: HeadAppHost) {
    const candidate = options.document ?? (typeof document === 'undefined' ? undefined : document);
    const head = createHead({ ...options, document: candidate });
    try { return installHeadPlugin(app, head); } catch (error) { try { head.dispose(); } catch {} throw error; }
  } };
}
