// packages/theme/src/index.ts — @zenith/theme (#161) L2 barrel.
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

export {
  processThemeToggle,
  processThemeMode,
  processDir,
  setActiveTheme,
  getActiveTheme,
} from './directives';

export { themeOptionsSchema, resolveThemeOptions } from './options';
