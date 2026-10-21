import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { extractPackageExports } from '../generate-api-docs.mjs';
const temporary = [];
afterEach(() => { for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true }); });
function source(files) {
  const root = mkdtempSync(join(tmpdir(), 'zenith-release-source-')); temporary.push(root);
  for (const [file, text] of Object.entries(files)) { const target = join(root, file); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, text); }
  return join(root, 'index.ts');
}
it('uses one explicit tag/deprecation policy for docs and source exports', () => {
  const exports = extractPackageExports(source({ 'index.ts': 'export { legacy as alias, missing } from "./leaf.js";', 'leaf.ts': '/** @public @deprecated Use next. */ export function legacy(): unknown { return 1; } export const missing = 1;' }));
  expect(exports.get('alias')).toMatchObject({ tag: 'public', deprecated: true });
  expect(exports.get('missing').tag).toBe('unclassified');
});
it('retains a namespace export rather than flattening its names into the root', () => {
  const exports = extractPackageExports(source({ 'index.ts': '/** @beta */ export * as preview from "./leaf.js";', 'leaf.ts': '/** @public */ export const value = 1;' }));
  expect([...exports.keys()]).toEqual(['preview']); expect(exports.get('preview').tag).toBe('beta');
});
it('does not mark the canonical function deprecated just because it has a legacy overload', () => {
  const exports = extractPackageExports(source({ 'index.ts': '/** @public */ export function create(host: string, options: object): void; /** @public @deprecated Use options. */ export function create(host: string,width: number,height: number): void; export function create(host: string, value: object | number, height?: number): void {}' }));
  expect(exports.get('create')).toMatchObject({ tag: 'public', deprecated: false });
});
it('does not silently promote internal declarations through public facade annotations', () => {
  const exports = extractPackageExports(source({ 'index.ts': '/** @public */ export { hidden as visible } from "./leaf.js";', 'leaf.ts': '/** @internal */ export function hidden(): void {}' }));
  expect(exports.get('visible').tag).toBe('conflicting');
});
it('gives explicit exports precedence over star facades regardless of statement order', () => {
  const exports = extractPackageExports(source({ 'index.ts': 'export * from "./leaf.js"; /** @public @deprecated Use next. */ export { value } from "./leaf.js";', 'leaf.ts': '/** @public */ export const value = 1;' }));
  expect(exports.get('value')).toMatchObject({ tag: 'public', deprecated: true });
});
it('follows compiler/testing/security implementation leaves without retiring their canonical overloads or leaking private owners', () => {
  const roots = {
    compiler: ['compileTemplate', 'CompilerOptions', 'ParityTestContext', 'ParityRunner', 'ParityRunnerOptions', 'ParityReport', 'runParityTest', 'runAllParityTests'],
    testing: ['render', 'RenderOptions', 'testDirective', 'TestDirectiveDefinition', 'DirectiveTestOptions', 'resetForTesting', 'useFakeTimers'],
    security: ['sanitizeHTML', 'sanitizeHTMLInDocument', 'sanitizeCSS', 'generateCSP', 'createTrustedTypesPolicy', 'TrustedTypePolicy', 'TrustedTypePolicyFactory', 'setSafeInnerHTML', 'SafeInnerHTMLOptions'],
  };
  for (const [slug, names] of Object.entries(roots)) {
    const exports = extractPackageExports(join(process.cwd(), 'packages', slug, 'src', 'index.ts'));
    for (const name of names) expect(exports.get(name), `${slug}.${name}`).toMatchObject({ tag: 'public', deprecated: false });
    for (const name of ['CompileSession', 'createParser', 'compileNode', 'emitDirective', 'renderOptions', 'directiveTestOptions', 'FORBIDDEN_TAGS', 'isAttributeDangerous']) expect(exports.has(name), `${slug}.${name} is private`).toBe(false);
  }
  expect(extractPackageExports(join(process.cwd(), 'packages/compiler/src/index.ts')).get('CompileOptions')).toMatchObject({ tag: 'public', deprecated: true });
  expect(extractPackageExports(join(process.cwd(), 'packages/testing/src/index.ts')).get('mockHttp')).toMatchObject({ tag: 'public', deprecated: true });
});
it('keeps Form canonical validation/method options public, bridges deprecated, and evaluator records private', () => {
  const exports = extractPackageExports(join(process.cwd(), 'packages/form/src/index.ts'));
  for (const name of ['FormStore', 'createForm', 'createAdvancedForm', 'validateField', 'validateFieldAsync', 'validateFormAsync', 'validateWithLifecycle', 'FieldValidationOptions', 'AsyncFieldValidationOptions', 'AsyncFormValidationOptions', 'LifecycleValidationOptions', 'MoveFormItemOptions', 'AddFormFieldOptions']) expect(exports.get(name), name).toMatchObject({ tag: 'public', deprecated: false });
  for (const name of ['evaluateField', 'evaluateFormAsync', 'withFieldSummary', 'createAddedFieldState', 'fieldValidationOptions']) expect(exports.has(name), name).toBe(false);
});
it('keeps State heterogeneous capability types live and legacy registry record lifecycle independent', () => {
  const exports = extractPackageExports(join(process.cwd(), 'packages/state/src/index.ts'));
  for (const name of ['EffectSubscriber', 'WritableCapability', 'isWritable', 'InspectedSignal']) expect(exports.get(name), name).toMatchObject({ tag: 'public', deprecated: false });
  for (const name of ['SignalInfo', 'StateChange', 'registerSignal', 'recordStateChange']) expect(exports.get(name), name).toMatchObject({ tag: 'public', deprecated: true });
  expect(exports.get('getEffectPriority').tag).toBe('internal');
});
it('does not export lifecycle leases or validation coordinators through Form or State facades', () => {
  const form = extractPackageExports(join(process.cwd(), 'packages/form/src/index.ts'));
  for (const name of ['FormScope', 'createFormScope', 'createFormSignal', 'installFormAutosave', 'createAdvancedValidation', 'StoreValidation', 'idleFormValidation']) expect(form.has(name), name).toBe(false);
  const state = extractPackageExports(join(process.cwd(), 'packages/state/src/index.ts'));
  for (const name of ['computed', 'Computed', 'createRoot', 'effect', 'createAsync', 'asyncComputed']) expect(state.get(name), name).toMatchObject({ tag: 'public', deprecated: false });
});
it('follows the real Form factory facades without exporting native configuration/equality helpers', () => {
  const exports = extractPackageExports(join(process.cwd(), 'packages/form/src/index.ts'));
  for (const name of ['createReactiveForm', 'createForm', 'ReactiveFormApi', 'FormFieldDefinition', 'FormFieldDefinitions']) expect(exports.get(name), name).toMatchObject({ tag: 'public', deprecated: false });
  for (const name of ['Ready', 'Empty', 'DynamicValues', 'optionKeys', 'dynamicFormFactoryOptions', 'equalFormValue']) expect(exports.has(name), name).toBe(false);
});
it('classifies documented State types and every live watch overload without promoting root internals', () => {
  const exports = extractPackageExports(join(process.cwd(), 'packages/state/src/index.ts'));
  for (const name of ['Signal', 'Readable', 'ZENITH_READABLE', 'isReadable', 'EffectFn', 'EffectOptions', 'Owner', 'createOwner', 'disposeOwner', 'onCleanup', 'getOwner', 'setOwner', 'WatchSource', 'WatchCallback', 'WatchOptions', 'WatchCleanupRegistrar', 'watch', 'AsyncSignal', 'AsyncOptions', 'AsyncComputeContext', 'SignalObserver', 'setSignalObserver', 'getSignalObserver']) expect(exports.get(name), name).toMatchObject({ tag: 'public', deprecated: false });
  for (const name of ['ZenithError', 'errorBoundary', 'batch']) expect(exports.get(name), name).toMatchObject({ tag: 'public', deprecated: true });
  expect(exports.get('getEffectPriority').tag).toBe('internal');
});
it('keeps deep-watch observation graphs out of the State public facade', () => {
  const exports = extractPackageExports(join(process.cwd(), 'packages/state/src/index.ts'));
  for (const name of ['WatchValueSnapshot', 'captureWatchValue', 'equalWatchValue']) expect(exports.has(name), name).toBe(false);
});

it('keeps State host hooks internal through the self-package facade, without copying private owners', () => {
  const root = extractPackageExports(join(process.cwd(), 'packages/state/src/index.ts'));
  const facade = extractPackageExports(join(process.cwd(), 'packages/state/src/internal.ts'));
  const names = ['EffectContext', 'setEffectContextStore', 'isGlobalObservationEnabled', 'getEffectPriority', 'registerStateInstance', 'resetStateInstanceTrackingForTesting'];
  expect([...facade.keys()].sort()).toEqual([...names].sort());
  for (const name of names) {
    expect(root.get(name), name).toMatchObject({ tag: 'internal', deprecated: false });
    expect(facade.get(name), name).toMatchObject({ tag: 'internal', deprecated: false, origin: 'facade', from: 'state' });
  }
  for (const name of ['_getMutableContext', '_runInEffectContext', '_bindToEffectContext', 'disposeOwnerInContext']) {
    expect(root.has(name), name).toBe(false); expect(facade.has(name), name).toBe(false);
  }
});

it('does not publish State runtime holders, registry generations or installation nodes', () => {
  for (const entry of ['index.ts', 'internal.ts']) {
    const exports = extractPackageExports(join(process.cwd(), 'packages/state/src', entry));
    for (const name of ['_getStateRuntime', '_getLegacyRegistryRuntime', '_clearLegacyRegistry', 'ObserverLease', 'EffectErrorRegistration', 'LegacyRegistryRuntime', 'LegacyListener']) expect(exports.has(name), name).toBe(false);
  }
});

it('classifies Devtools readable inspection entry points without promoting private registration guards', () => {
  const exports = extractPackageExports(join(process.cwd(), 'packages/devtools-core/src/index.ts'));
  for (const name of ['UntypedSignal', 'registerSignal', 'nameSignal', 'recordStateChange', 'onStateChange']) expect(exports.get(name), name).toMatchObject({ tag: 'public', deprecated: false });
  for (const name of ['pendingRegistrations', 'registryGeneration', 'StateChangeListener', 'activeInstallations', 'PanelRegistration', 'registerPanel', 'readPanels', 'decodeSnapshot', 'restoringOperations', 'noopCleanup', 'resolveInspectedWriter']) expect(exports.has(name), name).toBe(false);
});

it('classifies graph/compatibility options and keeps private host policies, leases and resetters off public facades', () => {
  for (const slug of ['devtools-core', 'devtools']) {
    const exports = extractPackageExports(join(process.cwd(), 'packages', slug, 'src/index.ts'));
    for (const name of ['RuntimeGraph', 'GraphNode', 'GraphEdge', 'GraphSnapshot', 'GraphNodeType', 'GraphEdgeType', 'GraphSignalOptions', 'GraphDirectiveOptions', 'runtimeGraph', 'getRuntimeGraph']) expect(exports.get(name), `${slug}.${name}`).toMatchObject({ tag: 'public', deprecated: false });
    for (const name of ['resetRuntimeGraphInternal', 'isGlobalDiagnosticsAllowed', 'canObserveHost', 'canAccessGraph', 'forwardEdge', 'realmGraphs', 'resetters', 'generations', 'Installation', 'current', 'Listener', 'pending', 'resetPanelData']) expect(exports.has(name), `${slug}.${name}`).toBe(false);
  }
  const exports = extractPackageExports(join(process.cwd(), 'packages/devtools/src/index.ts'));
  for (const name of ['PanelStateChangeOptions', 'StaticForOptions', 'ResourceDestroyOptions', 'recordPanelStateChange', 'ZenithDevtoolsHook']) expect(exports.get(name), name).toMatchObject({ tag: 'public', deprecated: false });
  const runtime = extractPackageExports(join(process.cwd(), 'packages/runtime/src/index.ts'));
  for (const name of ['trackDirective', 'TelemetryRuntime', 'TELEMETRY', 'runtime', 'elementId']) expect(runtime.has(name), name).toBe(false);
});
