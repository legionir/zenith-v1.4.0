import { untrack } from '@zenith/state';
import { compileExpression, createBindingContext } from '@zenith/expressions';
import { s, type DirectiveMeta } from '@zenith/schema';
import { toValue, type Cleanup } from '@zenith/shared';
import { cleanupScope } from './internal';
import { createReservedError } from '@zenith/errors';
import { UI_TARGET } from './surface-options';
import { DATE_PICKER_META } from './date-options';
import { processDatePicker } from './date-picker';
import { createDialog } from './dialog';
import { createPopover } from './popover';
import { createTooltip } from './tooltip';
import { bindTooltipContent } from './tooltip-content';
import { createTabs, tabsOptions } from './tabs';
import { createMenu, type MenuOptions } from './menu';
import { createAccordion, accordionOptions } from './accordion';
import { createCombobox, type ComboboxOption, type ComboboxSource } from './combobox';
import { uiConfigured, uiConfiguredBoolean, uiConfiguredDuration, uiFloating, uiMotion, uiPortal, UI_METAS } from './attributes';
import { uiValueBinding, bindUIValue, uiEventField, uiField } from './binding';
/** @public */
export interface UIBindContext { expr: string; context: Record<string, unknown>; state?: Record<string, unknown>; processChildren?(node: HTMLElement): Cleanup | void; skipChildren?(): void; notifyUpdate?(): void; }
/** @public */
export interface UIAppHost { directive(definition: { name: string; tag?: string; meta?: DirectiveMeta; bind(el: HTMLElement, context: UIBindContext): Cleanup }): Cleanup; }
function selection(value: unknown): readonly string[] {
  if (value === undefined || value === null || value === '') return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value) && value.every(item => typeof item === 'string')) return value;
  throw createReservedError('ZEN-1603');
}
/** All controllers are App-owned; no custom-element registration or DOM reads on import. @public */
export function uiPlugin() {
  return { name: 'zenith:ui', install(app: UIAppHost): Cleanup {
    const cleanup = cleanupScope(), active = new Set<Cleanup>(); let disposed = false;
    const register = (name: string, create: (el: HTMLElement, context: UIBindContext) => { dispose(): void }, options: { tag?: string } = {}) => cleanup.add(app.directive({ name, tag: options.tag, meta: name === 'date-picker' ? DATE_PICKER_META : UI_METAS.get(name), bind(el, context) {
      if (disposed || ((el.ownerDocument as Document & { __zenithSSR__?: boolean }).__zenithSSR__ && ['popover', 'tooltip', 'menu', 'combobox'].includes(name))) return () => {};
      const controller = create(el, context); if (disposed) { controller.dispose(); return () => {}; } let alive = true;
      const release = () => { if (!alive) return; alive = false; active.delete(release); controller.dispose(); }; active.add(release); return release;
    } }));
    try {
      register('date-picker', el => ({ dispose: processDatePicker(el, {}) }), { tag: 'zen-date-picker' });
      register('dialog', (el, context) => {
        const scope = cleanupScope(), binding = uiValueBinding(context);
        try {
          const input = { ...uiMotion(el, 'dialog', context), modal: uiConfiguredBoolean(el, 'zen-dialog-modal', true, context), role: uiConfigured(el, 'zen-dialog-role', s.enum(['dialog', 'alertdialog']), 'dialog', context),
            closeOnEsc: uiConfiguredBoolean(el, 'zen-dialog-close-on-esc', true, context), closeOnBackdrop: uiConfiguredBoolean(el, 'zen-dialog-close-on-backdrop', true, context), initialFocus: uiConfigured(el, 'zen-dialog-initial-focus', s.optional(UI_TARGET), undefined, context), portal: uiPortal(el, context),
            returnFocus: uiConfiguredBoolean(el, 'zen-dialog-return-focus', true, context), scrollLock: uiConfiguredBoolean(el, 'zen-dialog-scroll-lock', true, context), initialOpen: binding ? Boolean(untrack(binding.read)) : false };
          const controller = createDialog(el, input);
          scope.add(bindUIValue(el, binding, controller, value => { if (value) controller.open(); else controller.close(); }, { 'zen-dialog-open': () => true, 'zen-dialog-close': () => false })); return { dispose: scope.dispose };
        } catch (error) { try { scope.dispose(); } catch {} throw error; }
      });
      register('popover', (el, context) => {
        const binding = uiValueBinding(context), controller = createPopover(el, uiFloating(el, 'popover', 'bottom', context));
        return bindUIValue(el, binding, controller, value => { if (value) controller.open(); else controller.close(); }, { 'zen-popover-open': () => true, 'zen-popover-close': () => false });
      });
      register('tooltip', (el, context) => {
        if (context.expr.trim() && !context.skipChildren) throw createReservedError('ZEN-1603', { details: { expected: 'a host supporting BindContext.skipChildren for tooltip text ownership' } });
        const scope = cleanupScope(), config = { ...uiFloating(el, 'tooltip', 'top', context), delay: uiConfiguredDuration(el, 'zen-tooltip-delay', 500, context), hideDelay: uiConfiguredDuration(el, 'zen-tooltip-hide-delay', 0, context), disabled: uiConfiguredBoolean(el, 'zen-tooltip-disabled', false, context) };
        // Validate/create the surface before any content projection mutates DOM.
        const surface = createTooltip(el, config);
        try {
          if (context.expr.trim()) {
            const read = compileExpression(context.expr), view = createBindingContext(context.state ?? {}, context.context);
            context.skipChildren?.();
            scope.add(bindTooltipContent(el, () => read(view), () => toValue<HTMLElement | undefined>(config.arrow), () => toValue<string | HTMLElement | undefined>(config.trigger), () => disposed));
          }
          // Restore geometry/arrow styles first, then presentation snapshots. This
          // also matches removal-observer order (surface was constructed first).
          scope.add(surface); return { dispose: scope.dispose };
        } catch (error) { try { surface.dispose(); } catch {} try { scope.dispose(); } catch {} throw error; }
      });
      register('tabs', (el, context) => {
        const binding = uiValueBinding(context);
        const config = { ...uiMotion(el, 'tabs', context), orientation: uiConfigured(el, 'zen-tabs-orientation', s.enum(['horizontal', 'vertical']), 'horizontal', context), activation: uiConfigured(el, 'zen-tabs-activation', s.enum(['auto', 'manual']), 'auto', context), lazy: uiConfiguredBoolean(el, 'zen-tabs-lazy', false, context) }; let initial = true;
        const controller = createTabs(el, { ...config, value: binding ? { get: () => tabsOptions.resolve({ value: binding.read() }).value } : undefined, mountPanel: (panel: HTMLElement) => {
          if (initial) { initial = false; return; }
          const children = cleanupScope();
          try { for (const child of Array.from(panel.children)) { if (disposed) break; const release = context.processChildren?.(child as HTMLElement); if (release) children.add(release); } if (disposed) children.dispose(); return children.dispose; }
          catch (error) { try { children.dispose(); } catch {} throw error; }
        } });
        return bindUIValue(el, binding, controller, value => { if (typeof value !== 'number') throw createReservedError('ZEN-1603'); controller.setValue(value); }, { 'zen-tabs-change': event => uiEventField(event, 'index') });
      });
      register('menu', (el, context) => {
        const input: MenuOptions = { ...uiFloating(el, 'menu', 'bottom', context), loop: uiConfiguredBoolean(el, 'zen-menu-loop', true, context), typeahead: uiConfiguredBoolean(el, 'zen-menu-typeahead', true, context), closeOnSelect: uiConfiguredBoolean(el, 'zen-menu-close-on-select', true, context) };
        // Missing attributes are omissions, not competing configuration sources:
        // an authored submenu can borrow its parent's already-created controller.
        for (const key of Object.keys(input)) {
          const attribute = `zen-menu-${key.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)}`;
          if (!el.hasAttribute(attribute)) Reflect.deleteProperty(input, key);
        }
        return createMenu(el, input);
      });
      register('accordion', (el, context) => {
        const binding = uiValueBinding(context);
        const controller = createAccordion(el, { ...uiMotion(el, 'accordion', context), multiple: uiConfiguredBoolean(el, 'zen-accordion-multiple', false, context), collapsible: uiConfiguredBoolean(el, 'zen-accordion-collapsible', true, context), value: binding ? { get: () => accordionOptions.resolve({ value: binding.read() }).value } : undefined });
        return bindUIValue(el, binding, controller, next => { const value = accordionOptions.resolve({ value: next }).value; controller.setValue(value ?? []); }, { 'zen-accordion-change': event => uiEventField(event, 'value') });
      });
      register('combobox', (el, context) => {
        const binding = uiValueBinding(context), view = createBindingContext(context.state ?? {}, context.context);
        const multiple = uiConfiguredBoolean(el, 'zen-combobox-multiple', false, context), labelKey = uiConfigured(el, 'zen-combobox-option-label', s.string({ min: 1 }), 'label', context), valueKey = uiConfigured(el, 'zen-combobox-option-value', s.string({ min: 1 }), 'value', context);
        const filter = uiConfigured(el, 'zen-combobox-filter', s.enum(['contains', 'startsWith', 'none']), 'contains', context);
        const filters = {
          none: () => true,
          startsWith: (row: ComboboxOption, query: string) => row.label.toLocaleLowerCase().startsWith(query.toLocaleLowerCase()),
          contains: (row: ComboboxOption, query: string) => row.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
        };
        let previousRows: readonly ComboboxOption[] | undefined;
        const project = (rows: unknown, labelName: string, valueName: string): readonly ComboboxOption[] => {
          if (!Array.isArray(rows)) throw createReservedError('ZEN-1603');
          const projected = rows.map((row: unknown) => {
            if (typeof row === 'string') return { label: row, value: row };
            const label = uiField(row, labelName), value = uiField(row, valueName), disabled = uiField(row, 'disabled');
            if (typeof label !== 'string' || typeof value !== 'string' || (disabled !== undefined && typeof disabled !== 'boolean')) throw createReservedError('ZEN-1603');
            return { label, value, disabled };
          });
          if (previousRows && previousRows.length === projected.length && projected.every((row, i) => { const before = previousRows![i]!; return before.label === row.label && before.value === row.value && before.disabled === row.disabled; })) return previousRows;
          previousRows = projected; return projected;
        };
        const expression = el.getAttribute('zen-combobox-async') || el.getAttribute('zen-combobox-options'), read = expression ? compileExpression(expression.startsWith(':') ? expression.slice(1) : expression) : () => [];
        let loader: { source: unknown; label: string; value: string; projected: ComboboxSource } | undefined;
        const options = { get(): ComboboxSource {
          const value = read(view), labelName = toValue<string>(labelKey), valueName = toValue<string>(valueKey);
          if (el.hasAttribute('zen-combobox-async')) {
            if (typeof value !== 'function') throw createReservedError('ZEN-1603');
            if (loader && loader.source === value && loader.label === labelName && loader.value === valueName) return loader.projected;
            const projected: ComboboxSource = async (query, signal) => project(await value(query, signal), labelName, valueName);
            loader = { source: value, label: labelName, value: valueName, projected }; return projected;
          }
          return project(value, labelName, valueName);
        } };
        const controller = createCombobox(el, { ...uiMotion(el, 'combobox', context), options, value: binding ? { get: () => selection(binding.read()) } : undefined, debounce: uiConfiguredDuration(el, 'zen-combobox-debounce', 250, context), minChars: uiConfigured(el, 'zen-combobox-min-chars', s.number({ int: true, min: 0 }), 0, context), multiple, allowCustom: uiConfiguredBoolean(el, 'zen-combobox-allow-custom', false, context),
          filter: { get: () => filters[toValue<'contains' | 'startsWith' | 'none'>(filter)] } });
        return bindUIValue(el, binding, controller, value => controller.setValue(selection(value)), { 'zen-combobox-change': event => { const values = uiEventField(event, 'value'); return Array.isArray(values) ? toValue<boolean>(multiple) ? values : values[0] ?? '' : undefined; } });
      });
      return () => { if (disposed) return; disposed = true; for (const release of active) cleanup.add(release); active.clear(); cleanup.dispose(); };
    } catch (error) { disposed = true; for (const release of active) cleanup.add(release); try { cleanup.dispose(); } catch {} throw error; }
  } };
}
