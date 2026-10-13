// packages/theme/src/options.ts — schema گزینه‌های theme (#161, #52).
import { s, defineOptions } from '@zenith/schema';
import { DEFAULTS, type ThemeOptions } from './theme';

export const themeOptionsSchema = defineOptions<ThemeOptions>(
  'ThemeOptions',
  s.object({
    defaultMode: s.default(s.enum(['light', 'dark', 'system'] as const), DEFAULTS.defaultMode),
    storageKey: s.default(s.string(), DEFAULTS.storageKey),
    attribute: s.default(s.enum(['data-theme', 'class'] as const), DEFAULTS.attribute),
    tokenPrefix: s.default(s.string(), DEFAULTS.tokenPrefix),
    transitionDisabledOnChange: s.default(s.boolean(), DEFAULTS.transitionDisabledOnChange),
    cookie: s.default(s.boolean(), DEFAULTS.cookie),
  }),
);

export function resolveThemeOptions(input: ThemeOptions = {}): ThemeOptions {
  return { ...DEFAULTS, ...input };
}
