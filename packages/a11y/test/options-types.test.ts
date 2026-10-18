import { expectTypeOf, it } from 'vitest';
import type { FocusableOptions, FocusTrapOptions } from '../src';
it('supports callback initial focus, explicit null fallback and includeHidden without weakening DOM inference', () => {
  const options: FocusTrapOptions = { initialFocus: () => document.createElement('button') }, disabled: FocusTrapOptions = { initialFocus: () => null }, candidates: FocusableOptions = { includeHidden: true }; expectTypeOf(options).toMatchTypeOf<FocusTrapOptions>(); expectTypeOf(disabled).toMatchTypeOf<FocusTrapOptions>(); expectTypeOf(candidates).toMatchTypeOf<FocusableOptions>();
  // @ts-expect-error a focus callback must return a DOM element or null
  const invalid: FocusTrapOptions = { initialFocus: () => 'selector' }; void invalid;
});
