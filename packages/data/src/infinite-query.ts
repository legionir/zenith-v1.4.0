// packages/data/src/infinite-query.ts
//
// #55 — Declarative infinite query with options-object signature (`createInfiniteQuery({ key, fn, ... })`).
// Supports deprecated positional overload `createInfiniteQuery(key, fn, options)` (ZEN-DEPR-036).

import { signal, type Signal } from '@zenith/state';
import { deprecate } from '@zenith/errors';

export interface InfiniteQueryOptions<TPage = unknown, TPageParam = number> {
  key: string;
  fn: (pageParam: TPageParam) => Promise<TPage>;
  initialPageParam?: TPageParam;
  getNextPageParam: (lastPage: TPage, allPages: TPage[]) => TPageParam | undefined | null;
}

export type LegacyInfiniteQueryRest<TPage = unknown, TPageParam = number> = Omit<
  InfiniteQueryOptions<TPage, TPageParam>,
  'key' | 'fn'
>;

export interface InfiniteQueryController<TPage = unknown> {
  pages: Signal<TPage[]>;
  loading: Signal<boolean>;
  error: Signal<Error | null>;
  hasNextPage: Signal<boolean>;
  fetchNextPage: () => Promise<TPage | undefined>;
  reset: () => void;
}

export function createInfiniteQuery<TPage = unknown, TPageParam = number>(
  options: InfiniteQueryOptions<TPage, TPageParam>,
): InfiniteQueryController<TPage>;
/** @deprecated Use `createInfiniteQuery({ key, fn, ...options })` instead (#55, ZEN-DEPR-036). */
export function createInfiniteQuery<TPage = unknown, TPageParam = number>(
  key: string,
  fn: (pageParam: TPageParam) => Promise<TPage>,
  options: LegacyInfiniteQueryRest<TPage, TPageParam>,
): InfiniteQueryController<TPage>;
export function createInfiniteQuery<TPage = unknown, TPageParam = number>(
  keyOrOptions: string | InfiniteQueryOptions<TPage, TPageParam>,
  legacyFn?: (pageParam: TPageParam) => Promise<TPage>,
  legacyOptions?: LegacyInfiniteQueryRest<TPage, TPageParam>,
): InfiniteQueryController<TPage> {
  let resolved: InfiniteQueryOptions<TPage, TPageParam>;
  if (typeof keyOrOptions === 'string') {
    deprecate(
      'ZEN-DEPR-036',
      'createInfiniteQuery(key, fn, options)',
      'createInfiniteQuery({ key, fn, ...options })',
    );
    resolved = {
      key: keyOrOptions,
      fn: legacyFn!,
      ...(legacyOptions as LegacyInfiniteQueryRest<TPage, TPageParam>),
    };
  } else {
    resolved = keyOrOptions;
  }

  const pages = signal<TPage[]>([]);
  const loading = signal<boolean>(false);
  const error = signal<Error | null>(null);
  const hasNextPage = signal<boolean>(true);
  let nextParam: TPageParam | undefined | null =
    resolved.initialPageParam !== undefined
      ? resolved.initialPageParam
      : (0 as unknown as TPageParam);

  async function fetchNextPage(): Promise<TPage | undefined> {
    if (!hasNextPage.get() || nextParam === undefined || nextParam === null) {
      return undefined;
    }
    loading.set(true);
    error.set(null);
    try {
      const page = await resolved.fn(nextParam);
      const updatedPages = [...pages.get(), page];
      pages.set(updatedPages);
      nextParam = resolved.getNextPageParam(page, updatedPages);
      hasNextPage.set(nextParam !== undefined && nextParam !== null);
      return page;
    } catch (err) {
      error.set(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      loading.set(false);
    }
  }

  function reset(): void {
    pages.set([]);
    loading.set(false);
    error.set(null);
    hasNextPage.set(true);
    nextParam =
      resolved.initialPageParam !== undefined
        ? resolved.initialPageParam
        : (0 as unknown as TPageParam);
  }

  return { pages, loading, error, hasNextPage, fetchNextPage, reset };
}
