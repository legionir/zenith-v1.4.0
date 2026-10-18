import { untrack } from '@zenith/state';
import { isGlobalObservationEnabled } from '@zenith/state/internal';

/** Private compatibility guard; native host policy takes precedence over DOM existence. @internal */
export function canObserveHost(): boolean {
  return untrack(() => isGlobalObservationEnabled() && Reflect.get(globalThis, '__ZENITH_SSR__') !== true &&
    (typeof document === 'undefined' || Reflect.get(document, '__zenithSSR__') !== true));
}
