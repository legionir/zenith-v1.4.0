import { UI_MOTION_SHAPE } from './motion';
import { s } from '@zenith/schema';
import { strictUIOptions } from './options';
import type { DialogConfig } from './dialog';
import type { PopoverConfig } from './popover';
import type { TooltipConfig } from './tooltip';
import type { MenuConfig } from './menu';
import type { IdScope } from '@zenith/a11y';
const element = s.custom<HTMLElement>(value => !!value && typeof value === 'object' && Reflect.get(value, 'nodeType') === 1 && typeof Reflect.get(value, 'getBoundingClientRect') === 'function', 'owner-realm element');
export const UI_TARGET = s.union([s.string({ min: 1 }), element]);

const floatingShape = {
  ...UI_MOTION_SHAPE,
  trigger: s.optional(UI_TARGET), placement: s.default(s.enum(['top', 'bottom', 'left', 'right', 'top-start', 'top-end', 'bottom-start', 'bottom-end', 'left-start', 'left-end', 'right-start', 'right-end']), 'bottom'),
  offset: s.default(s.number(), 8), flip: s.default(s.boolean(), true), shift: s.default(s.boolean(), true), arrow: s.optional(element), triggerOn: s.default(s.enum(['click', 'hover', 'focus', 'manual']), 'click'), returnFocus: s.default(s.boolean(), true), role: s.optional(s.string({ min: 1 })),
};
/** @public */
export const dialogOptions = /* @__PURE__ */ strictUIOptions<DialogConfig>('DialogOptions', s.object({
  ...UI_MOTION_SHAPE, portal: s.optional(s.union([s.enum([false]), UI_TARGET])),
  modal: s.default(s.boolean(), true), role: s.default(s.enum(['dialog', 'alertdialog']), 'dialog'), closeOnEsc: s.default(s.boolean(), true), closeOnBackdrop: s.default(s.boolean(), true), initialFocus: s.optional(UI_TARGET), returnFocus: s.default(s.boolean(), true), scrollLock: s.default(s.boolean(), true), initialOpen: s.default(s.boolean(), false),
  idScope: s.optional(s.custom<IdScope>(value => !!value && typeof value === 'object' && typeof Reflect.get(value, 'next') === 'function', 'ID scope')),
}));
/** @public */
export const popoverOptions = /* @__PURE__ */ strictUIOptions<PopoverConfig>('PopoverOptions', s.object(floatingShape));
/** @public */
export const tooltipOptions = /* @__PURE__ */ strictUIOptions<TooltipConfig>('TooltipOptions', s.object({ ...floatingShape, role: s.optional(s.enum(['tooltip'])), placement: s.default(floatingShape.placement, 'top'), delay: s.default(s.duration({ min: 0, max: 2147483647 }), 500), hideDelay: s.default(s.duration({ min: 0, max: 2147483647 }), 0), disabled: s.default(s.boolean(), false) }));
/** @public */
export const menuOptions = /* @__PURE__ */ strictUIOptions<MenuConfig>('MenuOptions', s.object({ ...floatingShape, role: s.optional(s.enum(['menu'])), loop: s.default(s.boolean(), true), typeahead: s.default(s.boolean(), true), closeOnSelect: s.default(s.boolean(), true) }));

/** Internal delegation keys prevent tooltip/menu-only options leaking to popover validation. */
export const FLOATING_OPTION_KEYS: readonly (keyof PopoverConfig)[] = ['trigger', 'placement', 'offset', 'flip', 'shift', 'arrow', 'triggerOn', 'returnFocus', 'role', 'transition', 'transitionDuration'];
