import type { Cleanup, Disposable } from '@zenith/shared';
/** @public */
export interface AnalyticsEvent {
  readonly type: 'track' | 'page' | 'identify';
  readonly name: string;
  readonly props?: Readonly<Record<string, unknown>>;
  readonly timestamp: number;
  readonly sessionId?: string;
}
/** @public */
export interface AnalyticsProvider {
  readonly name: string;
  send(event: AnalyticsEvent): void | Promise<void>;
}
/** @public */
export interface AnalyticsOptions {
  providers?: readonly AnalyticsProvider[];
  consent?: { required?: boolean; default?: boolean };
  /** @default true */ respectDNT?: boolean;
  /** @default true */ autoPageViews?: boolean;
  /** Sampling randomness is not used for session IDs. @default 1 */ sampleRate?: number;
  batch?: { size?: number; interval?: number };
  redact?: readonly string[];
  /** @default 1800000 @unit ms */ sessionTimeout?: number;
  /** Upper bound on queued events during a slow transport. @default 100 */ maxQueueSize?: number;
  /** Upper bound on unresolved provider sends. @default 100 */ maxInFlight?: number;
  now?: () => number;
  random?: () => number;
  /** Deterministic tests only. Defaults to a CSPRNG-backed ID. */ sessionIdFactory?: () => string;
}
/** @public */
export interface Analytics extends Disposable {
  track(name: string, props?: Record<string, unknown>): void;
  page(path?: string, props?: Record<string, unknown>): void;
  identify(id: string, traits?: Record<string, unknown>): void;
  setConsent(granted: boolean): void;
  hasConsent(): boolean;
  flush(): Promise<void>;
  use(provider: AnalyticsProvider): Cleanup;
}
/** @deprecated Use Analytics. @public */
export type AnalyticsInstance = Analytics;
