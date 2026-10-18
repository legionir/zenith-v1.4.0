import { untrack } from '@zenith/state';
import { isGlobalObservationEnabled } from '@zenith/state/internal';

interface TelemetryRuntime {
  elementIds: WeakMap<HTMLElement, number>;
  nextElementId: number;
  pending: WeakSet<HTMLElement>;
}
const TELEMETRY = Symbol.for('zenith.runtime.telemetry.v1');
// Private realm-owned metadata protocol, not a cast of consumer payloads or a
// constructor replacement. Duplicate/HMR modules retain actual element identity.
const globals = globalThis as unknown as Record<symbol, TelemetryRuntime | undefined>;
const runtime = globals[TELEMETRY] ??= { elementIds: new WeakMap(), nextElementId: 0, pending: new WeakSet() };
function elementId(element: HTMLElement): number {
  let id = runtime.elementIds.get(element);
  if (id === undefined) { id = ++runtime.nextElementId; runtime.elementIds.set(element, id); }
  return id;
}
function observationAllowed(): boolean {
  return isGlobalObservationEnabled() && Reflect.get(globalThis, '__ZENITH_DEVTOOLS__') !== false && Reflect.get(globalThis, '__ZENITH_SSR__') !== true &&
    (typeof document === 'undefined' || Reflect.get(document, '__zenithSSR__') !== true);
}

/**
 * Best-effort graph capture: actual native methods, real receiver, ignored result.
 * Discovery, getters and invocation are all guarded and untracked. No fabricated
 * WalkerGraph interface is asserted over a foreign global. @internal
 */
export function trackDirective(element: HTMLElement, input: { directiveType: string; expression: string }): void {
  untrack(() => {
    try {
      if (!observationAllowed() || typeof window === 'undefined' || runtime.pending.has(element)) return;
      runtime.pending.add(element);
      try {
        const hook: unknown = Reflect.get(window, '__ZENITH__');
        if (hook === null || (typeof hook !== 'object' && typeof hook !== 'function')) return;
        const invoke = (name: string, operands: unknown[]): boolean => {
          const method: unknown = Reflect.get(hook, name);
          if (!observationAllowed() || typeof method !== 'function') return false;
          Reflect.apply(method, hook, operands); return true;
        };
        const optionsProtocol = Reflect.get(hook, 'graphProtocolVersion') === 2;
        const { directiveType, expression } = input;
        const id = elementId(element), tag = element.tagName.toLowerCase();
        const directive = `dir:${directiveType}:${id}`, effect = `eff:${directive}`, dom = `dom:${tag}#${id}`;
        const selector = `${tag}[data-zid="${id}"]`;
        if (!invoke('addDirective', optionsProtocol ? [directive, { directiveType, elementSelector: selector, expression }] : [directive, directiveType, selector, expression])) return;
        if (!invoke('addEffect', [effect, []]) || !invoke('addDom', [dom, tag])) return;
        if (!invoke('recordWrite', [effect, directive]) || !invoke('recordDomUpdate', [directive, dom])) return;
        const seen = new Set<string>();
        for (const match of expression.match(/\$([a-zA-Z_]\w*)/g) ?? []) {
          const name = match.slice(1); if (seen.has(name)) continue;
          seen.add(name);
          if (!invoke('addSignal', optionsProtocol ? [name, { name, value: undefined }] : [name, name, undefined]) || !invoke('recordRead', [name, effect])) return;
        }
      } finally { runtime.pending.delete(element); }
    } catch { /* diagnostics never interrupt binding */ }
  });
}
