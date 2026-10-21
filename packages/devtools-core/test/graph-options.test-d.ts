import { expectTypeOf } from 'vitest';
import { RuntimeGraph, type GraphSignalOptions, type GraphDirectiveOptions, type GraphSnapshot } from '../src';
const graph = new RuntimeGraph(); const payload = { actual: Symbol('value') };
graph.addSignal('id', { name: 'name', value: payload }); graph.addDirective('dir', { directiveType: 'zen-text', elementSelector: '#id', expression: '$value' });
expectTypeOf(graph.getGraph()).toEqualTypeOf<GraphSnapshot>();
expectTypeOf<GraphSignalOptions['value']>().toEqualTypeOf<unknown>();
const options: GraphDirectiveOptions = { directiveType: 'zen-if', elementSelector: 'main' }; graph.addDirective('dir', options);
// @ts-expect-error Directive metadata does not fabricate a missing selector.
graph.addDirective('bad', { directiveType: 'zen-if' });
// @ts-expect-error Signal names are strings, even though payloads remain unknown.
graph.addSignal('bad', { name: 2 });
// @ts-expect-error Snapshot payloads do not become arbitrary application types.
const invented: string = graph.getGraph().nodes[0]!.value;
void invented;
// Deprecated compatibility stays callable while the candidate is reviewed.
graph.addSignal('legacy', 'name', payload); graph.addDirective('legacy-dir', 'zen-text', '#legacy', '$value');
