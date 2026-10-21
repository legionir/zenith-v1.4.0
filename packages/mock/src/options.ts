import { defineOptions, s, validate } from '@zenith/schema';
import { defineDefaults } from '@zenith/shared';
import type { MockOptions } from './index';
import type { MockClock } from './http';
const validDuration = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 2_147_483_647;
function validLatency(value: unknown): value is number | readonly [number, number] {
  if (validDuration(value)) return true;
  if (!Array.isArray(value) || value.length !== 2) return false;
  const start: unknown = value[0], end: unknown = value[1];
  return validDuration(start) && validDuration(end) && start <= end;
}
function validBaseURL(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}
/** Frozen defaults; latency is milliseconds and recording retains no request payload. @public */
export const DEFAULTS = defineDefaults({ onUnhandledRequest: 'error' as const, baseURL: 'http://localhost', latency: 0, record: false, maxCalls: 1000 });
/** Callbacks/clocks are opaque capabilities: validation never invokes or freezes them. @public */
export const mockOptionsSchema = s.object({
  onUnhandledRequest: s.default(s.enum(['error', 'warn', 'bypass']), DEFAULTS.onUnhandledRequest),
  baseURL: s.default(s.custom<string>(validBaseURL, 'HTTP(S) base URL without credentials'), DEFAULTS.baseURL),
  latency: s.default(s.custom<number | readonly [number, number]>(validLatency, 'bounded milliseconds or ordered latency range'), DEFAULTS.latency),
  record: s.default(s.boolean(), DEFAULTS.record), maxCalls: s.default(s.number({ min: 1, int: true }), DEFAULTS.maxCalls),
  random: s.optional(s.custom<() => number>(value => typeof value === 'function', 'random callback')),
  onWarning: s.optional(s.custom<(message: string) => void>(value => typeof value === 'function', 'warning callback')),
  clock: s.optional(s.custom<MockClock>(value => !!value && typeof value === 'object' && typeof (value as MockClock).setTimeout === 'function' && typeof (value as MockClock).clearTimeout === 'function', 'MockClock')),
});
const baseOptions = defineOptions<MockOptions>('MockOptions', mockOptionsSchema);
/** Invalid options fail consistently in development and production. @public */
export const mockOptions = { ...baseOptions, resolve(value: unknown): Readonly<MockOptions> {
  const parsed = validate<MockOptions>(mockOptionsSchema, value === undefined ? {} : value, { name: 'MockOptions', mode: 'throw', coerce: false, strict: true });
  return Object.freeze({ ...parsed, latency: typeof parsed.latency === 'number' || parsed.latency === undefined ? parsed.latency : Object.freeze([parsed.latency[0], parsed.latency[1]] as const) });
} };
