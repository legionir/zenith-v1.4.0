import { createIdScope, useId as scopedId, type IdScope } from '@zenith/a11y';
import type { App } from './types';
import { getCurrentApp } from './scope';

const idScopes = new WeakMap<App, IdScope>();
/** Legacy prefix signature retained; explicit scopes live in @zenith/a11y.
 * @public
 */
export function useId(prefix = 'zen-id'): string {
  const app = getCurrentApp();
  if (!app) return scopedId({ prefix });
  let scope = idScopes.get(app);
  if (!scope) { scope = createIdScope(); idScopes.set(app, scope); }
  return scopedId({ prefix, scope });
}
