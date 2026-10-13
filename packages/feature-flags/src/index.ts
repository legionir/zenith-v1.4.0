// packages/feature-flags/src/index.ts — @zenith/feature-flags (#168) L2 barrel.
export {
  createFlags,
  flagsPlugin,
  stableHashRollout,
  DEFAULTS,
  type Flags,
  type FlagsOptions,
  type FlagValue,
  type FlagSource,
  type FlagContext,
} from './flags';

export {
  processFlag,
  processFlagVariant,
  setActiveFlags,
  getActiveFlags,
} from './directives';
