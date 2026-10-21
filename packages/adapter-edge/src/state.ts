import type { Disposer } from '@zenith/shared';
import { cloneRequestState as snapshot } from '@zenith/ssr/edge';
import { createReservedError } from '@zenith/errors';
/** Edge-specific error boundary around the shared Node/Edge snapshot contract. */
export function cloneRequestState(input: Record<string, unknown>, cleanup: Disposer): Record<string, unknown> {
  return snapshot(input, { cleanup, invalid: () => createReservedError('ZEN-1811') });
}
