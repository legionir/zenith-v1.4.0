/**
 * Runtime Parity Checker
 *
 * When enabled in development mode, this module warns whenever
 * a directive's runtime behavior would diverge from compiled output.
 */

import { emitError } from '@zenith/state';

export let strictParityEnabled = false;
const knownDivergences = new Map<string, number>();
const DIVERGENCE_THROTTLE = 5000; // Warn at most once per directive every 5s

/**
 * Enable or disable strict parity checking in development
 */
export function setStrictParity(enabled: boolean): void {
  strictParityEnabled = enabled;
}

/**
 * Check if strict parity mode is active
 */
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
export function reportParityDivergence(
  directive: string,
  description: string,
  hint?: string
): void {
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
    hint: hint || 'This may cause different behavior in production (compiled) mode. ' +
                'Run the full parity test suite to investigate.',
    context: { directive, description }
  });
}

/**
 * Assert that a runtime value matches the expected compiler output.
 * Emits a parity warning if they differ (only in strict mode).
 */
export function assertParity(
  directive: string,
  runtimeValue: any,
  expectedCompilerValue: any,
  description: string
): boolean {
  const match = JSON.stringify(runtimeValue) === JSON.stringify(expectedCompilerValue);

  if (!match) {
    reportParityDivergence(
      directive,
      `${description} — runtime: ${JSON.stringify(runtimeValue)}, expected: ${JSON.stringify(expectedCompilerValue)}`
    );
  }

  return match;
}

/**
 * Clear all throttled divergence warnings
 */
export function clearParityWarnings(): void {
  knownDivergences.clear();
}
