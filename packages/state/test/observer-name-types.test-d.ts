import { expectTypeOf } from 'vitest';
import { signal, nameSignal, registerSignal, setSignalObserver, type ReadonlySignal, type InspectedSignal } from '../src';

const readonly: ReadonlySignal<number> = signal(1);
expectTypeOf(registerSignal(readonly)).toEqualTypeOf<number>();
nameSignal(readonly, 'readable');
const inspected: InspectedSignal = readonly;
nameSignal(inspected, 'unknown readable');
const off = setSignalObserver({
  onName(value) {
    void value.get();
    // @ts-expect-error A naming notification does not grant a write capability.
    value.set('not permitted');
    // @ts-expect-error Nor does it grant a nominal writable class identity.
    value.update(() => 1);
  },
});
off();
