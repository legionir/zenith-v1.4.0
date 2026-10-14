// packages/data/src/mutation.ts
//
// #55 — Declarative reactive mutation with options-object signature (`createMutation({ fn, ...options })`).
// Supports deprecated positional overload `createMutation(fn, options?)` (ZEN-DEPR-035).

import { signal, type Signal } from '@zenith/state';
import { deprecate } from '@zenith/errors';

export interface MutationOptions<TData = unknown, TVariables = void, TError = Error> {
  fn: (variables: TVariables) => Promise<TData>;
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
  onError?: (error: TError, variables: TVariables) => void | Promise<void>;
  onSettled?: (
    data: TData | undefined,
    error: TError | null,
    variables: TVariables,
  ) => void | Promise<void>;
}

export type LegacyMutationCallbacks<TData = unknown, TVariables = void, TError = Error> = Omit<
  MutationOptions<TData, TVariables, TError>,
  'fn'
>;

export interface MutationController<TData = unknown, TVariables = void, TError = Error> {
  data: Signal<TData | undefined>;
  error: Signal<TError | null>;
  loading: Signal<boolean>;
  mutate: (variables: TVariables) => Promise<TData>;
  reset: () => void;
}

export function createMutation<TData = unknown, TVariables = void, TError = Error>(
  options: MutationOptions<TData, TVariables, TError>,
): MutationController<TData, TVariables, TError>;
/** @deprecated Use `createMutation({ fn, ...options })` instead (#55, ZEN-DEPR-035). */
export function createMutation<TData = unknown, TVariables = void, TError = Error>(
  fn: (variables: TVariables) => Promise<TData>,
  options?: LegacyMutationCallbacks<TData, TVariables, TError>,
): MutationController<TData, TVariables, TError>;
export function createMutation<TData = unknown, TVariables = void, TError = Error>(
  fnOrOptions:
    MutationOptions<TData, TVariables, TError> | ((variables: TVariables) => Promise<TData>),
  legacyOptions?: LegacyMutationCallbacks<TData, TVariables, TError>,
): MutationController<TData, TVariables, TError> {
  let resolved: MutationOptions<TData, TVariables, TError>;
  if (typeof fnOrOptions === 'function') {
    deprecate('ZEN-DEPR-035', 'createMutation(fn, options)', 'createMutation({ fn, ...options })');
    resolved = { fn: fnOrOptions, ...(legacyOptions ?? {}) };
  } else {
    resolved = fnOrOptions;
  }

  const data = signal<TData | undefined>(undefined);
  const error = signal<TError | null>(null);
  const loading = signal<boolean>(false);

  async function mutate(variables: TVariables): Promise<TData> {
    loading.set(true);
    error.set(null);
    let resultData: TData | undefined;
    let resultError: TError | null = null;
    try {
      resultData = await resolved.fn(variables);
      data.set(resultData);
      await resolved.onSuccess?.(resultData, variables);
      return resultData;
    } catch (err) {
      resultError = err as TError;
      error.set(resultError);
      await resolved.onError?.(resultError, variables);
      throw err;
    } finally {
      loading.set(false);
      await resolved.onSettled?.(resultData, resultError, variables);
    }
  }

  function reset(): void {
    data.set(undefined);
    error.set(null);
    loading.set(false);
  }

  return { data, error, loading, mutate, reset };
}
