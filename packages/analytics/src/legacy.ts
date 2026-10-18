import { createAnalytics as createEngine } from './analytics';
import type { AnalyticsOptions, Analytics } from './types';
export * from './providers';
export type { AnalyticsEvent, AnalyticsProvider, AnalyticsOptions, AnalyticsInstance } from './types';
/** Preserve immediate legacy dispatch; the standalone engine defaults to bounded batching. @deprecated Import from @zenith/analytics. @public */
export function createAnalytics(options: AnalyticsOptions = {}): Analytics {
  return createEngine({ ...options, batch: options.batch ?? { size: 1, interval: 0 } });
}
