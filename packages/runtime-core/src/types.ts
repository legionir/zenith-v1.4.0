import type { ZenithError } from '@zenith/errors';
import type { Logger } from '@zenith/logger';
import type { DirectiveMeta, Schema } from '@zenith/schema';
import type { Cleanup, Disposable, Disposer } from '@zenith/shared';
import type { AppRegistries } from './registry';

/** @public */
export interface SsrContext {
  app: App;
  state: Record<string, unknown>;
  context: Record<string, unknown>;
  nextHydrationId(): string;
}

/** @public */
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
  context: Record<string, unknown>;
  /** نمونهٔ App مالک */
  app: App;
  /** پیمایش فرزندان با کانتکست اختیاری */
  processChildren(node: HTMLElement, extraCtx?: Record<string, unknown>): Cleanup;
  /** Skip the automatic child walk for owned content, without skipping sibling directives. */
  skipChildren?(): void;
  /** ظرف پاک‌سازی چرخهٔ عمر این المان */
  disposes: Disposer;
  /** آبجکت خام state برنامه */
  state: Record<string, unknown>;
  /** خواندن attribute کمکی `zen-<directive>-<option>` */
  option(name: string): string | null;
  /** خواندن و اعتبارسنجی JSON از `zen-<directive>-options` با `@zenith/schema` */
  config<T>(schema: Schema<T>): T;
  /** ثبت callback که پس از هر به‌روزرسانی واکنش‌گرای این دایرکتیو فراخوانی می‌شود */
  notifyUpdate(): void;
}

/** @public */
export interface DirectiveDefinition {
  name: string;
  /** Optional exact element localName, e.g. zen-date-picker. Explicit attributes bind only once. */
  tag?: string;
  meta?: DirectiveMeta;
  /** اولویت اجرا (بالاتر زودتر اجرا می‌شود؛ پیش‌فرض 500) */
  priority?: number;
  /** آیا دایرکتیو ساختاری است (مثل zen-for / zen-if)؟ */
  structural?: boolean;
  /** zen-state names directive output rather than declaring a JSON local scope. */
  stateOutput?: boolean;
  /** آیا پیشوند attribute با `:` یا `-` را هم تطبیق می‌دهد؟ */
  prefixMatch?: boolean;
  bind(el: HTMLElement, ctx: BindContext): Cleanup | void;
  hydrate?(el: HTMLElement, ctx: BindContext): Cleanup | void;
  ssr?(el: Element, ctx: SsrContext): void;
}

/** @public */
export interface Plugin<O = unknown> {
  name: string;
  version?: string;
  install(app: App, options?: O): void | Cleanup;
}

/** @public */
export type PluginEntry<O = unknown> = Plugin<O> | [Plugin<O>, O];

/** @public */
export interface AppSsrOptions {
  preloadState?: boolean;
  validateHydration?: boolean;
}

/** @public */
export interface AppOptions {
  state?: Record<string, unknown>;
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

/** @public */
export interface ResolvedAppOptions {
  state: Record<string, unknown>;
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

/** @public */
export interface HydrationMismatch {
  path: string;
  expected: unknown;
  actual: unknown;
}

/** @public */
export interface HydrationResult {
  app: App;
  cleanup: Cleanup;
  hydrated: boolean;
  mismatches: HydrationMismatch[];
}

/** @public */
export interface App extends Disposable {
  readonly id: string;
  readonly config: ResolvedAppOptions;
  /** Explicit per-App registry ownership; never shared with other Apps. */
  readonly registries: Readonly<AppRegistries>;
  /** Synchronous owner boundary; re-enter explicitly after an await. */
  run<T>(callback: () => T): T;
  mount(root: HTMLElement, state?: Record<string, unknown>): Cleanup;
  unmount(): void;
  use<O = unknown>(plugin: Plugin<O> | [Plugin<O>, O], options?: O): App;
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
      state: Record<string, unknown>;
      event?: Event;
      el?: HTMLElement;
      app: App;
      args?: unknown[];
    }) => unknown,
  ): Cleanup;
  nextId(): string;
  dispose(): void;
}

