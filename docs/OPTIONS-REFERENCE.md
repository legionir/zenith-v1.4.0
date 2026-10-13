# مرجع خودکار گزینه‌ها و پیش‌فرض‌های منجمد (`DEFAULTS` — `#53`)

این سند از استخراج خودکار اینترفیس‌های `*Options` و ثابت‌های منجمد `DEFAULTS` در تمام پکیج‌های `@zenith/*` تولید شده است.

| پکیج | اینترفیس(های) Options | ثابت(های) Frozen DEFAULTS |
|---|---|---|
| `@zenith/auth` | — | `AUTH_CONFIG_DEFAULTS`, `FUNCTIONAL_AUTH_CONFIG_DEFAULTS` |
| `@zenith/cache` | `CacheOptions`, `EntryOptions` | `DEFAULTS` |
| `@zenith/cli` | `LighthouseOptions` | `DEFAULTS` |
| `@zenith/compiler` | `CompilerOptions` | `DEFAULTS` |
| `@zenith/components` | `LoadComponentOptions` | `DEFAULTS` |
| `@zenith/data` | `InfiniteQueryOptions`, `MutationOptions` | `DEFAULTS` |
| `@zenith/data-table` | `DataTableOptions`, `CsvExportOptions` | `DEFAULTS` |
| `@zenith/devtools-core` | `DevtoolsCoreOptions` | `DEVTOOLS_CORE_DEFAULTS` |
| `@zenith/error-boundary` | `ErrorReporterOptions`, `ErrorBoundaryRetryOptions`, `ErrorBoundaryOptions` | `DEFAULTS` |
| `@zenith/events` | `InitEventDelegationOptions` | `DEFAULTS` |
| `@zenith/form` | `FormOptions`, `AdvancedFormOptions` | `DEFAULTS` |
| `@zenith/http` | `ZenithHttpOptions`, `HttpRequestOptions`, `RealtimeOptions` | `RETRY_CONFIG_DEFAULTS`, `CACHE_CONFIG_DEFAULTS`, `HTTP_REQUEST_OPTIONS_DEFAULTS` |
| `@zenith/i18n` | `I18nOptions`, `TranslateOptions` | `DEFAULTS` |
| `@zenith/jalali` | `JalaliOptions` | `DEFAULTS` |
| `@zenith/logger` | `OnceOptions`, `ConsoleSinkOptions`, `BufferSinkOptions`, `BeaconSinkOptions`, `LoggerOptions` | `DEFAULTS` |
| `@zenith/notifications` | `NotifyOptions`, `ConfirmOptions`, `AlertOptions` | `DEFAULTS` |
| `@zenith/router` | `NavigateOptions`, `RouteAnnouncerOptions` | `DEFAULTS` |
| `@zenith/runtime` | `ZenStartOptions` | `ZEN_START_OPTIONS_DEFAULTS` |
| `@zenith/runtime-core` | `AppSsrOptions`, `AppOptions`, `ResolvedAppOptions`, `FocusTrapOptions`, `ComputePositionOptions` | `APP_OPTIONS_DEFAULTS` |
| `@zenith/schema` | `ValidateOptions`, `DefinedOptions` | `DEFAULTS` |
| `@zenith/security` | `SanitizeOptions`, `CSPOptions` | `DEFAULTS` |
| `@zenith/service-worker` | `RegisterSWOptions`, `UnregisterSWOptions` | `ROUTE_CONFIG_DEFAULTS`, `SW_CONFIG_DEFAULTS`, `REGISTER_SW_OPTIONS_DEFAULTS`, `SW_RUNTIME_CONFIG_DEFAULTS` |
| `@zenith/ssr` | `RenderOptions`, `StreamOptions`, `SSRAdapterOptions` | `DEFAULTS` |
| `@zenith/state` | `AsyncOptions`, `WatchOptions` | `DEFAULTS` |
| `@zenith/storage` | `CookieOptions`, `IDBOptions`, `SetOptions`, `StorageOptions`, `PersistOptions` | `DEFAULTS` |
| `@zenith/store` | `StorePersistOptions` | `DEFAULTS` |
| `@zenith/suspense` | `SuspenseContextOptions`, `SuspenseOptions`, `TrackPromiseOptions`, `WithTimeoutOptions` | `DEFAULTS` |
| `@zenith/testing` | `A11yAuditOptions` | `DEFAULTS` |
| `@zenith/transition` | `TransitionOptions`, `AnimateCallOptions`, `AnimateDirectionOptions` | `DEFAULTS` |
| `@zenith/virtual-list` | `VirtualListOptions` | `DEFAULTS` |
| `@zenith/vite-plugin` | `VitePluginCompileOptions`, `ZenithPluginOptions` | `COMPILE_OPTIONS_DEFAULTS`, `ZENITH_PLUGIN_OPTIONS_DEFAULTS` |
| `@zenith/zenith` | `ZenithOptions`, `WatchOptions` | `ZENITH_OPTIONS_DEFAULTS` |
