/**
 * Runtime Parity Checker
 *
 * When enabled in development mode, this module warns whenever
 * a directive's runtime behavior would diverge from compiled output.
 */

import { defineOptions, s } from '@zenith/schema';
import { deprecate } from '@zenith/errors';
import { emitError } from '@zenith/state';

/** @public */
export let strictParityEnabled = false;
const knownDivergences = new Map<string, number>();
const DIVERGENCE_THROTTLE = 5000; // Warn at most once per directive every 5s

/**
 * Enable or disable strict parity checking in development
 */
/** @public */
export function setStrictParity(enabled: boolean): void {
  strictParityEnabled = enabled;
}

/**
 * Check if strict parity mode is active
 */
/** @public */
export function isStrictParityEnabled(): boolean {
  return strictParityEnabled;
}

/**
 * Report a potential parity divergence between runtime and compiler behavior.
 * Only emits warnings when strictParity is enabled.
 *
 * @param directive The directive name where divergence was detected
 * @param description What the difference is
 * @param hint Suggestion on how to avoid the divergence
 */
/** Parity diagnostic configuration. @public */
export interface ParityDivergenceOptions { description: string; hint?: string; }
const divergenceOptions = /* @__PURE__ */ defineOptions<ParityDivergenceOptions>('ParityDivergenceOptions', s.object({ description: s.string(), hint: s.optional(s.string()) }));
/** @public */
export function reportParityDivergence(directive: string, options: ParityDivergenceOptions): void;
/** @public @deprecated Use reportParityDivergence(directive, { description, hint }) (ZEN-DEPR-087). */
export function reportParityDivergence(directive: string, description: string, hint?: string): void;
export function reportParityDivergence(directive: string, optionsOrDescription: ParityDivergenceOptions | string, legacyHint?: string): void {
  let description: string, hint: string | undefined;
  if (typeof optionsOrDescription === 'string' || arguments.length > 2) {
    deprecate('ZEN-DEPR-087', 'reportParityDivergence(directive, description, hint)', 'reportParityDivergence(directive, { description, hint })');
    // Explicit legacy arity keeps historical JavaScript/default-argument behavior.
    description = optionsOrDescription as string; hint = legacyHint;
  } else {
    ({ description, hint } = divergenceOptions.resolve(optionsOrDescription));
  }
  if (!strictParityEnabled) return;

  const now = Date.now();
  const lastWarn = knownDivergences.get(directive) || 0;

  // Throttle warnings to avoid console spam
  if (now - lastWarn < DIVERGENCE_THROTTLE) return;
  knownDivergences.set(directive, now);

  emitError({
    message: `Parity divergence detected in [${directive}]: ${description}`,
    category: 'runtime',
    severity: 'warning',
    recoverable: true,
    hint:
      hint ||
      'This may cause different behavior in production (compiled) mode. ' +
        'Run the full parity test suite to investigate.',
    context: { directive, description },
  });
}

/**
 * Assert that a runtime value matches the expected compiler output.
 * Emits a parity warning if they differ (only in strict mode).
 */
/** Runtime/compiler operands are unvalidated values, not inferred domain data. @public */
export interface ParityAssertionOptions { runtimeValue: unknown; expectedCompilerValue: unknown; description: string; }
const assertionOptions = /* @__PURE__ */ defineOptions<ParityAssertionOptions>('ParityAssertionOptions', s.object({
  runtimeValue: s.custom<unknown>(() => true, 'runtime value'), expectedCompilerValue: s.custom<unknown>(() => true, 'compiler value'), description: s.string(),
}));
/** @public */
export function assertParity(directive: string, options: ParityAssertionOptions): boolean;
/** @public @deprecated Use assertParity(directive, { runtimeValue, expectedCompilerValue, description }) (ZEN-DEPR-088). */
export function assertParity(directive: string, runtimeValue: unknown, expectedCompilerValue: unknown, description: string): boolean;
export function assertParity(directive: string, optionsOrValue: unknown, legacyExpected?: unknown, legacyDescription?: string): boolean {
  let runtimeValue: unknown, expectedCompilerValue: unknown, description: string;
  if (arguments.length > 2) {
    deprecate('ZEN-DEPR-088', 'assertParity(directive, runtime, expected, description)', 'assertParity(directive, { runtimeValue, expectedCompilerValue, description })');
    runtimeValue = optionsOrValue; expectedCompilerValue = legacyExpected; description = legacyDescription!;
  } else {
    ({ runtimeValue, expectedCompilerValue, description } = assertionOptions.resolve(optionsOrValue));
  }
  const match = JSON.stringify(runtimeValue) === JSON.stringify(expectedCompilerValue);

  if (!match) {
    reportParityDivergence(
      directive,
      { description: `${description} — runtime: ${JSON.stringify(runtimeValue)}, expected: ${JSON.stringify(expectedCompilerValue)}` },
    );
  }

  return match;
}

/**
 * Clear all throttled divergence warnings
 */
/** @public */
export function clearParityWarnings(): void {
  knownDivergences.clear();
}
