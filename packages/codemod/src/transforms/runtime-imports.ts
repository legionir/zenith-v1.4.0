// packages/codemod/src/transforms/runtime-imports.ts — importهای `@zenith/runtime` ⇒ مبدأ (#167)
//
// جدول مبدأ از روی `packages/runtime/src/exports.ts` ساخته شده (هر `export {
// … } from 'MC`). نام‌های runtime-خاص (directiveهای `./directives/*`،
// walker/hydrate/context/auth-api، `Zen`) قابل نگاشت مطمئن نیستند ⇒ در import
// باقی می‌مانند + manual.
import ts from 'typescript';
import {
  ensureNamedImports,
  manual,
  removeSpecifiers,
  type TextEdit,
} from '../edits';
import type { ManualItem } from '../types';
import type { Transform, TransformContext } from '../transform';

/** نام واردشده ⇒ ماژول مبدأ (رونوشت دستی از exports.ts ِruntime؛ #109 یکتا می‌کند). */
const ORIGINS: Readonly<Record<string, string>> = {
  signal: '@zenith/state',
  effect: '@zenith/state',
  computed: '@zenith/state',
  batch: '@zenith/state',
  registerAction: '@zenith/actions',
  unregisterAction: '@zenith/actions',
  getAction: '@zenith/actions',
  getActionMeta: '@zenith/actions',
  hasAction: '@zenith/actions',
  clearActions: '@zenith/actions',
  listActions: '@zenith/actions',
  getDefaultRegistry: '@zenith/actions',
  ActionRegistry: '@zenith/actions',
  ActionContext: '@zenith/actions',
  ActionFn: '@zenith/actions',
  ActionMetadata: '@zenith/actions',
  setActionRegistryStore: '@zenith/actions',
  initEventDelegation: '@zenith/events',
  parseBinding: '@zenith/events',
  loadComponents: '@zenith/components',
  registerComponent: '@zenith/components',
  unregisterComponent: '@zenith/components',
  isComponent: '@zenith/components',
  clearComponents: '@zenith/components',
  setComponentRegistryStore: '@zenith/components',
  scheduleEffect: '@zenith/scheduler',
  flushSync: '@zenith/scheduler',
  hasPendingEffects: '@zenith/scheduler',
  pendingEffectCount: '@zenith/scheduler',
  pendingEffectsByPriority: '@zenith/scheduler',
  Priority: '@zenith/scheduler',
  routeSignal: '@zenith/router',
  navigate: '@zenith/router',
  matchRoute: '@zenith/router',
  findMatchingRoute: '@zenith/router',
  setRouteParams: '@zenith/router',
  RouteState: '@zenith/router',
  processFetch: '@zenith/data',
  FetchState: '@zenith/data',
  sanitizeHTML: '@zenith/security',
  sanitizeHTMLWithOptions: '@zenith/security',
  sanitizeHTMLTrusted: '@zenith/security',
  SanitizeOptions: '@zenith/security',
  errorSignal: '@zenith/error-boundary',
  onError: '@zenith/error-boundary',
  reportError: '@zenith/error-boundary',
  clearError: '@zenith/error-boundary',
  clearErrorBoundary: '@zenith/error-boundary',
  processErrorBoundary: '@zenith/error-boundary',
  showFallback: '@zenith/error-boundary',
  recoverFromError: '@zenith/error-boundary',
  initDevTools: '@zenith/devtools',
  cleanupDevtools: '@zenith/devtools',
  isDevtoolsHookInstalled: '@zenith/devtools',
  getDevtoolsVersion: '@zenith/devtools',
  createApp: '@zenith/runtime-core',
  defaultApp: '@zenith/runtime-core',
  resetDefaultAppForTesting: '@zenith/runtime-core',
  defineDirective: '@zenith/runtime-core',
  definePlugin: '@zenith/runtime-core',
  onMount: '@zenith/runtime-core',
  onUnmount: '@zenith/runtime-core',
  onUpdate: '@zenith/runtime-core',
  provide: '@zenith/runtime-core',
  inject: '@zenith/runtime-core',
  createInjectionKey: '@zenith/runtime-core',
  useApp: '@zenith/runtime-core',
  assertCompatible: '@zenith/runtime-core',
  hydrate: '@zenith/runtime-core',
  startFromSSR: '@zenith/runtime-core',
  createFocusTrap: '@zenith/runtime-core',
  createRovingTabindex: '@zenith/runtime-core',
  lockScroll: '@zenith/runtime-core',
  useId: '@zenith/runtime-core',
  computePosition: '@zenith/runtime-core',
  appOptions: '@zenith/runtime-core',
  APP_OPTIONS_DEFAULTS: '@zenith/runtime-core',
  appOptionsSchema: '@zenith/runtime-core',
  resolveAppOptions: '@zenith/runtime-core',
  App: '@zenith/runtime-core',
  AppOptions: '@zenith/runtime-core',
  ResolvedAppOptions: '@zenith/runtime-core',
  DirectiveDefinition: '@zenith/runtime-core',
  BindContext: '@zenith/runtime-core',
  SsrContext: '@zenith/runtime-core',
  HydrationResult: '@zenith/runtime-core',
  HydrationMismatch: '@zenith/runtime-core',
  InjectionKey: '@zenith/runtime-core',
};

/** @public */
export const runtimeImports: Transform = {
  id: 'runtime-imports',
  description: 'Split `@zenith/runtime` imports into their origin packages.',
  run(ctx: TransformContext) {
    const { source, file, text } = ctx;
    const edits: TextEdit[] = [];
    const manuals: ManualItem[] = [];
    const changes = new Set<string>();
    const byModule = new Map<string, Array<{ imported: string; local: string }>>();

    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
        continue;
      }
      if (statement.moduleSpecifier.text !== '@zenith/runtime') continue;
      if (statement.importClause?.isTypeOnly) continue;
      const bindings = statement.importClause?.namedBindings;
      // namespace/default از runtime قابل تفکیک نیست ⇒ manual.
      if (!bindings || !ts.isNamedImports(bindings)) {
        manuals.push(
          manual(
            file,
            source,
            statement.getStart(source),
            'runtime-imports',
            'Namespace/default import from `@zenith/runtime` cannot be split — import the used names from their origin packages manually.',
          ),
        );
        continue;
      }
      const pending: Array<{ element: ts.ImportSpecifier; origin: string; imported: string }> = [];
      for (const element of [...bindings.elements]) {
        if (element.isTypeOnly) {
          const imported = (element.propertyName ?? element.name).text;
          const origin = ORIGINS[imported];
          if (origin === undefined) {
            manuals.push(
              manual(
                file,
                source,
                element.getStart(source),
                'runtime-imports',
                `\`type ${imported}\` has no known origin package — move it manually.`,
              ),
            );
            continue;
          }
          pending.push({ element, origin, imported });
          changes.add(`type ${imported} → ${origin}`);
          continue;
        }
        const imported = (element.propertyName ?? element.name).text;
        const origin = ORIGINS[imported];
        if (origin === undefined) {
          manuals.push(
            manual(
              file,
              source,
              element.getStart(source),
              'runtime-imports',
              `\`${imported}\` is runtime-owned (no safe origin split) — move it manually.`,
            ),
          );
          continue;
        }
        pending.push({ element, origin, imported });
        changes.add(`${imported} → ${origin}`);
      }
      if (pending.length === 0) continue;
      edits.push(
        ...removeSpecifiers(
          source,
          text,
          pending.map((item) => ({ element: item.element, parent: statement })),
        ),
      );
      for (const item of pending) {
        pushOrigin(item.origin, item.imported, item.element.name.text);
      }
    }

    function pushOrigin(origin: string, name: string, local: string): void {
      const list = byModule.get(origin) ?? [];
      list.push({ imported: name, local });
      byModule.set(origin, list);
    }

    for (const [origin, names] of [...byModule.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      edits.push(...ensureNamedImports(source, text, origin, names));
    }
    return { edits, manual: manuals, changes: [...changes] };
  },
};
