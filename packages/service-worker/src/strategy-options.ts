import { s, validate } from '@zenith/schema';
/** Cache strategy configuration; timeout is milliseconds. @public */
export interface CacheStrategyOptions { cacheName: string; timeout?: number; onUpdate?: (fresh: Response) => void; }
/** @public */
export const cacheStrategyOptionsSchema = s.object({ cacheName: s.string({ min: 1 }), timeout: s.optional(s.duration({ min: 0, max: 2_147_483_647 })), onUpdate: s.optional(s.custom<(fresh: Response) => void>(value => typeof value === 'function', 'response callback')) });
// Legacy operands retain historical Cache API/timer behavior. A private lease
// follows internal dispatch so applyStrategy does not revalidate or warn twice.
const legacyConfigurations = new WeakSet<object>();
/** @internal */
export function legacyStrategyOptions(options: CacheStrategyOptions): CacheStrategyOptions { legacyConfigurations.add(options); return options; }
/** @internal */
export function resolveStrategyOptions(options: CacheStrategyOptions): CacheStrategyOptions { if (legacyConfigurations.has(options)) return options; return validate<CacheStrategyOptions>(cacheStrategyOptionsSchema, options, { name: 'CacheStrategyOptions', mode: 'throw', strict: true, coerce: false }); }
