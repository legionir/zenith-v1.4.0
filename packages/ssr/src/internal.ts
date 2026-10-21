// packages/ssr/src/internal.ts
//
// Host/adapter integration only (`@zenith/ssr/internal`, #56).
// Deliberately uses the external self-specifier like `@zenith/state/internal`:
// the root owns all implementation and nominal declarations in each format.
// Never import `./dom-context` here directly: independently bundling it would
// create a second ALS/singleton graph. Keep legacy root names until removal is
// approved (2.0, DEC-026); new consumers must use this subpath.
export {
  domAls,
  getDOMGlobals,
  installDOMGlobalGetters,
  isAsyncLocalStorageAvailable,
  createAsyncContextStore,
  getSSRRuntimeEnv,
  type AsyncContextStore,
  type DOMGlobals,
} from '@zenith/ssr';
