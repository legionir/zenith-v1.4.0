import { expectTypeOf, it } from 'vitest';
import { signal } from '@zenith/state';
import type { TabsOptions, AccordionOptions, ComboboxOptions, ComboboxOption, DialogOptions, PopoverOptions, TooltipOptions, MenuOptions, PortalOptions } from '../src';

it('preserves literal/readable collection options and callback inference', () => {
  const tabs: TabsOptions = { orientation: signal<'horizontal' | 'vertical'>('vertical'), value: signal(1), mountPanel(panel, index) { expectTypeOf(panel).toEqualTypeOf<HTMLElement>(); expectTypeOf(index).toEqualTypeOf<number>(); } };
  const accordion: AccordionOptions = { multiple: signal(true), value: signal<readonly number[]>([0]) };
  const combo: ComboboxOptions = { options: async (query, signal) => { expectTypeOf(query).toEqualTypeOf<string>(); expectTypeOf(signal).toEqualTypeOf<AbortSignal>(); return [{ label: query, value: query }]; }, filter: (row, query) => { expectTypeOf(row).toEqualTypeOf<ComboboxOption>(); expectTypeOf(query).toEqualTypeOf<string>(); return !row.disabled; } };
  expectTypeOf(tabs).toMatchTypeOf<TabsOptions>(); expectTypeOf(accordion).toMatchTypeOf<AccordionOptions>(); expectTypeOf(combo).toMatchTypeOf<ComboboxOptions>();
});

it('accepts concrete and readable surface configuration without double wrapping', () => {
  const dialog: DialogOptions = { modal: signal(true), portal: signal<string | HTMLElement | false>(false), initialFocus: signal('#first'), transition: signal<string | false>('fade') };
  const popover: PopoverOptions = { trigger: signal('#trigger'), placement: signal<'top' | 'bottom'>('bottom'), arrow: signal<HTMLElement | undefined>(undefined) };
  const tooltip: TooltipOptions = { delay: signal(50), disabled: signal(false), trigger: '#help' };
  const menu: MenuOptions = { loop: signal(true), typeahead: signal(false), closeOnSelect: signal(true), trigger: '#menu' };
  expectTypeOf(dialog).toMatchTypeOf<DialogOptions>(); expectTypeOf(popover).toMatchTypeOf<PopoverOptions>(); expectTypeOf(tooltip).toMatchTypeOf<TooltipOptions>(); expectTypeOf(menu).toMatchTypeOf<MenuOptions>();
});

it('accepts concrete/readable portal selectors and elements without widening the target', () => {
  const portal: PortalOptions = { target: signal<string | HTMLElement>('body') }; expectTypeOf(portal).toMatchTypeOf<PortalOptions>();
  // @ts-expect-error portals require a destination; false is a Dialog policy, not a target
  const invalid: PortalOptions = { target: false }; void invalid;
});

it('allows legacy hosts to omit owned-child support while exposing the capability to modern hosts', () => {
  type Context = import('../src').UIBindContext;
  const legacy: Context = { expr: '', context: {} };
  const owned: Context = { expr: '"Tip"', context: {}, skipChildren() {} };
  expectTypeOf(legacy).toMatchTypeOf<Context>(); expectTypeOf(owned.skipChildren).toEqualTypeOf<(() => void) | undefined>();
});

it('narrows fixed surface roles instead of accepting a silently overridden role', () => {
  const tooltip: TooltipOptions = { role: 'tooltip' }, menu: MenuOptions = { role: 'menu' };
  expectTypeOf(tooltip).toMatchTypeOf<TooltipOptions>(); expectTypeOf(menu).toMatchTypeOf<MenuOptions>();
  // @ts-expect-error Tooltip has a fixed descriptive role
  const invalidTooltip: TooltipOptions = { role: 'dialog' }; void invalidTooltip;
  // @ts-expect-error Menu has a fixed menu role
  const invalidMenu: MenuOptions = { role: 'listbox' }; void invalidMenu;
});
