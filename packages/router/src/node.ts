/** Native Node entry for synchronous route scopes on all supported Node versions. @packageDocumentation */
import { AsyncLocalStorage } from 'node:async_hooks';
import { installRouteContextStorage, type RouteStore } from './als-holder';
installRouteContextStorage(new AsyncLocalStorage<RouteStore>());
export { runWithRoute, runWithRouteSync } from './ssr-route';
