/** @packageDocumentation Consent-first client analytics; all server dispatches are no-ops. */
export { createAnalytics, doNotTrack, DEFAULTS, analyticsOptionsSchema, validateAnalyticsOptions } from './analytics';
export { consoleProvider, beaconProvider, gtagProvider, plausibleProvider } from './providers';
export { bindTrack } from './directive';
export { analyticsPlugin } from './plugin';
export type { Analytics, AnalyticsInstance, AnalyticsEvent, AnalyticsProvider, AnalyticsOptions } from './types';
export type { TrackBindingOptions } from './directive';
export type { AnalyticsAppHost, AnalyticsPluginOptions } from './plugin';
