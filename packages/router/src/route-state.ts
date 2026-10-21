import { signal, type Signal } from '@zenith/state';
import { browserRouteSingleton, getRouteAsyncLocalStorage } from './als-holder';
/** Current path and decoded route parameters. @public */
export interface RouteState { path: string; params: Record<string, string>; }
/** Browser-owned route state. Request scopes never dispose this singleton. @internal */
export const browserRouteSignal = browserRouteSingleton(() => signal<RouteState>({ path: typeof window === 'undefined' ? '/' : window.location.pathname, params: {} }));
/** Resolve at invocation, not at property access: extracted methods remain context-aware. @internal */
export function getCurrentRouteSignal(): Signal<RouteState> { return getRouteAsyncLocalStorage()?.getStore()?.signal ?? browserRouteSignal; }
const methods = {
  get: () => getCurrentRouteSignal().get(),
  peek: () => getCurrentRouteSignal().peek(),
  set: (value: RouteState) => getCurrentRouteSignal().set(value),
  update: (fn: (value: RouteState) => RouteState) => getCurrentRouteSignal().update(fn),
  removeSubscriber: (effect: Parameters<Signal<RouteState>['removeSubscriber']>[0]) => getCurrentRouteSignal().removeSubscriber(effect),
  dispose: () => getCurrentRouteSignal().dispose(),
};
/**
 * A complete Signal facade backed by a real Signal, preserving its nominal type.
 * Reads track the selected underlying signal, whose own cleanup captures identity.
 * No fake addSubscriber method or unchecked Signal cast is involved.
 * @public
 */
export const routeSignal: Signal<RouteState> = new Proxy(browserRouteSignal, {
  get(_target, key) {
    if (Object.hasOwn(methods, key)) return Reflect.get(methods, key);
    const current = getCurrentRouteSignal(); return Reflect.get(current, key, current);
  },
});
