import type { DirectiveMeta } from '@zenith/schema';
import { createDisposer, type Cleanup } from '@zenith/shared';
import { bindRealtime, type RealtimeBindContext } from './directive';
import type { RealtimeOptions } from './types';

/** Structural host avoids an L2 -> runtime-core dependency. @public */
export interface RealtimeAppHost {
  directive(definition: {
    name: string;
    structural: boolean;
    stateOutput: boolean;
    priority: number;
    meta: DirectiveMeta;
    bind(el: HTMLElement, context: RealtimeBindContext): Cleanup;
  }): Cleanup;
}
/** @public */
export const REALTIME_DIRECTIVE_META: readonly DirectiveMeta[] = Object.freeze(['ws', 'sse'].map(name => Object.freeze({
  name: `zen-${name}`,
  description: 'Scoped realtime transport state; no connection during SSR.',
  syntax: `<section zen-${name}="url" zen-state="data"></section>`,
  attributes: Object.freeze(['zen-state', 'zen-realtime-topic', 'zen-realtime-reconnect', 'zen-realtime-protocols', 'zen-realtime-parse', 'zen-realtime-history', 'zen-realtime-send', 'zen-realtime-options']),
})));

/** Each installed App owns its directive bindings and clients. @public */
export function realtimePlugin(options: Omit<RealtimeOptions, 'url' | 'transport'> = {}) {
  return {
    name: 'zenith:realtime',
    install(app: RealtimeAppHost): Cleanup {
      const cleanup = createDisposer();
      const bindings = new Set<Cleanup>();
      let disposed = false;
      for (const meta of REALTIME_DIRECTIVE_META) {
        cleanup.add(app.directive({
          name: meta.name, meta, priority: 850, structural: true, stateOutput: true,
          bind(el, context) {
            if (disposed) return () => {};
            let active = true;
            let release: Cleanup = () => {};
            const owned = () => { if (!active) return; active = false; bindings.delete(owned); release(); };
            release = bindRealtime(el, { ...context, options, onDispose: () => { active = false; bindings.delete(owned); context.onDispose?.(); } });
            if (active) bindings.add(owned);
            return owned;
          },
        }));
      }
      return () => {
        if (disposed) return;
        disposed = true;
        for (const binding of bindings) cleanup.add(binding);
        bindings.clear();
        cleanup.dispose();
      };
    },
  };
}
