// packages/theme/src/index.ts — @zenith/theme (#161) L2 barrel.
/** @public */
export {
  createTheme,
  themeInitScript,
  themePlugin,
  DEFAULTS,
  type Theme,
  type ThemeMode,
  type ThemeDir,
  type ThemeOptions,
  type ThemeTokenSet,
} from './theme';

/** @public */
export {
  processThemeToggle,
  processThemeMode,
  processDir,
  setActiveTheme,
  getActiveTheme,
} from './directives';

/** @public */
export { themeOptionsSchema, resolveThemeOptions } from './options';
