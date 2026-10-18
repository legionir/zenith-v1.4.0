import { expectTypeOf } from 'vitest';
import { computed, signal } from '@zenith/state';
import { registerPanelSignal, type DevToolsSignalInfo, type DevToolsStateChange, type ZenithDevtoolsHook } from '../src';
expectTypeOf<DevToolsSignalInfo['value']>().toEqualTypeOf<unknown>();
expectTypeOf<DevToolsStateChange['newValue']>().toEqualTypeOf<unknown>();
expectTypeOf<Parameters<ZenithDevtoolsHook['addSignal']>[2]>().toEqualTypeOf<unknown>();
registerPanelSignal(signal('specific'));
registerPanelSignal(computed(() => 'readonly'));
// @ts-expect-error Registration requires a genuine read capability.
registerPanelSignal({ value: 1 });

import { recordPanelStateChange, type PanelStateChangeOptions, type StaticForOptions, type ResourceDestroyOptions } from '../src';
const change: PanelStateChangeOptions = { oldValue: { actual: true }, newValue: 1 };
recordPanelStateChange('id', change); recordPanelStateChange('id', undefined, undefined);
expectTypeOf<PanelStateChangeOptions['newValue']>().toEqualTypeOf<unknown>();
const staticOptions: StaticForOptions = { expr: '$values', itemCount: 1 };
const resourceOptions: ResourceDestroyOptions = { url: '/actual' };
function actualHook(hook: ZenithDevtoolsHook) {
  hook.addSignal('id', { name: 'specific', value: Symbol('actual') });
  hook.addDirective('dir', { directiveType: 'zen-text', elementSelector: '#actual' });
  hook.addStaticFor('static', staticOptions); hook.recordResourceDestroy('resource', resourceOptions);
  // @ts-expect-error Typed metadata cannot fabricate a required item count.
  hook.addStaticFor('invalid', { expr: '$values' });
  // @ts-expect-error The canonical change object must contain both operands.
  recordPanelStateChange('invalid', { oldValue: 1 });
}
void actualHook;
