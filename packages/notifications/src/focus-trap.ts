// Legacy dialog names are facades over the same shared focus engine.
import { createFocusTrap, type FocusTrap, type FocusTrapOptions } from '@zenith/a11y';
export type DialogFocusTrap = FocusTrap;
export type DialogFocusTrapOptions = FocusTrapOptions;
export function createDialogFocusTrap(container: HTMLElement, options: DialogFocusTrapOptions = {}): DialogFocusTrap {
  return createFocusTrap(container, { ...options, escapeDeactivates: false });
}
