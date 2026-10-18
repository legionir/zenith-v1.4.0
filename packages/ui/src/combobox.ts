import { createUIMotion, UI_MOTION_SHAPE, type UITransitionConfig } from './motion';
import type { MaybeReactive } from '@zenith/shared';
import { signal, untrack } from '@zenith/state';
import { useId } from '@zenith/a11y';
import { s } from '@zenith/schema';
import { createReservedError } from '@zenith/errors';
import { ownership, readonlyState, event, eventTarget, idScopeFor } from './internal';
import { strictUIOptions, resolveUIOptions, watchUIOptions, sameUIValue } from './options';
/** @public */
export interface ComboboxOption { label: string; value: string; disabled?: boolean; }
/** @public */
export type ComboboxSource = readonly ComboboxOption[] | ((query: string, signal: AbortSignal) => Promise<readonly ComboboxOption[]>);
/** @public */
export interface ComboboxConfig extends UITransitionConfig { options: ComboboxSource; value?: readonly string[]; debounce?: number; minChars?: number; multiple?: boolean; allowCustom?: boolean; filter?: (option: ComboboxOption, query: string) => boolean; }
/** @public */
export type ComboboxOptions = { [K in keyof ComboboxConfig]: MaybeReactive<ComboboxConfig[K]> };
function validRows(value: unknown): value is readonly ComboboxOption[] {
  return Array.isArray(value) && value.every(item => !!item && typeof item === 'object' && typeof item.label === 'string' && typeof item.value === 'string' && (item.disabled === undefined || typeof item.disabled === 'boolean')) && new Set(value.map(item => item.value)).size === value.length;
}
/** @public */
export const comboboxOptions = /* @__PURE__ */ strictUIOptions<ComboboxConfig>('ComboboxOptions', s.object({
  ...UI_MOTION_SHAPE, options: s.custom<ComboboxSource>(value => typeof value === 'function' || validRows(value), 'option rows with unique string values or an async loader'), value: s.optional(s.array(s.string())),
  debounce: s.default(s.duration({ min: 0, max: 2147483647 }), 250), minChars: s.default(s.number({ int: true, min: 0 }), 0), multiple: s.default(s.boolean(), false), allowCustom: s.default(s.boolean(), false), filter: s.optional(s.custom<NonNullable<ComboboxConfig['filter']>>(value => typeof value === 'function', 'option predicate')),
}));
/** APG active-descendant combobox; async requests and generated rows are owner-bound. @public */
export function createCombobox(el: HTMLElement, source: ComboboxOptions) {
  let options = untrack(() => resolveUIOptions(source, comboboxOptions.resolve));
  const input = el.querySelector<HTMLInputElement>('input'), list = el.querySelector<HTMLElement>('[zen-combobox-list]');
  if (!input || !list) throw createReservedError('ZEN-1601');
  const validateValue = (value: readonly string[], config: ComboboxConfig) => {
    const rows = config.options;
    if (!Array.isArray(value) || value.some(item => typeof item !== 'string') || new Set(value).size !== value.length || (!config.multiple && value.length > 1) || (typeof rows !== 'function' && !config.allowCustom && value.some(item => !rows.some(row => row.value === item && !row.disabled)))) throw createReservedError('ZEN-1603');
  };
  validateValue(options.value ?? [], options);
  const owner = ownership(el), scope = idScopeFor(el), state = signal<string[]>([...(options.value ?? [])]), loading = signal(false);
  let values: readonly ComboboxOption[] = [], active = -1, generation = 0, selection = 0, resolvedQuery: string | undefined;
  let request: AbortController | undefined, timer: ReturnType<typeof setTimeout> | undefined;
  const originalChildren = Array.from(list.childNodes), originalValue = input.value;
  owner.add(() => { generation++; selection++; const previous = request; request = undefined; clearTimeout(timer); try { previous?.abort(); } finally { try { list.replaceChildren(...originalChildren); input.value = originalValue; } finally { state.dispose(); loading.dispose(); } } });
  const motion = createUIMotion(list, owner, () => ({ ...options, transition: options.transition ?? el.getAttribute('zen-transition') ?? undefined }));
  const busy = (value: boolean) => { if (owner.disposed) return; owner.attr(input, 'aria-busy', value ? 'true' : null); loading.set(value); };
  const hide = (animateLeave = true) => { owner.attr(input, 'aria-expanded', 'false'); motion.hide(animateLeave); owner.attr(input, 'aria-activedescendant', null); active = -1; };
  const cancel = () => { const version = ++generation; clearTimeout(timer); timer = undefined; const previous = request; request = undefined; previous?.abort(); return version; };
  const close = () => { if (owner.disposed) return; hide(); const version = cancel(); if (!owner.disposed && version === generation) busy(false); };
  const render = () => {
    if (owner.disposed) return;
    const fragment = el.ownerDocument.createDocumentFragment();
    values.forEach((option, index) => {
      const item = el.ownerDocument.createElement('div'); item.id = `${list.id}-option-${index}`;
      item.setAttribute('role', 'option'); item.setAttribute('data-zen-option', String(index)); item.setAttribute('aria-selected', String(state.peek().includes(option.value)));
      if (option.disabled) item.setAttribute('aria-disabled', 'true'); item.textContent = option.label; fragment.append(item);
    }); list.replaceChildren(fragment);
  };
  const syncInput = () => {
    if (owner.disposed || options.multiple) return;
    const value = state.peek()[0]; const rows = typeof options.options === 'function' ? values : options.options;
    input.value = value === undefined ? '' : rows.find(row => row.value === value)?.label ?? value;
  };
  const setValue = (value: readonly string[], notify = true) => {
    if (owner.disposed) return; validateValue(value, options); if (sameUIValue(value, state.peek())) { syncInput(); if (!options.multiple) hide(); return; }
    const version = ++selection, lease = cancel(); if (owner.disposed || selection !== version || lease !== generation) return;
    busy(false); if (owner.disposed || selection !== version || lease !== generation) return;
    state.set([...value]); if (owner.disposed || selection !== version || lease !== generation) return;
    syncInput(); render(); if (!options.multiple) hide();
    if (notify && !owner.disposed && selection === version) event(el, 'zen-combobox-change', { value: [...state.peek()] });
  };
  const select = (value: string) => {
    if (owner.disposed || input.disabled || input.readOnly) return;
    const option = values.find(item => item.value === value);
    if (option?.disabled || (!option && !options.allowCustom)) throw createReservedError('ZEN-1603');
    setValue(options.multiple ? state.peek().includes(value) ? state.peek().filter(item => item !== value) : [...state.peek(), value] : [value]);
  };
  const search = async (query: string) => {
    if (owner.disposed || input.disabled) return;
    clearTimeout(timer); timer = undefined;
    const config = options, lease = ++generation, previous = request, current = new AbortController(); request = current;
    const valid = () => !owner.disposed && lease === generation && !current.signal.aborted;
    previous?.abort(); if (!valid()) return;
    if (query.length < (config.minChars ?? 0)) { values = []; resolvedQuery = undefined; request = undefined; render(); hide(); busy(false); return; }
    hide(); busy(true); if (!valid()) return;
    try {
      const all = typeof config.options === 'function' ? await config.options(query, current.signal) : config.options;
      if (!valid()) return;
      if (!validRows(all)) throw createReservedError('ZEN-1603');
      const next: ComboboxOption[] = [];
      for (const option of all) { if (!valid()) return; if (config.filter ? config.filter(option, query) : option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase())) next.push({ ...option }); }
      if (!valid()) return;
      values = next; resolvedQuery = query; active = -1; render(); if (!valid()) return;
      motion.show(); owner.attr(input, 'aria-expanded', 'true'); motion.enter();
    } catch { if (valid()) { values = []; resolvedQuery = undefined; render(); hide(); } }
    finally { if (valid()) { request = undefined; busy(false); } }
  };
  const activate = (index: number) => {
    if (owner.disposed) return; active = index;
    if (input.getAttribute('aria-expanded') !== 'true') { motion.show(); owner.attr(input, 'aria-expanded', 'true'); motion.enter(); } owner.attr(input, 'aria-activedescendant', active >= 0 ? `${list.id}-option-${active}` : null);
    if (active >= 0) list.children[active]?.scrollIntoView?.({ block: 'nearest' });
  };
  try {
    if (!list.id) owner.attr(list, 'id', useId({ prefix: 'combobox-list', scope }));
    owner.attr(input, 'role', 'combobox'); owner.attr(input, 'aria-autocomplete', 'list'); owner.attr(input, 'aria-controls', list.id); owner.attr(list, 'role', 'listbox'); owner.attr(list, 'aria-multiselectable', options.multiple ? 'true' : null);
    owner.on(list, 'mousedown', e => {
      if (input.getAttribute('aria-expanded') !== 'true') return;
      const row = eventTarget(e)?.closest<HTMLElement>('[data-zen-option]'); if (!row || row.parentElement !== list) return;
      e.preventDefault(); const option = values[Number(row.getAttribute('data-zen-option'))]; if (option && !option.disabled) select(option.value);
    });
    owner.on(input, 'input', e => {
      if ('isComposing' in e && e.isComposing) return;
      close(); if (owner.disposed || input.disabled || input.readOnly) return;
      const query = input.value, lease = generation; event(el, 'zen-combobox-input', { query });
      if (owner.disposed || lease !== generation) return;
      timer = setTimeout(() => { if (!owner.disposed && lease === generation) void search(query); }, options.debounce ?? 250);
    });
    owner.on(input, 'keydown', e => {
      if (e.isComposing || input.disabled) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); const step = e.key === 'ArrowDown' ? 1 : -1;
        if (!values.length || resolvedQuery !== input.value) { const pending = search(input.value), lease = generation; void pending.then(() => { if (!owner.disposed && lease === generation && input.getAttribute('aria-expanded') === 'true') { const indices = values.flatMap((row, i) => row.disabled ? [] : [i]); activate((step > 0 ? indices[0] : indices[indices.length - 1]) ?? -1); } }); return; }
        let next = active < 0 ? step > 0 ? -1 : 0 : active;
        for (let i = 0; i < values.length; i++) { next = (next + step + values.length) % values.length; if (!values[next]?.disabled) break; }
        activate(values[next]?.disabled ? -1 : next);
      } else if ((e.key === 'Home' || e.key === 'End') && input.getAttribute('aria-expanded') === 'true') {
        e.preventDefault(); const indices = values.flatMap((row, i) => row.disabled ? [] : [i]); activate((e.key === 'Home' ? indices[0] : indices[indices.length - 1]) ?? -1);
      } else if (e.key === 'Enter') {
        if (input.getAttribute('aria-expanded') === 'true' && active >= 0 && values[active]) { e.preventDefault(); select(values[active]!.value); }
        else if (options.allowCustom) { e.preventDefault(); select(input.value); }
      } else if (e.key === 'Tab') close();
    });
    owner.on(el.ownerDocument, 'mousedown', e => { if (e.target && !el.contains(e.target as Node)) close(); }); owner.on(el, 'focusout', e => { if (!e.relatedTarget || !el.contains(e.relatedTarget as Node)) close(); });
    hide(false); if (options.value !== undefined) syncInput();
    if (!owner.disposed) owner.add(watchUIOptions(source, comboboxOptions.resolve, options, next => {
      if (owner.disposed) return;
      const selected = !sameUIValue(next.value, options.value) ? next.value ?? [] : next.multiple ? state.peek() : state.peek().slice(0, 1); validateValue(selected, next);
      const motionChanged = options.transition !== next.transition || options.transitionDuration !== next.transitionDuration; options = next; if (motionChanged) motion.finish(); const version = cancel(); if (owner.disposed || version !== generation) return; resolvedQuery = undefined; values = []; hide(); busy(false); if (owner.disposed) return;
      owner.attr(list, 'aria-multiselectable', next.multiple ? 'true' : null); setValue(selected, false); render();
    }));
  } catch (error) { try { owner.dispose(); } catch {} throw error; }
  return { search, select, setValue: (value: readonly string[]) => setValue(value, false), close, state: readonlyState(state), loading: readonlyState(loading), dispose: owner.dispose };
}
