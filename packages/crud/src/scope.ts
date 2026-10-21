import type { Signal, ReadonlySignal } from '@zenith/state';
import type { Resource } from '@zenith/resource';
import type { ActionFn } from '@zenith/actions';
import type { CrudEngineConfig } from './types';
/** Local runtime markers, not an assertion that a partial Signal/engine exists. @internal */
export interface CrudHost extends HTMLElement {
  __zenithDisposes?: (() => void)[];
  __zenithDelegationTeardown?: () => void;
}
/** Live capabilities forwarded by the single engine owner. @internal */
export interface CrudScope {
  readonly config: CrudEngineConfig;
  readonly host: CrudHost;
  readonly resource: Resource;
  readonly searchQuery: Signal<string>;
  readonly currentPage: Signal<number>;
  readonly pageSize: Signal<number>;
  readonly activeFilters: Signal<Record<string, string>>;
  readonly sortBy: Signal<string | null>;
  readonly sortDir: Signal<'asc' | 'desc'>;
  viewData: ReadonlySignal<Record<string, unknown>[]>;
  totalItems: ReadonlySignal<number>;
  totalPages: ReadonlySignal<number>;
  startIdx: ReadonlySignal<number>;
  endIdx: ReadonlySignal<number>;
  currentViewPage: ReadonlySignal<number>;
  permissionDisposes: (() => void)[];
  registeredActions: string[];
  rendered: boolean;
  guardAction(fn: ActionFn, permission?: string): ActionFn;
  markComputedAsSignalLike<T>(value: ReadonlySignal<T>): void;
  buildToolbar(): string;
  buildTable(): string;
  buildPagination(): string;
  escapeHtml(value: string): string;
  escapeAttr(value: string): string;
}
