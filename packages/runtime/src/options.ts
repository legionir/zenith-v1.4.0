import { s, defineOptions } from '@zenith/schema';
import type { ErrorHandler } from '@zenith/state';
import type { ZenStartOptions } from './api-types';

/** Runtime startup configuration. @public */
export const zenStartOptions = /* @__PURE__ */ defineOptions<ZenStartOptions>(
  'ZenStartOptions',
  /* @__PURE__ */ s.object({
    devtools: /* @__PURE__ */ s.default(/* @__PURE__ */ s.boolean(), true),
    delegationRoot: /* @__PURE__ */ s.optional(
      /* @__PURE__ */ s.custom<Document | ShadowRoot | HTMLElement>(
        (v) =>
          typeof v === 'object' &&
          v !== null &&
          typeof (v as { nodeType?: unknown }).nodeType === 'number' &&
          [1, 9, 11].includes((v as { nodeType: number }).nodeType),
        'Document | ShadowRoot | HTMLElement (nodeType 1|9|11)',
      ),
    ),
    ssr: /* @__PURE__ */ s.default(
      /* @__PURE__ */ s.object({
        preloadState: /* @__PURE__ */ s.default(/* @__PURE__ */ s.boolean(), true),
        validateHydration: /* @__PURE__ */ s.default(/* @__PURE__ */ s.boolean(), false),
      }),
      { preloadState: true, validateHydration: false },
    ),
    onError: /* @__PURE__ */ s.optional(/* @__PURE__ */ s.custom<ErrorHandler>(value => typeof value === 'function', 'function')),
    strictParity: /* @__PURE__ */ s.default(/* @__PURE__ */ s.boolean(), false),
  }),
);

/** Runtime startup configuration. @public */
export const ZEN_START_OPTIONS_DEFAULTS = /* @__PURE__ */ Object.freeze({
  devtools: true,
  ssr: /* @__PURE__ */ Object.freeze({ preloadState: true, validateHydration: false }),
  strictParity: false,
}) as ZenStartOptions;
/** Runtime startup configuration. @public */
export const zenStartOptionsSchema = /* @__PURE__ */ (() => zenStartOptions.schema)();
/** Runtime startup configuration. @public */
export const resolveZenStartOptions = (opts?: unknown): ZenStartOptions =>
  zenStartOptions.resolve(opts);

