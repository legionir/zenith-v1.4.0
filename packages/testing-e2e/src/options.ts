import { s } from '@zenith/schema';
import { createReservedError } from '@zenith/errors';

/** @public */
export interface E2eOptions {
  /** URL of a test-only App host; mountApp's explicit url takes precedence. */ baseURL?: string;
  /** @default 5000 @unit ms */ hydrationTimeout?: number;
  /** @default true */ failOnConsoleError?: boolean;
  a11y?: { rules?: string[]; exclude?: string[]; impact?: 'minor' | 'moderate' | 'serious' | 'critical' };
}
/** @public */
export const DEFAULTS = Object.freeze({ hydrationTimeout: 5000, failOnConsoleError: true, a11yImpact: 'serious' as const });

/** Validate without launching a browser or logging user configuration. @public */
export function validateE2eOptions(value: unknown): value is E2eOptions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const options = value as E2eOptions;
  if (options.baseURL !== undefined && (typeof options.baseURL !== 'string' || !options.baseURL.trim())) return false;
  if (options.hydrationTimeout !== undefined && (!Number.isFinite(options.hydrationTimeout) || options.hydrationTimeout <= 0)) return false;
  if (options.failOnConsoleError !== undefined && typeof options.failOnConsoleError !== 'boolean') return false;
  if (options.a11y !== undefined) {
    if (!options.a11y || typeof options.a11y !== 'object' || Array.isArray(options.a11y)) return false;
    for (const list of [options.a11y.rules, options.a11y.exclude]) if (list !== undefined && (!Array.isArray(list) || list.some(item => typeof item !== 'string' || !item.trim()))) return false;
    if (options.a11y.impact !== undefined && !['minor', 'moderate', 'serious', 'critical'].includes(options.a11y.impact)) return false;
  }
  return true;
}
/** @public */
export const e2eOptionsSchema = s.custom<E2eOptions>(validateE2eOptions, 'E2eOptions');
/** @internal */
export function assertE2eOptions(value: unknown): asserts value is E2eOptions {
  if (!validateE2eOptions(value)) throw createReservedError('ZEN-1090', { details: { expected: 'valid E2eOptions' } });
}
