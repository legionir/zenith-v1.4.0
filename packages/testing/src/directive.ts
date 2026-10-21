import { directiveTestOptions } from './options';
import { flushSync } from '@zenith/scheduler';
import { developerError, ErrorCode, deprecate } from '@zenith/errors';

/** @public */
export interface DirectiveTestResult<S extends Record<string, unknown> = Record<string, unknown>> {
  container: HTMLElement;
  el: HTMLElement;
  state: S;
  flush: () => void;
  dispose: () => void;
}

/**
 * #137: ابزار تست ایزولهٔ یک دایرکتیو روی قطعهٔ HTML و وضعیت اولیه.
 * @public
 */
export interface TestDirectiveDefinition<S extends Record<string, unknown> = Record<string, unknown>> {
  name: string;
  bind: (
    el: HTMLElement,
    ctx: {
      expression: string;
      arg?: string;
      modifiers: string[];
      state: S;
      eval: (expr?: string) => unknown;
    },
  ) => (() => void) | void;
}
/** @public */
export interface DirectiveTestOptions<S extends Record<string, unknown> = Record<string, unknown>> { html: string; state?: S; }
/** @public */
export function testDirective<S extends Record<string, unknown> = Record<string, unknown>>(directive: TestDirectiveDefinition<S>, options: DirectiveTestOptions<S>): DirectiveTestResult<S>;
/** @public @deprecated Use testDirective(directive, { html, state }) (ZEN-DEPR-094; removal in 2.0). */
export function testDirective<S extends Record<string, unknown> = Record<string, unknown>>(directive: TestDirectiveDefinition<S>, html: string, state?: S): DirectiveTestResult<S>;
export function testDirective<S extends Record<string, unknown> = Record<string, unknown>>(directive: TestDirectiveDefinition<S>, optionsOrHTML: DirectiveTestOptions<S> | string, legacyState: S = {} as S): DirectiveTestResult<S> {
  let html: string, state: S;
  if (typeof optionsOrHTML === 'string' || arguments.length > 2) {
    deprecate('ZEN-DEPR-094', 'testDirective(directive, html, state)', 'testDirective(directive, { html, state })');
    html = optionsOrHTML as string; state = legacyState;
  } else {
    html = directiveTestOptions.resolve(optionsOrHTML).html;
    // S is caller-inferred. The schema checks record capability, not S's domain.
    state = optionsOrHTML.state ?? ({} as S);
  }
  if (typeof document === 'undefined') {
    throw developerError(
      'testDirective() requires a DOM environment (jsdom or browser)',
      ErrorCode.INTERNAL_DEVELOPER_ERROR,
    );
  }
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);

  const prefix = directive.name.startsWith('zen-') ? directive.name : `zen-${directive.name}`;
  const cleanups: Array<() => void> = [];
  const allEls = [container, ...Array.from(container.querySelectorAll('*'))] as HTMLElement[];
  let firstMatched: HTMLElement | null = null;

  for (const node of allEls) {
    if (!node.attributes) continue;
    for (const attr of Array.from(node.attributes)) {
      if (
        attr.name === prefix ||
        attr.name.startsWith(`${prefix}:`) ||
        attr.name.startsWith(`${prefix}.`)
      ) {
        if (!firstMatched) firstMatched = node;
        const rest = attr.name.slice(prefix.length);
        let arg: string | undefined;
        let modifiers: string[] = [];
        if (rest.startsWith(':')) {
          const parts = rest.slice(1).split('.');
          arg = parts[0];
          modifiers = parts.slice(1);
        } else if (rest.startsWith('.')) {
          modifiers = rest.slice(1).split('.');
        }
        const expression = attr.value;
        const stop = directive.bind(node, {
          expression,
          arg,
          modifiers,
          state,
          eval: (expr = expression) => {
            const key = expr.replace(/^\$/, '').trim();
            const val = state[key];
            return val && typeof val === 'object' && 'get' in val && typeof val.get === 'function' ? val.get() as unknown : val;
          },
        });
        if (typeof stop === 'function') cleanups.push(stop);
      }
    }
  }

  flushSync();
  let disposed = false;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    for (const fn of cleanups) fn();
    container.remove();
  };

  return {
    container,
    el: firstMatched ?? (container.firstElementChild as HTMLElement) ?? container,
    state,
    flush: flushSync,
    dispose,
  };
}
