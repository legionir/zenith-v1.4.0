// packages/runtime-core/src/index.ts
//
// #148 — @zenith/runtime-core (SPEC §۲.۸، لایهٔ L3):
//   • مدل نمونهٔ مستقل `createApp(opts)` بدون singleton اجباری (چند اپ هم‌زمان در صفحه و SSR).
//   • موتور دایرکتیو با ترتیب اولویت قطعی:
//     zen-for (1000) > zen-if/else-if/else (900) > zen-memo (800) > zen-ref (700) > سایر (500) > zen-action (100).
//   • تشخیص تداخل دو دایرکتیو ساختاری روی یک المان ⇒ ZEN-2302.
//   • الزام zen-key روی zen-for ⇒ ZEN-2303.
//   • قلاب‌های چرخهٔ عمر onMount / onUnmount / onUpdate (خارج از محدوده ⇒ ZEN-2301).
//   • provide / inject درختی (مبتنی بر دامنهٔ المان/اپ).
//   • Hydration با نشانگرهای قطعی `data-zen-h` و کد خطای ZEN-2310.
//   • بررسی سازگاری نسخهٔ پکیج‌ها `assertCompatible` ⇒ ZEN-2320.

import { ZenithError, createReservedError, emitError } from '@zenith/errors';
import { evaluateExpression } from '@zenith/expressions';
import { logger as defaultLogger, type Logger } from '@zenith/logger';
import {
  s,
  defineOptions,
  parseConfigAttr,
  defineDirectiveMeta,
  type DirectiveMeta,
  type Schema,
} from '@zenith/schema';
import { sanitizeHTML } from '@zenith/security';
import {
  createDisposer,
  isReadable,
  type Cleanup,
  type Disposable,
  type Disposer,
} from '@zenith/shared';
import { effect, signal, isWritable } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';

// ── Types & Interfaces (SPEC §2.8) ──

export interface SsrContext {
  app: App;
  state: Record<string, any>;
  context: Record<string, any>;
  nextHydrationId(): string;
}

export interface BindContext {
  /** عبارت خام attribute */
  expr: string;
  /** نام کامل attribute (مثلاً `zen-bind:title` یا `zen-action:click.prevent`) */
  attrName: string;
  /** آرگومان پس از `:` (مثلاً `title` یا `click`) */
  arg?: string;
  /** modifierهای پس از `.` (مثلاً `['prevent', 'stop']`) */
  modifiers: string[];
  /** کانتکست واکنش‌گرا (شامل state و متغیرهای محلی مثل `$item`/`$index`) */
  context: Record<string, any>;
  /** نمونهٔ App مالک */
  app: App;
  /** پیمایش فرزندان با کانتکست اختیاری */
  processChildren(node: HTMLElement, extraCtx?: Record<string, any>): void;
  /** ظرف پاک‌سازی چرخهٔ عمر این المان */
  disposes: Disposer;
  /** آبجکت خام state برنامه */
  state: Record<string, any>;
  /** خواندن attribute کمکی `zen-<directive>-<option>` */
  option(name: string): string | null;
  /** خواندن و اعتبارسنجی JSON از `zen-<directive>-options` با `@zenith/schema` */
  config<T>(schema: Schema<T>): T;
  /** ثبت callback که پس از هر به‌روزرسانی واکنش‌گرای این دایرکتیو فراخوانی می‌شود */
  notifyUpdate(): void;
}

// ── #38: تایپ‌های ambient محلی (به‌جای cast‌های متفرقه‌ی untyped) ──

/** عنصر DOM نشانه‌گذاری‌شده از zen-memo (پرچم داخلی). */
interface MemoMarkedElement extends HTMLElement {
  __zenMemoUnchanged?: boolean;
}

/** انتساب property نامتعارف style بدون any (CSS OM در غیاب تایپ index-based). */
function setStyleProp(el: HTMLElement, prop: string, value: unknown): void {
  (el.style as unknown as Record<string, unknown>)[prop] = value ?? '';
}

export interface DirectiveDefinition {
  name: string;
  meta?: DirectiveMeta;
  /** اولویت اجرا (بالاتر زودتر اجرا می‌شود؛ پیش‌فرض 500) */
  priority?: number;
  /** آیا دایرکتیو ساختاری است (مثل zen-for / zen-if)؟ */
  structural?: boolean;
  /** آیا پیشوند attribute با `:` یا `-` را هم تطبیق می‌دهد؟ */
  prefixMatch?: boolean;
  bind(el: HTMLElement, ctx: BindContext): Cleanup | void;
  hydrate?(el: HTMLElement, ctx: BindContext): Cleanup | void;
  ssr?(el: Element, ctx: SsrContext): void;
}

export interface Plugin<O = any> {
  name: string;
  version?: string;
  install(app: App, options?: O): void | Cleanup;
}

export type PluginEntry<O = any> = Plugin<O> | [Plugin<O>, O];

export interface AppSsrOptions {
  preloadState?: boolean;
  validateHydration?: boolean;
}

export interface AppOptions {
  state?: Record<string, any>;
  plugins?: PluginEntry[];
  devtools?: boolean;
  delegationRoot?: Document | ShadowRoot | HTMLElement;
  strictParity?: boolean;
  logger?: Logger;
  errorHandler?: (err: ZenithError) => void;
  warnHandler?: (msg: string, ctx?: Record<string, unknown>) => void;
  idPrefix?: string;
  ssr?: AppSsrOptions;
}

export interface ResolvedAppOptions {
  state: Record<string, any>;
  plugins: PluginEntry[];
  devtools: boolean;
  delegationRoot?: Document | ShadowRoot | HTMLElement;
  strictParity: boolean;
  logger: Logger;
  errorHandler?: (err: ZenithError) => void;
  warnHandler?: (msg: string, ctx?: Record<string, unknown>) => void;
  idPrefix: string;
  ssr: Required<AppSsrOptions>;
}

export interface HydrationMismatch {
  path: string;
  expected: unknown;
  actual: unknown;
}

export interface HydrationResult {
  app: App;
  cleanup: Cleanup;
  hydrated: boolean;
  mismatches: HydrationMismatch[];
}

export interface App extends Disposable {
  readonly id: string;
  readonly config: ResolvedAppOptions;
  mount(root: HTMLElement, state?: Record<string, any>): Cleanup;
  unmount(): void;
  use<O = any>(plugin: Plugin<O> | [Plugin<O>, O], options?: O): App;
  directive(nameOrDef: string | DirectiveDefinition, def?: DirectiveDefinition): Cleanup;
  provide<T>(key: string | symbol, value: T): App;
  inject<T>(key: string | symbol, defaultValue?: T): T | undefined;
  /**
   * #150-wave2: افزودن به state سراسری اپ پس از ایجاد اپ (globalStateHub).
   *
   * پلاگین‌ها (مثل `@zenith/i18n`) با این API شناسه‌هایی مثل `t`/`locale` را به
   * state تزریق می‌کنند تا در expressionها به‌صورت `$t(...)`/`$locale` در دسترس
   * باشند. مقادیر در `config.state` ابجکت merge می‌شوند و از mount بعدی فعال‌اند
   * (روی mountهای پیش‌نیامده هم اثر دارد).
   *
   * سیاست برخورد: بدون `overwrite` بر کلید موجود بازنویسی انجام نمی‌شود و در حالت
   * dev با `warnHandler`/`logger` هشدار می‌دهد (فیلدهای تزریقی باید اسم‌فضا داشته باشند).
   */
  addState(values: Record<string, unknown>, options?: { overwrite?: boolean }): App;
  action(
    name: string,
    fn: (ctx: {
      state: Record<string, any>;
      event?: Event;
      el?: HTMLElement;
      app: App;
      args?: unknown[];
    }) => unknown,
  ): Cleanup;
  nextId(): string;
  dispose(): void;
}

// ── Options Schema (#52 / #148) ──

export const appOptions = defineOptions<AppOptions>(
  'AppOptions',
  s.object({
    state: s.default(s.record(s.custom(() => true, 'any')), {}),
    plugins: s.default(
      s.array(
        s.custom<PluginEntry>(
          (v) =>
            (typeof v === 'object' &&
              v !== null &&
              !Array.isArray(v) &&
              typeof (v as Plugin).name === 'string' &&
              typeof (v as Plugin).install === 'function') ||
            (Array.isArray(v) &&
              v.length >= 1 &&
              typeof v[0] === 'object' &&
              v[0] !== null &&
              typeof (v[0] as Plugin).name === 'string' &&
              typeof (v[0] as Plugin).install === 'function'),
          'Plugin | [Plugin, options]',
        ),
      ),
      [],
    ),
    devtools: s.default(s.boolean(), true),
    delegationRoot: s.optional(
      s.custom<Document | ShadowRoot | HTMLElement>(
        (v) =>
          typeof v === 'object' &&
          v !== null &&
          typeof (v as { nodeType?: unknown }).nodeType === 'number' &&
          [1, 9, 11].includes((v as { nodeType: number }).nodeType),
        'Document | ShadowRoot | HTMLElement (nodeType 1|9|11)',
      ),
    ),
    strictParity: s.default(s.boolean(), false),
    logger: s.optional(
      s.custom<Logger>(
        (v) =>
          typeof v === 'object' &&
          v !== null &&
          typeof (v as { warn?: unknown }).warn === 'function' &&
          typeof (v as { error?: unknown }).error === 'function',
        'Logger',
      ),
    ),
    errorHandler: s.optional(s.fn() as unknown as Schema<(err: ZenithError) => void>),
    warnHandler: s.optional(
      s.fn() as unknown as Schema<(msg: string, ctx?: Record<string, unknown>) => void>,
    ),
    idPrefix: s.default(s.string({ min: 1 }), 'zen'),
    ssr: s.default(
      s.object({
        preloadState: s.default(s.boolean(), true),
        validateHydration: s.default(s.boolean(), false),
      }),
      { preloadState: true, validateHydration: false },
    ),
  }),
);

export const APP_OPTIONS_DEFAULTS = appOptions.DEFAULTS;
export const appOptionsSchema = appOptions.schema;
export const resolveAppOptions = (opts?: unknown): AppOptions => appOptions.resolve(opts);

// ── Active Scope Stack (Lifecycle Hooks + Tree-Scoped Provide/Inject) ──

interface ScopeFrame {
  app: App;
  disposes: Disposer;
  mountCallbacks: Array<() => void | Cleanup>;
  updateCallbacks: Array<() => void>;
  provides: Map<string | symbol, unknown>;
  parent: ScopeFrame | null;
}

let currentScope: ScopeFrame | null = null;
let currentActiveApp: App | null = null;

function runInScope<T>(frame: ScopeFrame, fn: () => T): T {
  const prevScope = currentScope;
  const prevApp = currentActiveApp;
  currentScope = frame;
  currentActiveApp = frame.app;
  try {
    return fn();
  } finally {
    currentScope = prevScope;
    currentActiveApp = prevApp;
  }
}

function flushMountCallbacks(frame: ScopeFrame): void {
  const cbs = frame.mountCallbacks.splice(0, frame.mountCallbacks.length);
  for (const cb of cbs) {
    try {
      const cleanup = cb();
      if (typeof cleanup === 'function') {
        frame.disposes.add(cleanup);
      }
    } catch (err) {
      handleAppError(frame.app, err);
    }
  }
}

function triggerUpdateCallbacks(frame: ScopeFrame): void {
  for (const cb of frame.updateCallbacks) {
    try {
      cb();
    } catch (err) {
      handleAppError(frame.app, err);
    }
  }
}

function handleAppError(app: App, err: unknown): void {
  const zenErr =
    err instanceof ZenithError
      ? err
      : new ZenithError({
          code: 'ZEN-905',
          category: 'Runtime',
          message: err instanceof Error ? err.message : String(err),
          cause: err,
        });
  if (app.config.errorHandler) {
    app.config.errorHandler(zenErr);
  } else {
    emitError(zenErr);
  }
}

/**
 * ثبت قلاب چرخهٔ عمر هنگام mount شدن دایرکتیو/کامپوننت.
 * فراخوانی خارج از دامنهٔ فعال ⇒ `ZEN-2301`.
 */
export function onMount(fn: () => void | Cleanup): void {
  if (!currentScope) {
    throw createReservedError('ZEN-2301', { details: { hook: 'onMount' } });
  }
  currentScope.mountCallbacks.push(fn);
}

/**
 * ثبت قلاب چرخهٔ عمر هنگام unmount / dispose شدن دایرکتیو/کامپوننت.
 * فراخوانی خارج از دامنهٔ فعال ⇒ `ZEN-2301`.
 */
export function onUnmount(fn: () => void): void {
  if (!currentScope) {
    throw createReservedError('ZEN-2301', { details: { hook: 'onUnmount' } });
  }
  currentScope.disposes.add(fn);
}

/**
 * ثبت قلاب چرخهٔ عمر که پس از هر به‌روزرسانی واکنش‌گرا در دامنهٔ فعلی اجرا می‌شود.
 * فراخوانی خارج از دامنهٔ فعال ⇒ `ZEN-2301`.
 */
export function onUpdate(fn: () => void): void {
  if (!currentScope) {
    throw createReservedError('ZEN-2301', { details: { hook: 'onUpdate' } });
  }
  currentScope.updateCallbacks.push(fn);
}

/**
 * #125: کلید تایپ‌شده برای Dependency Injection (`provide` / `inject`).
 */
export type InjectionKey<T> = symbol & { readonly __zenithInjectionType?: T };

/**
 * #125: ساخت یک `InjectionKey<T>` تایپ‌شده بر پایهٔ `Symbol(description)`.
 */
export function createInjectionKey<T>(description?: string): InjectionKey<T> {
  return Symbol(description) as InjectionKey<T>;
}

/**
 * ثبت مقدار در درخت Dependency Injection دامنهٔ فعلی (یا اپ فعال).
 */
export function provide<T>(key: InjectionKey<T> | string | symbol, value: T): void {
  if (currentScope) {
    currentScope.provides.set(key, value);
    return;
  }
  if (currentActiveApp) {
    currentActiveApp.provide(key, value);
    return;
  }
  throw createReservedError('ZEN-2301', { details: { hook: 'provide', key: String(key) } });
}

/**
 * خواندن مقدار از نزدیک‌ترین دامنهٔ والد در درخت (یا سطح App).
 */
export function inject<T>(key: InjectionKey<T> | string | symbol): T | undefined;
export function inject<T>(key: InjectionKey<T> | string | symbol, defaultValue: T): T;
export function inject<T>(key: InjectionKey<T> | string | symbol, defaultValue?: T): T | undefined {
  let frame = currentScope;
  while (frame) {
    if (frame.provides.has(key)) {
      return frame.provides.get(key) as T;
    }
    frame = frame.parent;
  }
  const app = currentScope?.app ?? currentActiveApp;
  if (app) {
    return app.inject(key, defaultValue);
  }
  throw createReservedError('ZEN-2301', { details: { hook: 'inject', key: String(key) } });
}

/**
 * دریافت نمونهٔ App فعال در دامنهٔ جاری.
 */
export function useApp(): App {
  const app = currentScope?.app ?? currentActiveApp;
  if (!app) {
    throw createReservedError('ZEN-2301', { details: { hook: 'useApp' } });
  }
  return app;
}

/**
 * یاور تعریف دایرکتیو با حفظ نوع و ثبت متادیتا در `@zenith/schema`.
 */
export function defineDirective(def: DirectiveDefinition): DirectiveDefinition {
  if (def.meta) {
    defineDirectiveMeta(def.meta);
  }
  return def;
}

/**
 * یاور تعریف پلاگین با حفظ نوع.
 */
export function definePlugin<O = any>(plugin: Plugin<O>): Plugin<O> {
  return plugin;
}

export const ZENITH_RUNTIME_CORE_VERSION = '1.5.0';

/**
 * بررسی سازگاری lockstep نسخه‌های پکیج‌های `@zenith/*` (SPEC §۲.۸؛ خطای `ZEN-2320`).
 */
export function assertCompatible(versions: Record<string, string> = {}): void {
  const entries = Object.entries(versions);
  if (entries.length <= 1) return;
  const parseMajorMinor = (v: string): string | null => {
    const m = /^v?(\d+)\.(\d+)\.\d+/.exec(v.trim());
    return m ? `${m[1]}.${m[2]}` : null;
  };
  const firstVer = entries[0]![1];
  const baseMM = parseMajorMinor(firstVer);
  if (!baseMM) {
    throw createReservedError('ZEN-2320', { details: { versions } });
  }
  for (const [, ver] of entries) {
    const mm = parseMajorMinor(ver);
    if (!mm || mm !== baseMM) {
      throw createReservedError('ZEN-2320', {
        details: { expectedMajorMinor: baseMM, versions },
      });
    }
  }
}

// ── Reactive Evaluation Context ──

function createEvalContext(
  state: Record<string, any>,
  locals: Record<string, any> = {},
): Record<string, any> {
  const combined = { ...state, ...locals };
  return new Proxy(combined, {
    has(target, prop) {
      if (typeof prop === 'string' && prop.startsWith('$') && prop.slice(1) in target) {
        return true;
      }
      return prop in target;
    },
    get(target, prop, receiver) {
      if (typeof prop === 'symbol') return Reflect.get(target, prop, receiver);
      let raw: unknown;
      if (prop in target) {
        raw = target[prop];
      } else if (prop.startsWith('$') && prop.slice(1) in target) {
        raw = target[prop.slice(1)];
      } else {
        return undefined;
      }
      if (isReadable(raw)) {
        return raw.get();
      }
      return raw;
    },
  });
}

function evalExpr(expr: string, ctx: Record<string, any>, app: App): unknown {
  try {
    return evaluateExpression(expr, ctx);
  } catch (err) {
    handleAppError(app, err);
    return undefined;
  }
}

function resolveRawTarget(
  expr: string,
  state: Record<string, any>,
  locals: Record<string, any>,
): unknown {
  const trimmed = expr.trim().replace(/^\$/, '');
  if (trimmed in locals) return locals[trimmed];
  if (trimmed in state) return state[trimmed];
  return undefined;
}

// ── Core Directives (SPEC §2.8) ──

function buildCoreDirectives(): DirectiveDefinition[] {
  const zenFor = defineDirective({
    name: 'zen-for',
    priority: 1000,
    structural: true,
    bind(el, ctx) {
      const keyExpr = el.getAttribute('zen-key');
      if (!keyExpr || keyExpr.trim() === '') {
        throw createReservedError('ZEN-2303', {
          details: { expr: ctx.expr, element: el.tagName },
        });
      }
      const parent = el.parentNode;
      if (!parent) return;

      // پشتیبانی از `item in items` یا `(item, index) in items`
      const match =
        /^\s*(?:\(\s*([a-zA-Z_$][\w$]*)\s*,\s*([a-zA-Z_$][\w$]*)\s*\)|([a-zA-Z_$][\w$]*))\s+in\s+([\s\S]+)$/.exec(
          ctx.expr,
        );
      const itemVar = match ? (match[1] ?? match[3] ?? '$item') : '$item';
      const indexVar = match?.[2] ?? '$index';
      const listExpr = match ? match[4]!.trim() : ctx.expr;

      const anchor = el.ownerDocument.createComment(`zen-for:${ctx.expr}`);
      parent.replaceChild(anchor, el);

      const template = el.cloneNode(true) as HTMLElement;
      template.removeAttribute('zen-for');
      template.removeAttribute('zen-key');

      const activeRows = new Map<unknown, { node: HTMLElement; disposes: Disposer }>();

      let initialized = false;
      const stopEffect = effect(() => {
        const evalCtx = createEvalContext(ctx.state, ctx.context);
        const rawList = evalExpr(listExpr, evalCtx, ctx.app);
        const list = Array.isArray(rawList) ? rawList : [];

        const nextKeys = new Set<unknown>();
        const orderedNodes: HTMLElement[] = [];

        for (let idx = 0; idx < list.length; idx++) {
          const item = list[idx];
          const itemLocals: Record<string, any> = {
            ...ctx.context,
            [itemVar]: item,
            [`$${itemVar.replace(/^\$/, '')}`]: item,
            $item: item,
            [indexVar]: idx,
            $index: idx,
          };
          const itemEvalCtx = createEvalContext(ctx.state, itemLocals);
          const key =
            keyExpr === '$index' || keyExpr === indexVar
              ? idx
              : keyExpr === '$item' || keyExpr === itemVar
                ? item
                : evalExpr(keyExpr, itemEvalCtx, ctx.app);
          const resolvedKey = key ?? idx;
          nextKeys.add(resolvedKey);

          const prev = activeRows.get(resolvedKey);
          if (prev) {
            prev.disposes.dispose();
            prev.node.parentNode?.removeChild(prev.node);
          }
          const clone = template.cloneNode(true) as HTMLElement;
          const rowDisposer = createDisposer();
          activeRows.set(resolvedKey, { node: clone, disposes: rowDisposer });
          orderedNodes.push(clone);
          ctx.processChildren(clone, itemLocals);
        }

        // حذف ردیف‌های قدیمی و از DOM
        for (const [k, row] of activeRows) {
          if (!nextKeys.has(k)) {
            row.disposes.dispose();
            row.node.parentNode?.removeChild(row.node);
            activeRows.delete(k);
          } else {
            row.node.parentNode?.removeChild(row.node);
          }
        }

        // درج به ترتیب پس از anchor
        let refNode: Node = anchor;
        for (const node of orderedNodes) {
          anchor.parentNode?.insertBefore(node, refNode.nextSibling);
          refNode = node;
        }

        if (initialized) ctx.notifyUpdate();
        initialized = true;
      });

      return () => {
        stopEffect();
        for (const row of activeRows.values()) {
          row.disposes.dispose();
          row.node.parentNode?.removeChild(row.node);
        }
        activeRows.clear();
      };
    },
  });

  const zenIf = defineDirective({
    name: 'zen-if',
    priority: 900,
    structural: true,
    bind(el, ctx) {
      const parent = el.parentNode;
      if (!parent) return;

      // جمع‌آوری زنجیرهٔ zen-if / zen-else-if / zen-else همسایه
      const branches: Array<{ expr: string | null; template: HTMLElement }> = [];
      const firstClone = el.cloneNode(true) as HTMLElement;
      firstClone.removeAttribute('zen-if');
      branches.push({ expr: ctx.expr, template: firstClone });

      let cursor = el.nextElementSibling as HTMLElement | null;
      while (cursor) {
        if (cursor.hasAttribute('zen-else-if')) {
          const next = cursor.nextElementSibling as HTMLElement | null;
          const expr = cursor.getAttribute('zen-else-if') ?? 'false';
          const tmpl = cursor.cloneNode(true) as HTMLElement;
          tmpl.removeAttribute('zen-else-if');
          branches.push({ expr, template: tmpl });
          parent.removeChild(cursor);
          cursor = next;
        } else if (cursor.hasAttribute('zen-else')) {
          const tmpl = cursor.cloneNode(true) as HTMLElement;
          tmpl.removeAttribute('zen-else');
          branches.push({ expr: null, template: tmpl });
          parent.removeChild(cursor);
          break;
        } else {
          break;
        }
      }

      const anchor = el.ownerDocument.createComment(`zen-if:${ctx.expr}`);
      parent.replaceChild(anchor, el);

      let activeNode: HTMLElement | null = null;
      let activeBranchIndex = -1;
      let activeDisposer: Disposer | null = null;
      let initialized = false;

      const stopEffect = effect(() => {
        const evalCtx = createEvalContext(ctx.state, ctx.context);
        let matchIdx = -1;
        for (let i = 0; i < branches.length; i++) {
          const b = branches[i]!;
          if (b.expr === null || Boolean(evalExpr(b.expr, evalCtx, ctx.app))) {
            matchIdx = i;
            break;
          }
        }

        if (matchIdx !== activeBranchIndex) {
          activeDisposer?.dispose();
          activeDisposer = null;
          if (activeNode && activeNode.parentNode) {
            activeNode.parentNode.removeChild(activeNode);
          }
          activeNode = null;
          activeBranchIndex = matchIdx;

          if (matchIdx >= 0) {
            const clone = branches[matchIdx]!.template.cloneNode(true) as HTMLElement;
            activeDisposer = createDisposer();
            anchor.parentNode?.insertBefore(clone, anchor.nextSibling);
            activeNode = clone;
            ctx.processChildren(clone, ctx.context);
          }
        }
        if (initialized) ctx.notifyUpdate();
        initialized = true;
      });

      return () => {
        stopEffect();
        activeDisposer?.dispose();
        if (activeNode && activeNode.parentNode) {
          activeNode.parentNode.removeChild(activeNode);
        }
      };
    },
  });

  const zenElseIf = defineDirective({
    name: 'zen-else-if',
    priority: 900,
    structural: true,
    bind() {
      // توسط zen-if همسایه مدیریت می‌شود
    },
  });

  const zenElse = defineDirective({
    name: 'zen-else',
    priority: 900,
    structural: true,
    bind() {
      // توسط zen-if همسایه مدیریت می‌شود
    },
  });

  const zenMemo = defineDirective({
    name: 'zen-memo',
    priority: 800,
    bind(el, ctx) {
      let prevDeps: unknown[] | null = null;
      const stop = effect(() => {
        const evalCtx = createEvalContext(ctx.state, ctx.context);
        const val = evalExpr(ctx.expr, evalCtx, ctx.app);
        const nextDeps = Array.isArray(val) ? val : [val];
        const unchanged =
          prevDeps !== null &&
          prevDeps.length === nextDeps.length &&
          prevDeps.every((d, i) => Object.is(d, nextDeps[i]));
        (el as MemoMarkedElement).__zenMemoUnchanged = unchanged;
        prevDeps = nextDeps;
      });
      return () => {
        stop();
        delete (el as MemoMarkedElement).__zenMemoUnchanged;
      };
    },
  });

  const zenRef = defineDirective({
    name: 'zen-ref',
    priority: 700,
    bind(el, ctx) {
      const targetName = ctx.expr.trim().replace(/^\$/, '');
      const target = resolveRawTarget(targetName, ctx.state, ctx.context);
      if (isWritable(target)) {
        target.set(el);
        return () => target.set(null);
      }
      if (!ctx.state.refs || typeof ctx.state.refs !== 'object') {
        ctx.state.refs = {};
      }
      ctx.state.refs[targetName] = el;
      return () => {
        if (ctx.state.refs && ctx.state.refs[targetName] === el) {
          delete ctx.state.refs[targetName];
        }
      };
    },
  });

  const zenText = defineDirective({
    name: 'zen-text',
    priority: 500,
    bind(el, ctx) {
      let initialized = false;
      return effect(() => {
        const evalCtx = createEvalContext(ctx.state, ctx.context);
        const value = evalExpr(ctx.expr, evalCtx, ctx.app);
        if ((el as MemoMarkedElement).__zenMemoUnchanged === true && initialized) return;
        el.textContent = value === undefined || value === null ? '' : String(value);
        if (initialized) ctx.notifyUpdate();
        initialized = true;
      });
    },
  });

  const zenHtml = defineDirective({
    name: 'zen-html',
    priority: 500,
    bind(el, ctx) {
      let initialized = false;
      return effect(() => {
        const evalCtx = createEvalContext(ctx.state, ctx.context);
        const value = evalExpr(ctx.expr, evalCtx, ctx.app);
        if ((el as MemoMarkedElement).__zenMemoUnchanged === true && initialized) return;
        const raw = value === undefined || value === null ? '' : String(value);
        el.innerHTML = sanitizeHTML(raw);
        if (initialized) ctx.notifyUpdate();
        initialized = true;
      });
    },
  });

  const zenShow = defineDirective({
    name: 'zen-show',
    priority: 500,
    bind(el, ctx) {
      const originalDisplay = el.style.display;
      let initialized = false;
      return effect(() => {
        const evalCtx = createEvalContext(ctx.state, ctx.context);
        const visible = Boolean(evalExpr(ctx.expr, evalCtx, ctx.app));
        el.style.display = visible ? originalDisplay : 'none';
        if (initialized) ctx.notifyUpdate();
        initialized = true;
      });
    },
  });

  const zenCloak = defineDirective({
    name: 'zen-cloak',
    priority: 500,
    bind(el) {
      el.removeAttribute('zen-cloak');
    },
  });

  const zenBind = defineDirective({
    name: 'zen-bind',
    priority: 500,
    prefixMatch: true,
    bind(el, ctx) {
      let initialized = false;
      return effect(() => {
        const evalCtx = createEvalContext(ctx.state, ctx.context);
        const val = evalExpr(ctx.expr, evalCtx, ctx.app);
        if (ctx.arg) {
          applyAttributeBinding(el, ctx.arg, val);
        } else if (val && typeof val === 'object') {
          for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
            applyAttributeBinding(el, k, v);
          }
        }
        if (initialized) ctx.notifyUpdate();
        initialized = true;
      });
    },
  });

  const zenModel = defineDirective({
    name: 'zen-model',
    priority: 500,
    bind(el, ctx) {
      const target = resolveRawTarget(ctx.expr, ctx.state, ctx.context);
      const isLazy = el.hasAttribute('zen-model-lazy') || ctx.modifiers.includes('lazy');
      const isTrim = el.hasAttribute('zen-model-trim') || ctx.modifiers.includes('trim');
      const isNumber = el.hasAttribute('zen-model-number') || ctx.modifiers.includes('number');

      const inputEl = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      const isCheckbox =
        inputEl.tagName === 'INPUT' && (inputEl as HTMLInputElement).type === 'checkbox';

      let initialized = false;
      const stopEffect = effect(() => {
        const evalCtx = createEvalContext(ctx.state, ctx.context);
        const val = isReadable(target) ? target.get() : evalExpr(ctx.expr, evalCtx, ctx.app);
        if (isCheckbox) {
          (inputEl as HTMLInputElement).checked = Boolean(val);
        } else {
          inputEl.value = val === undefined || val === null ? '' : String(val);
        }
        if (initialized) ctx.notifyUpdate();
        initialized = true;
      });

      const eventName = isLazy || isCheckbox || inputEl.tagName === 'SELECT' ? 'change' : 'input';
      const handler = () => {
        if (!isWritable(target)) return;
        if (isCheckbox) {
          target.set((inputEl as HTMLInputElement).checked);
          return;
        }
        let nextVal: string | number = inputEl.value;
        if (isTrim) nextVal = nextVal.trim();
        if (isNumber) {
          const parsed = Number(nextVal);
          if (!Number.isNaN(parsed)) nextVal = parsed;
        }
        target.set(nextVal);
      };

      inputEl.addEventListener(eventName, handler);
      return () => {
        stopEffect();
        inputEl.removeEventListener(eventName, handler);
      };
    },
  });

  const zenAction = defineDirective({
    name: 'zen-action',
    priority: 100,
    prefixMatch: true,
    bind(el, ctx) {
      const eventName = ctx.arg || 'click';
      const actionName = ctx.expr.trim();
      const handler = (event: Event) => {
        if (ctx.modifiers.includes('self') && event.target !== el) return;
        if (ctx.modifiers.includes('prevent')) event.preventDefault();
        if (ctx.modifiers.includes('stop')) event.stopPropagation();

        const rawTarget = resolveRawTarget(actionName, ctx.state, ctx.context);
        if (typeof rawTarget === 'function') {
          try {
            rawTarget({ state: ctx.state, event, el, app: ctx.app });
          } catch (err) {
            handleAppError(ctx.app, err);
          }
          return;
        }
        const evalCtx = createEvalContext(ctx.state, { ...ctx.context, $event: event });
        evalExpr(ctx.expr, evalCtx, ctx.app);
      };

      const opts: AddEventListenerOptions = {
        once: ctx.modifiers.includes('once'),
      };
      el.addEventListener(eventName, handler, opts);
      return () => el.removeEventListener(eventName, handler, opts);
    },
  });

  return [
    zenFor,
    zenIf,
    zenElseIf,
    zenElse,
    zenMemo,
    zenRef,
    zenText,
    zenHtml,
    zenShow,
    zenCloak,
    zenBind,
    zenModel,
    zenAction,
  ];
}

function applyAttributeBinding(el: HTMLElement, attr: string, val: unknown): void {
  if (attr === 'class') {
    if (typeof val === 'string') {
      el.className = val;
    } else if (Array.isArray(val)) {
      el.className = val.filter(Boolean).join(' ');
    } else if (val && typeof val === 'object') {
      el.className = Object.entries(val as Record<string, unknown>)
        .filter(([, on]) => Boolean(on))
        .map(([cls]) => cls)
        .join(' ');
    }
    return;
  }
  if (attr === 'style') {
    if (typeof val === 'string') {
      el.setAttribute('style', val);
    } else if (val && typeof val === 'object') {
      for (const [prop, styleVal] of Object.entries(val as Record<string, unknown>)) {
        setStyleProp(el, prop, styleVal);
      }
    }
    return;
  }
  if (attr === 'value' && 'value' in el) {
    (el as HTMLInputElement).value = val === undefined || val === null ? '' : String(val);
    return;
  }
  if (attr === 'checked' && 'checked' in el) {
    (el as HTMLInputElement).checked = Boolean(val);
    return;
  }
  if (val === false || val === null || val === undefined) {
    el.removeAttribute(attr);
  } else if (val === true) {
    el.setAttribute(attr, '');
  } else {
    el.setAttribute(attr, String(val));
  }
}

// ── createApp Implementation (SPEC §2.8) ──

let nextAppInstanceSeq = 1;

export function createApp(options?: AppOptions): App {
  const validated = appOptions.resolve(options);
  const idPrefix = validated.idPrefix ?? 'zen';
  const appId = `${idPrefix}-app-${nextAppInstanceSeq++}`;
  let idCounter = 0;

  const resolvedConfig: ResolvedAppOptions = {
    state: { ...(validated.state ?? {}) },
    plugins: [...(validated.plugins ?? [])],
    devtools:
      options?.devtools !== undefined
        ? Boolean(validated.devtools)
        : (globalThis as { __ZENITH_DEV__?: boolean }).__ZENITH_DEV__ !== false,
    delegationRoot: validated.delegationRoot,
    strictParity: Boolean(validated.strictParity),
    logger: validated.logger ?? defaultLogger,
    errorHandler: validated.errorHandler,
    warnHandler: validated.warnHandler,
    idPrefix,
    ssr: {
      preloadState: validated.ssr?.preloadState ?? true,
      validateHydration: validated.ssr?.validateHydration ?? false,
    },
  };

  const directives = new Map<string, DirectiveDefinition>();
  for (const d of buildCoreDirectives()) {
    directives.set(d.name, d);
  }

  const installedPlugins = new Set<string>();
  const appProvides = new Map<string | symbol, unknown>();
  const actions = new Map<
    string,
    (ctx: {
      state: Record<string, any>;
      event?: Event;
      el?: HTMLElement;
      app: App;
      args?: unknown[];
    }) => unknown
  >();
  const mountedRoots = new Map<HTMLElement, Disposer>();
  const appDisposer = createDisposer();
  let disposed = false;

  function parseAttrDirective(
    attrName: string,
  ): { def: DirectiveDefinition; arg?: string; modifiers: string[] } | null {
    // 1. تطبیق دقیق
    const exact = directives.get(attrName);
    if (exact) {
      return { def: exact, modifiers: [] };
    }
    // 2. تطبیق با `:` و `.` (مثلاً `zen-bind:href` یا `zen-action:click.prevent.stop`)
    const colonIdx = attrName.indexOf(':');
    const dotIdx = attrName.indexOf('.');
    const splitIdx =
      colonIdx >= 0 && dotIdx >= 0 ? Math.min(colonIdx, dotIdx) : colonIdx >= 0 ? colonIdx : dotIdx;

    if (splitIdx > 0) {
      const baseName = attrName.slice(0, splitIdx);
      const def = directives.get(baseName);
      if (def) {
        const rest = attrName.slice(splitIdx);
        let arg: string | undefined;
        let modifiers: string[] = [];
        if (rest.startsWith(':')) {
          const parts = rest.slice(1).split('.');
          arg = parts[0];
          modifiers = parts.slice(1).filter(Boolean);
        } else if (rest.startsWith('.')) {
          modifiers = rest.slice(1).split('.').filter(Boolean);
        }
        return { def, arg, modifiers };
      }
    }
    return null;
  }

  function walkElement(
    el: HTMLElement,
    state: Record<string, any>,
    localCtx: Record<string, any>,
    parentFrame: ScopeFrame,
  ): void {
    // 1. zen-static: عدم پیمایش زیرمجموعه
    if (el.hasAttribute('zen-static')) {
      el.removeAttribute('zen-static');
      return;
    }

    // 2. zen-state: ساخت سیگنال‌های محلی از JSON attribute
    let currentLocalCtx = localCtx;
    if (el.hasAttribute('zen-state')) {
      const rawState = el.getAttribute('zen-state') ?? '{}';
      el.removeAttribute('zen-state');
      try {
        const parsed = JSON.parse(rawState) as Record<string, unknown>;
        const scopedSignals: Record<string, any> = {};
        for (const [k, v] of Object.entries(parsed)) {
          scopedSignals[k] = signal(v);
        }
        currentLocalCtx = { ...localCtx, ...scopedSignals };
      } catch (err) {
        handleAppError(app, err);
      }
    }

    // 3. جمع‌آوری دایرکتیوهای روی این المان
    const matched: Array<{
      attrName: string;
      expr: string;
      def: DirectiveDefinition;
      arg?: string;
      modifiers: string[];
    }> = [];

    const attrNames = el.getAttributeNames ? el.getAttributeNames() : [];
    for (const attrName of attrNames) {
      const parsed = parseAttrDirective(attrName);
      if (parsed) {
        matched.push({
          attrName,
          expr: el.getAttribute(attrName) ?? '',
          def: parsed.def,
          arg: parsed.arg,
          modifiers: parsed.modifiers,
        });
      }
    }

    // 4. بررسی تداخل دایرکتیوهای ساختاری روی یک المان (ZEN-2302)
    const structuralMatches = matched.filter((m) => m.def.structural);
    if (structuralMatches.length > 1) {
      throw createReservedError('ZEN-2302', {
        details: {
          element: el.tagName,
          directives: structuralMatches.map((m) => m.def.name),
        },
      });
    }

    // 5. مرتب‌سازی بر اساس اولویت (بالاتر زودتر اجرا می‌شود؛ پیش‌فرض 500)
    matched.sort((a, b) => (b.def.priority ?? 500) - (a.def.priority ?? 500));

    const elFrame: ScopeFrame = {
      app,
      disposes: parentFrame.disposes,
      mountCallbacks: [],
      updateCallbacks: [],
      provides: new Map(),
      parent: parentFrame,
    };

    for (const item of matched) {
      const bindCtx: BindContext = {
        expr: item.expr,
        attrName: item.attrName,
        arg: item.arg,
        modifiers: item.modifiers,
        context: currentLocalCtx,
        app,
        processChildren(targetNode, extraCtx) {
          const mergedCtx = extraCtx ? { ...currentLocalCtx, ...extraCtx } : currentLocalCtx;
          walkSubtree(targetNode, state, mergedCtx, elFrame);
        },
        disposes: elFrame.disposes,
        state,
        option(optName: string) {
          return el.getAttribute(`${item.def.name}-${optName}`);
        },
        config<T>(schema: Schema<T>): T {
          return parseConfigAttr(el, `${item.def.name}-options`, schema);
        },
        notifyUpdate() {
          triggerUpdateCallbacks(elFrame);
        },
      };

      const cleanup = runInScope(elFrame, () => item.def.bind(el, bindCtx));
      if (typeof cleanup === 'function') {
        elFrame.disposes.add(cleanup);
      }
      flushMountCallbacks(elFrame);

      // دایرکتیو ساختاری خودش وظیفهٔ پیمایش cloneها را دارد
      if (item.def.structural) {
        return;
      }
    }

    // 6. پیمایش فرزندان
    const children = Array.from(el.children) as HTMLElement[];
    for (const child of children) {
      walkElement(child, state, currentLocalCtx, elFrame);
    }
  }

  function walkSubtree(
    node: HTMLElement,
    state: Record<string, any>,
    localCtx: Record<string, any>,
    parentFrame: ScopeFrame,
  ): void {
    walkElement(node, state, localCtx, parentFrame);
  }

  const app: App = {
    id: appId,
    config: resolvedConfig,

    nextId(): string {
      return `${idPrefix}-${++idCounter}`;
    },

    use<O = any>(pluginOrTuple: Plugin<O> | [Plugin<O>, O], opts?: O): App {
      const [plugin, pluginOpts] = Array.isArray(pluginOrTuple)
        ? [pluginOrTuple[0], pluginOrTuple[1]]
        : [pluginOrTuple, opts];
      if (!plugin || typeof plugin.name !== 'string' || typeof plugin.install !== 'function') {
        return app;
      }
      // پلاگین دوباره‌نصب‌نشدنی (SPEC §۲.۸)
      if (installedPlugins.has(plugin.name)) {
        return app;
      }
      installedPlugins.add(plugin.name);
      const prevApp = currentActiveApp;
      currentActiveApp = app;
      try {
        const cleanup = plugin.install(app, pluginOpts);
        if (typeof cleanup === 'function') {
          appDisposer.add(cleanup);
        }
      } finally {
        currentActiveApp = prevApp;
      }
      return app;
    },

    directive(nameOrDef: string | DirectiveDefinition, maybeDef?: DirectiveDefinition): Cleanup {
      const def: DirectiveDefinition =
        typeof nameOrDef === 'string'
          ? { ...(maybeDef as DirectiveDefinition), name: nameOrDef }
          : nameOrDef;
      if (def.meta) {
        defineDirectiveMeta(def.meta);
      }
      const attrKey = def.name.startsWith('zen-') ? def.name : `zen-${def.name}`;
      directives.set(def.name, def);
      directives.set(attrKey, def);
      let removed = false;
      return () => {
        if (removed) return;
        removed = true;
        if (directives.get(def.name) === def) {
          directives.delete(def.name);
        }
        if (directives.get(attrKey) === def) {
          directives.delete(attrKey);
        }
      };
    },

    provide<T>(key: string | symbol, value: T): App {
      if (currentScope && currentScope.app === app) {
        currentScope.provides.set(key, value);
      } else {
        appProvides.set(key, value);
      }
      return app;
    },

    inject<T>(key: string | symbol, defaultValue?: T): T | undefined {
      if (appProvides.has(key)) {
        return appProvides.get(key) as T;
      }
      return defaultValue;
    },

    addState(values: Record<string, unknown>, options?: { overwrite?: boolean }): App {
      const overwrite = options?.overwrite ?? false;
      for (const [key, value] of Object.entries(values)) {
        if (!overwrite && key in resolvedConfig.state) {
          const msg = `[Zenith] addState: کلید «${key}» قبلاً در state موجود است؛ بازنویسی نشد (overwrite: true برای حالت override).`;
          if (resolvedConfig.warnHandler) {
            resolvedConfig.warnHandler(msg, { key });
          } else {
            resolvedConfig.logger.warn(msg);
          }
          continue;
        }
        resolvedConfig.state[key] = value;
      }
      return app;
    },

    action(name, fn): Cleanup {
      actions.set(name, fn);
      let removed = false;
      return () => {
        if (removed) return;
        removed = true;
        if (actions.get(name) === fn) {
          actions.delete(name);
        }
      };
    },

    mount(root: HTMLElement, stateOverride?: Record<string, any>): Cleanup {
      if (disposed) {
        return () => {};
      }
      // اگر قبلاً روی همین root سوار شده بود، ابتدا پاک‌سازی کن
      const prevDisposer = mountedRoots.get(root);
      if (prevDisposer) {
        prevDisposer.dispose();
        mountedRoots.delete(root);
      }

      const rootDisposer = createDisposer();
      mountedRoots.set(root, rootDisposer);

      const mergedState: Record<string, any> = {
        ...resolvedConfig.state,
        ...(stateOverride ?? {}),
      };
      for (const [actName, actFn] of actions) {
        if (!(actName in mergedState)) {
          mergedState[actName] = actFn;
        }
      }

      const rootFrame: ScopeFrame = {
        app,
        disposes: rootDisposer,
        mountCallbacks: [],
        updateCallbacks: [],
        provides: new Map(),
        parent: null,
      };

      runInScope(rootFrame, () => {
        walkElement(root, mergedState, {}, rootFrame);
      });
      flushMountCallbacks(rootFrame);
      flushSync();

      let unmounted = false;
      return () => {
        if (unmounted) return;
        unmounted = true;
        rootDisposer.dispose();
        if (mountedRoots.get(root) === rootDisposer) {
          mountedRoots.delete(root);
        }
      };
    },

    unmount(): void {
      for (const [root, disposer] of mountedRoots) {
        disposer.dispose();
        mountedRoots.delete(root);
      }
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      app.unmount();
      appDisposer.dispose();
      installedPlugins.clear();
      appProvides.clear();
      actions.clear();
    },
  };

  // نصب پلاگین‌های اولیه در options.plugins
  for (const entry of resolvedConfig.plugins) {
    // #38: entry هم‌نوع PluginEntry است؛ use<O> با O پیش‌فرض خود کشینگ را
    // پوشش می‌دهد و cast توخالی حذف شد.
    app.use(entry);
  }

  return app;
}

// ── Default App Singleton (برای سازگاری Zen.start در @zenith/runtime) ──

let sharedDefaultApp: App | null = null;

export function defaultApp(): App {
  if (!sharedDefaultApp) {
    sharedDefaultApp = createApp();
  }
  return sharedDefaultApp;
}

export function resetDefaultAppForTesting(): void {
  sharedDefaultApp?.dispose();
  sharedDefaultApp = null;
}

// ── Hydration (`hydrate` / `startFromSSR` — SPEC §2.8) ──

export async function hydrate(
  root: HTMLElement,
  init: Record<string, any> | AppOptions = {},
): Promise<HydrationResult> {
  const isAppOpts =
    'state' in init ||
    'plugins' in init ||
    'ssr' in init ||
    'idPrefix' in init ||
    'errorHandler' in init ||
    'warnHandler' in init;

  const appOpts: AppOptions = isAppOpts
    ? (init as AppOptions)
    : { state: init as Record<string, any>, ssr: { preloadState: true, validateHydration: true } };

  const app = createApp(appOpts);
  const state: Record<string, any> = { ...(app.config.state ?? {}) };
  const mismatches: HydrationMismatch[] = [];

  // بررسی state سریال‌شده از سرور (#zenith-state) و نشانگرهای data-zen-h
  const doc = root.ownerDocument;
  if (app.config.ssr.preloadState && doc) {
    const stateEl = doc.getElementById('zenith-state');
    if (stateEl && stateEl.textContent) {
      try {
        const serverState = JSON.parse(stateEl.textContent) as Record<string, unknown>;
        if (app.config.ssr.validateHydration) {
          for (const [k, serverVal] of Object.entries(serverState)) {
            if (k in state) {
              const clientRaw = isReadable(state[k]) ? state[k].get() : state[k];
              if (JSON.stringify(clientRaw) !== JSON.stringify(serverVal)) {
                mismatches.push({ path: `state.${k}`, expected: serverVal, actual: clientRaw });
              }
            }
          }
        }
        for (const [k, serverVal] of Object.entries(serverState)) {
          if (k in state && isWritable(state[k])) {
            state[k].set(serverVal);
          } else if (!(k in state)) {
            state[k] = signal(serverVal);
          }
        }
      } catch (err) {
        handleAppError(app, err);
      }
    }
  }

  // بررسی نشانگرهای data-zen-h روی المان‌های دارای zen-text
  const markedElements = Array.from(root.querySelectorAll('[data-zen-h]')) as HTMLElement[];
  for (const el of markedElements) {
    const markerId = el.getAttribute('data-zen-h') ?? '';
    const textExpr = el.getAttribute('zen-text');
    if (textExpr) {
      const evalCtx = createEvalContext(state, {});
      const expectedVal = evalExpr(textExpr, evalCtx, app);
      const expectedText =
        expectedVal === undefined || expectedVal === null ? '' : String(expectedVal);
      const actualText = el.textContent ?? '';
      if (expectedText !== actualText) {
        mismatches.push({
          path: markerId || textExpr,
          expected: expectedText,
          actual: actualText,
        });
      }
    }
  }

  if (mismatches.length > 0) {
    const mismatchErr = createReservedError('ZEN-2310', {
      details: { mismatches },
    });
    if ((globalThis as { __ZENITH_DEV__?: boolean }).__ZENITH_DEV__ !== false) {
      if (app.config.warnHandler) {
        app.config.warnHandler(mismatchErr.message, { mismatches });
      } else {
        app.config.logger.warn(mismatchErr.message, { mismatches });
      }
    }
    if (app.config.errorHandler) {
      app.config.errorHandler(mismatchErr);
    }
  }

  const cleanup = app.mount(root, state);
  return {
    app,
    cleanup,
    hydrated: true,
    mismatches,
  };
}

export const startFromSSR = hydrate;

// ═══════════════════════════════════════════════════════════════════════════
// #151 & #153 — Accessibility & Headless UI Primitives
// (createFocusTrap, createRovingTabindex, lockScroll, useId, computePosition)
// ═══════════════════════════════════════════════════════════════════════════

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface FocusTrapOptions {
  initialFocus?: string | HTMLElement;
  returnFocus?: boolean;
  escapeDeactivates?: boolean;
  onDeactivate?: () => void;
}

export interface FocusTrap extends Disposable {
  activate(): void;
  deactivate(): void;
  pause(): void;
  unpause(): void;
}

/**
 * #151: ساخت تلهٔ فوکوس (Focus Trap) منطبق با WAI-ARIA APG برای دیالوگ‌ها و منوها.
 */
export function createFocusTrap(container: HTMLElement, options: FocusTrapOptions = {}): FocusTrap {
  const { returnFocus = true, escapeDeactivates = true } = options;
  let active = false;
  let paused = false;
  let previouslyFocused: HTMLElement | null = null;

  const getFocusable = (): HTMLElement[] =>
    Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)) as HTMLElement[];

  const onKeyDown = (e: KeyboardEvent) => {
    if (!active || paused) return;
    if (e.key === 'Escape' && escapeDeactivates) {
      e.preventDefault();
      deactivate();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusables = getFocusable();
    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    const doc = container.ownerDocument ?? document;
    if (e.shiftKey && doc.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && doc.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const activate = () => {
    if (active) return;
    active = true;
    const doc = container.ownerDocument ?? (typeof document !== 'undefined' ? document : null);
    previouslyFocused = (doc?.activeElement as HTMLElement | null) ?? null;
    container.addEventListener('keydown', onKeyDown);
    const focusables = getFocusable();
    let target: HTMLElement | null = null;
    if (typeof options.initialFocus === 'string') {
      target = container.querySelector(options.initialFocus) as HTMLElement | null;
    } else if (options.initialFocus) {
      target = options.initialFocus;
    }
    (target ?? focusables[0] ?? container).focus?.();
  };

  const deactivate = () => {
    if (!active) return;
    active = false;
    container.removeEventListener('keydown', onKeyDown);
    if (returnFocus && previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus();
    }
    options.onDeactivate?.();
  };

  const trap: FocusTrap = {
    activate,
    deactivate,
    pause: () => {
      paused = true;
    },
    unpause: () => {
      paused = false;
    },
    dispose: deactivate,
  };
  if (typeof Symbol !== 'undefined' && Symbol.dispose) {
    (trap as { [Symbol.dispose]?: (() => void) | undefined })[Symbol.dispose] = deactivate;
  }
  return trap;
}

/**
 * #151: مدیریت Roving Tabindex (کلیدهای جهت‌نما + Home/End + RTL) برای تب‌ها، منوها و نوار ابزار.
 */
export function createRovingTabindex(
  container: HTMLElement,
  options: {
    orientation?: 'horizontal' | 'vertical' | 'both';
    loop?: boolean;
    selector?: string;
  } = {},
): () => void {
  const {
    orientation = 'horizontal',
    loop = true,
    selector = '[role="tab"], [role="menuitem"], button',
  } = options;

  const getItems = (): HTMLElement[] =>
    (Array.from(container.querySelectorAll(selector)) as HTMLElement[]).filter(
      (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-disabled') !== 'true',
    );

  const initItems = getItems();
  initItems.forEach((el, idx) => {
    el.setAttribute('tabindex', idx === 0 ? '0' : '-1');
  });

  const onKeyDown = (e: KeyboardEvent) => {
    const items = getItems();
    if (items.length === 0) return;
    const currentIdx = items.indexOf(e.target as HTMLElement);
    if (currentIdx === -1) return;

    const isRtl =
      container.dir === 'rtl' ||
      container.closest('[dir]')?.getAttribute('dir') === 'rtl' ||
      (typeof document !== 'undefined' && document.documentElement.dir === 'rtl');

    let step = 0;
    if (e.key === 'Home') {
      e.preventDefault();
      items[currentIdx]?.setAttribute('tabindex', '-1');
      items[0]?.setAttribute('tabindex', '0');
      items[0]?.focus();
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      const last = items[items.length - 1]!;
      items[currentIdx]?.setAttribute('tabindex', '-1');
      last.setAttribute('tabindex', '0');
      last.focus();
      return;
    }

    if (orientation === 'horizontal' || orientation === 'both') {
      if (e.key === 'ArrowRight') step = isRtl ? -1 : 1;
      else if (e.key === 'ArrowLeft') step = isRtl ? 1 : -1;
    }
    if (orientation === 'vertical' || orientation === 'both') {
      if (e.key === 'ArrowDown') step = 1;
      else if (e.key === 'ArrowUp') step = -1;
    }
    if (step === 0) return;

    e.preventDefault();
    let nextIdx = currentIdx + step;
    if (loop) {
      nextIdx = (nextIdx + items.length) % items.length;
    } else {
      nextIdx = Math.max(0, Math.min(items.length - 1, nextIdx));
    }
    items[currentIdx]?.setAttribute('tabindex', '-1');
    items[nextIdx]?.setAttribute('tabindex', '0');
    items[nextIdx]?.focus();
  };

  container.addEventListener('keydown', onKeyDown);
  let cleaned = false;
  return () => {
    if (cleaned) return;
    cleaned = true;
    container.removeEventListener('keydown', onKeyDown);
  };
}

let _scrollLockCount = 0;
let _savedBodyOverflow = '';

/**
 * #151: قفل شمارنده‌ای اسکرول بدنهٔ صفحه (`lockScroll() -> Cleanup`).
 */
export function lockScroll(
  doc: Document | undefined = typeof document !== 'undefined' ? document : undefined,
): () => void {
  if (!doc || !doc.body) return () => {};
  if (_scrollLockCount === 0) {
    _savedBodyOverflow = doc.body.style.overflow;
    doc.body.style.overflow = 'hidden';
  }
  _scrollLockCount++;
  let unlocked = false;
  return () => {
    if (unlocked) return;
    unlocked = true;
    _scrollLockCount = Math.max(0, _scrollLockCount - 1);
    if (_scrollLockCount === 0 && doc.body) {
      doc.body.style.overflow = _savedBodyOverflow;
    }
  };
}

let _deterministicIdCounter = 0;

/**
 * #151: تولید شناسهٔ قطعی و یکسان در SSR و کلاینت (`useId`).
 */
export function useId(prefix = 'zen-id'): string {
  if (currentScope) {
    const app = currentScope.app as App & { idCounter?: number };
    const next = (app.idCounter ?? 0) + 1;
    app.idCounter = next;
    return `${prefix}-${next}`;
  }
  return `${prefix}-${++_deterministicIdCounter}`;
}

export interface ComputePositionOptions {
  placement?: 'top' | 'bottom' | 'left' | 'right';
  offset?: number;
  flip?: boolean;
}

/**
 * #153: محاسبهٔ مختصات عنصر شناور (Popover/Tooltip/Menu) نسبت به عنصر مرجع با پشتیبانی از `flip`.
 */
export function computePosition(
  reference: HTMLElement,
  floating: HTMLElement,
  options: ComputePositionOptions = {},
): { x: number; y: number; placement: 'top' | 'bottom' | 'left' | 'right' } {
  const offset = options.offset ?? 8;
  let placement = options.placement ?? 'bottom';
  const refRect = reference.getBoundingClientRect();
  const floatRect = floating.getBoundingClientRect();
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight || 768 : 768;

  if (options.flip !== false && placement === 'bottom') {
    if (
      refRect.bottom + floatRect.height + offset > viewportHeight &&
      refRect.top > floatRect.height + offset
    ) {
      placement = 'top';
    }
  }

  let x = refRect.left;
  let y = refRect.bottom + offset;
  if (placement === 'top') {
    y = refRect.top - floatRect.height - offset;
  } else if (placement === 'left') {
    x = refRect.left - floatRect.width - offset;
    y = refRect.top;
  } else if (placement === 'right') {
    x = refRect.right + offset;
    y = refRect.top;
  }
  return { x, y, placement };
}
