import { defineOptions, s, validate } from '@zenith/schema';
import type { NodeHandlerOptions } from './handler';
const fn = (value: unknown) => typeof value === 'function';
const record = (value: unknown) => !!value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value) as object | null);
const slot = <K extends keyof NodeHandlerOptions>(key: K, check: (value: unknown) => boolean) => s.custom<NonNullable<NodeHandlerOptions[K]>>(check, key);
const compression = s.enum([true, false, 'gzip', 'br']);
const staticShape = {
  prefix: s.optional(s.string()), maxAge: s.optional(s.number({ min: 0 })), immutable: s.optional(s.boolean()),
  etag: s.optional(s.boolean()), compression: s.optional(compression),
};
const schema = s.object({
  template: slot('template', value => typeof value === 'string' || fn(value)), app: slot('app', fn),
  state: s.optional(slot('state', value => fn(value) || record(value))),
  head: s.optional(slot('head', value => fn(value) || record(value))),
  i18n: s.optional(slot('i18n', value => fn(value) || record(value))),
  stream: s.default(s.boolean(), true), timeout: s.default(s.number({ min: 0, max: 2147483647 }), 10000), trustProxy: s.default(s.boolean(), false),
  health: s.default(s.union([s.string({ pattern: '^/' }), s.enum([false])]), '/healthz'),
  cacheControl: s.optional(slot('cacheControl', value => typeof value === 'string' || fn(value))),
  csp: s.optional(s.object({ nonce: s.optional(s.boolean()), policy: s.optional(s.string()) })),
  staticDir: s.optional(s.string({ min: 1 })), staticOptions: s.optional(s.object(staticShape)),
  static: s.optional(s.object({ root: s.string({ min: 1 }), ...staticShape })),
  compression: s.default(compression, true), etag: s.default(s.boolean(), true),
  routes: s.optional(slot('routes', value => fn(value) || (Array.isArray(value) && value.every(path => typeof path === 'string')))),
  onError: s.optional(slot('onError', fn)), onAbort: s.optional(slot('onAbort', fn)),
  logger: s.optional(slot('logger', value => !!value && typeof value === 'object' && fn((value as NodeHandlerOptions['logger'])?.info) && fn((value as NodeHandlerOptions['logger'])?.error))),
});
const base = /* @__PURE__ */ defineOptions<NodeHandlerOptions>('NodeHandlerOptions', schema);
/** Schema-backed configuration; malformed transport settings fail in production too. @public */
export const nodeHandlerOptions = {
  ...base,
  resolve(input: unknown): NodeHandlerOptions {
    return Object.freeze(validate<NodeHandlerOptions>(base.schema, input, { name: 'NodeHandlerOptions', mode: 'throw' }));
  },
};
