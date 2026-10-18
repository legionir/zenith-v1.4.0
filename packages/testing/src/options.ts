import { defineOptions, s } from '@zenith/schema';
import type { RenderOptions } from './render';
import type { DirectiveTestOptions } from './directive';
// Validate only the record capability. Never infer its fields or clone state,
// since state may contain signals, getters, symbols and caller-owned objects.
const stateRecord = s.custom<Record<string, unknown>>(value => value !== null && typeof value === 'object' && !Array.isArray(value), 'state record');
/** @internal */
export const renderOptions = /* @__PURE__ */ defineOptions<RenderOptions>('RenderOptions', s.object({ template: s.string(), state: s.optional(stateRecord), attachToBody: s.optional(s.boolean()) }));
/** @internal */
export const directiveTestOptions = /* @__PURE__ */ defineOptions<DirectiveTestOptions>('DirectiveTestOptions', s.object({ html: s.string(), state: s.optional(stateRecord) }));
