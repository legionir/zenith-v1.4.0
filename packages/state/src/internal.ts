// Host/testing integration only. Deliberately use the external self-specifier:
// the root owns all implementation and nominal declarations in each format.
// Never re-export ./context or ./effect here: independently bundling those would
// create a second implementation graph. Keep legacy root names until approved.
export {
  setEffectContextStore,
  isGlobalObservationEnabled,
  getEffectPriority,
  resetStateInstanceTrackingForTesting,
  registerStateInstance,
} from '@zenith/state';
export type { EffectContext } from '@zenith/state';
