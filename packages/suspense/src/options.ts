import { s, defineOptions } from '@zenith/schema';
import type { SuspenseContextOptions, TrackPromiseOptions, WithTimeoutOptions } from './types';
/** Canonical context validation; positional bridges preserve old timeout behavior. @internal */
export const suspenseContextOptions = defineOptions<SuspenseContextOptions>('SuspenseContextOptions', s.object({
  timeoutMs: s.default(s.number({ min: 0 }), 0),
  onSettle: s.optional(s.custom<(settled: boolean) => void>(value => typeof value === 'function', 'function')),
}));

/** Promise tracking accepts only callable boundary capabilities, not domain payload decoders. @internal */
export const trackPromiseOptions = defineOptions<TrackPromiseOptions>('TrackPromiseOptions', s.object({
  suspense: s.optional(s.custom<NonNullable<TrackPromiseOptions['suspense']>>(value => {
    if (typeof value !== 'object' || value === null) return false;
    if ('track' in value) return typeof value.track === 'function';
    return typeof Reflect.get(value, 'startLoading') === 'function' && typeof Reflect.get(value, 'stopLoading') === 'function' && typeof Reflect.get(value, 'reportError') === 'function';
  }, 'SuspenseContext | SuspenseController')),
  key: s.optional(s.string()), timeout: s.optional(s.number({ min: 0 })),
}));
/** Canonical timer configuration; positional negative durations retain the old no-op path. @internal */
export const withTimeoutOptions = defineOptions<WithTimeoutOptions>('WithTimeoutOptions', s.object({ ms: s.number({ min: 0 }), message: s.optional(s.string()) }));
