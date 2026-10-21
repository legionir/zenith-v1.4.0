import { effect, type Signal } from '@zenith/state';
import type { FormScope } from './form-scope';
import type { FormOptions } from './form-types';
/** Pending timers and late save failures belong only to their live form. @internal */
export function installFormAutosave<T extends Record<string, unknown>>(scope: FormScope, input: { values: Signal<T>; formError: Signal<string | null>; options: FormOptions<T>['autoSave'] }): void {
  const { values, formError, options } = input;
  if (!options?.enabled) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  effect(() => {
    const current = values.get(), version = scope.version, run = ++generation;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(async () => {
      timer = undefined;
      if (scope.disposed || scope.version !== version || generation !== run) return;
      try { await options.handler(current); }
      catch {
        if (!scope.disposed && scope.version === version && generation === run && values.peek() === current) formError.set('Auto-save failed');
      }
    }, options.interval || 2000);
  });
  scope.onDispose(() => { generation++; if (timer !== undefined) clearTimeout(timer); timer = undefined; });
}
