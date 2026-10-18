import { s, defineOptions } from '@zenith/schema';
import type { ZenithError } from '@zenith/errors';
import type { Logger } from '@zenith/logger';
import type { AppOptions, Plugin, PluginEntry } from './types';

/** @public */
export const appOptions = defineOptions<AppOptions>(
  'AppOptions',
  s.object({
    state: s.default(s.record(s.custom<unknown>(() => true, 'state value')), {}),
    plugins: s.default(
      s.array(
        s.custom<PluginEntry>(
          (v) =>
            (typeof v === 'object' &&
              v !== null &&
              !Array.isArray(v) &&
              typeof (v as Plugin).name === 'string' &&
              typeof (v as Plugin).install === 'function') ||
            (Array.isArray(v) &&
              v.length >= 1 &&
              typeof v[0] === 'object' &&
              v[0] !== null &&
              typeof (v[0] as Plugin).name === 'string' &&
              typeof (v[0] as Plugin).install === 'function'),
          'Plugin | [Plugin, options]',
        ),
      ),
      [],
    ),
    devtools: s.default(s.boolean(), true),
    delegationRoot: s.optional(
      s.custom<Document | ShadowRoot | HTMLElement>(
        (v) =>
          typeof v === 'object' &&
          v !== null &&
          typeof (v as { nodeType?: unknown }).nodeType === 'number' &&
          [1, 9, 11].includes((v as { nodeType: number }).nodeType),
        'Document | ShadowRoot | HTMLElement (nodeType 1|9|11)',
      ),
    ),
    strictParity: s.default(s.boolean(), false),
    logger: s.optional(
      s.custom<Logger>(
        (v) =>
          typeof v === 'object' &&
          v !== null &&
          typeof (v as { warn?: unknown }).warn === 'function' &&
          typeof (v as { error?: unknown }).error === 'function',
        'Logger',
      ),
    ),
    errorHandler: s.optional(s.custom<(err: ZenithError) => void>(value => typeof value === 'function', 'function')),
    warnHandler: s.optional(
      s.custom<(msg: string, ctx?: Record<string, unknown>) => void>(value => typeof value === 'function', 'function'),
    ),
    idPrefix: s.default(s.string({ min: 1 }), 'zen'),
    ssr: s.default(
      s.object({
        preloadState: s.default(s.boolean(), true),
        validateHydration: s.default(s.boolean(), false),
      }),
      { preloadState: true, validateHydration: false },
    ),
  }),
);

/** @public */
export const APP_OPTIONS_DEFAULTS = appOptions.DEFAULTS;
/** @public */
export const appOptionsSchema = appOptions.schema;
/** @public */
export const resolveAppOptions = (opts?: unknown): AppOptions => appOptions.resolve(opts);

