// packages/runtime/src/directives/stateful-button.ts
//
// FEATURE (v1.2.0): zen-button — Stateful button directive.
//
// Replaces the element it is applied to with a real <button> element and
// drives it through an explicit state machine: idle → loading → (success |
// error) → idle. The button invokes a registered Zenith action by name and
// reflects the action's progress through visual states.
//
// Usage:
//   <span zen-button="save" data-loading-text="Saving...">Save</span>
//
// The text content of the original element becomes the idle label. The
// `data-loading-text` attribute (optional) overrides the label shown while
// the action is in flight. After success/error the button automatically
// returns to idle after a short delay.
//
// Styling:
//   Default CSS is injected once per document via `injectDefaultStyles`.
//   The CSS provides a spinner animation, a success (green) color, an error
//   (red) color, and RTL-aware padding/margins.
//
// SSR safety:
//   - All DOM access is guarded. The directive is a no-op when `document`
//     is unavailable or the element has no parent.

import { signal, type Signal } from '@zenith/state';
import { getAction } from '@zenith/actions';
import { reportError } from '@zenith/error-boundary';

type ButtonState = 'idle' | 'loading' | 'success' | 'error';

const STYLE_ID = 'zenith-stateful-button-styles';

/**
 * Inject the default CSS for stateful buttons once per document. Idempotent.
 *
 * The CSS is intentionally minimal so users can override it. It provides:
 *   - A spinner keyframe used in the loading state.
 *   - Success and error color modifiers.
 *   - RTL-aware padding/margins using [dir="rtl"] selectors.
 */
function injectDefaultStyles(): void {
  if (typeof document === 'undefined' || !document.head) return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
@keyframes zenith-stateful-button-spin {
  to { transform: rotate(360deg); }
}
.zenith-stateful-button {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  cursor: pointer;
}
.zenith-stateful-button[disabled] {
  cursor: progress;
  opacity: 0.85;
}
.zenith-stateful-button .zenith-stateful-button__spinner {
  display: inline-block;
  width: 1em;
  height: 1em;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: zenith-stateful-button-spin 0.7s linear infinite;
}
.zenith-stateful-button[data-state="success"] {
  color: #15803d;
  border-color: #15803d;
}
.zenith-stateful-button[data-state="error"] {
  color: #b91c1c;
  border-color: #b91c1c;
}
[dir="rtl"] .zenith-stateful-button {
  /* RTL-aware spacing: swap spinner/label gap direction is handled by
     flex's row direction, but we add a small margin on the leading edge. */
  padding-right: 0.5em;
  padding-left: 0.5em;
}
`.trim();
  document.head.appendChild(style);
}

/**
 * Process the `zen-button` directive.
 *
 * @param el          The element carrying `zen-button` (will be replaced).
 * @param actionName  Name of a registered action to invoke on click.
 * @param loadingText Optional label to show while loading.
 * @param context     The current reactive context.
 * @returns Dispose function — removes the button and cleans up timers.
 */
export function processStatefulButton(
  el: HTMLElement,
  actionName: string,
  loadingText: string | null,
  context: Record<string, any>,
): () => void {
  if (typeof document === 'undefined') {
    return () => {};
  }
  const parent = el.parentElement;
  if (!parent) {
    return () => {};
  }

  injectDefaultStyles();

  // Build the real button element.
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'zenith-stateful-button';

  // The original element's text content becomes the idle label.
  const idleLabel = (el.textContent || '').trim() || 'Submit';
  const loadingLabel = (loadingText && loadingText.trim()) || idleLabel;

  // Copy over helpful attributes from the original element.
  for (const attr of Array.from(el.attributes)) {
    if (attr.name === 'zen-button' || attr.name === 'data-loading-text') continue;
    if (attr.name.startsWith('zen-')) continue; // skip other directives
    try {
      button.setAttribute(attr.name, attr.value);
    } catch {
      // Some attributes may not be settable on a <button>; ignore.
    }
  }

  const labelSpan = document.createElement('span');
  labelSpan.className = 'zenith-stateful-button__label';
  labelSpan.textContent = idleLabel;

  const spinnerSpan = document.createElement('span');
  spinnerSpan.className = 'zenith-stateful-button__spinner';
  spinnerSpan.style.display = 'none';

  button.appendChild(spinnerSpan);
  button.appendChild(labelSpan);

  parent.replaceChild(button, el);
  el.removeAttribute('zen-button');

  // ── State machine ──
  const stateSignal: Signal<ButtonState> = signal('idle');
  let resetTimer: ReturnType<typeof setTimeout> | null = null;

  const setLabel = (text: string): void => {
    labelSpan.textContent = text;
  };

  const setState = (next: ButtonState): void => {
    stateSignal.set(next);
    button.setAttribute('data-state', next);
    if (next === 'loading') {
      button.disabled = true;
      spinnerSpan.style.display = '';
      setLabel(loadingLabel);
    } else if (next === 'success') {
      button.disabled = false;
      spinnerSpan.style.display = 'none';
      setLabel('✓');
    } else if (next === 'error') {
      button.disabled = false;
      spinnerSpan.style.display = 'none';
      setLabel('✕');
    } else {
      button.disabled = false;
      spinnerSpan.style.display = 'none';
      setLabel(idleLabel);
    }
  };

  const onClick = async (event: MouseEvent): Promise<void> => {
    if (stateSignal.get() === 'loading') return; // ignore double-clicks
    const action = getAction(actionName);
    if (!action) {
      reportError(
        new Error(`[zen-button] Action "${actionName}" is not registered.`),
        'directive',
        { element: button },
      );
      setState('error');
      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = setTimeout(() => setState('idle'), 1500);
      return;
    }
    setState('loading');
    try {
      await action({ state: context as any, event, element: button });
      setState('success');
    } catch (err) {
      reportError(err as Error, 'action', { element: button });
      setState('error');
    }
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => setState('idle'), 1500);
  };

  button.addEventListener('click', onClick);

  return () => {
    if (resetTimer) {
      clearTimeout(resetTimer);
      resetTimer = null;
    }
    button.removeEventListener('click', onClick);
    if (button.parentNode) {
      button.parentNode.removeChild(button);
    }
  };
}
