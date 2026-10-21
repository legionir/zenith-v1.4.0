import { logger } from '@zenith/logger';
import { createReservedError } from '@zenith/errors';
import type { AnalyticsEvent, AnalyticsProvider } from './types';

/** Diagnostics flow through the configured logger sink, not a second console path. @public */
export function consoleProvider(sink: (event: AnalyticsEvent) => void = event => logger.info('analytics', { event })): AnalyticsProvider {
  return { name: 'console', send: sink };
}
/** No request is made until the engine dispatches an already-consented event. @public */
export function beaconProvider(options: { url: string; sendBeacon?: (url: string, data: string) => boolean }): AnalyticsProvider {
  return { name: 'beacon', send(event) {
    if (typeof window === 'undefined') return;
    const send = options.sendBeacon ?? globalThis.navigator?.sendBeacon?.bind(globalThis.navigator);
    if (!send || !send(options.url, JSON.stringify(event))) throw createReservedError('ZEN-1901');
  } };
}
/** @public */
export function gtagProvider(options: { id: string }): AnalyticsProvider {
  return { name: `gtag:${options.id}`, send(event) {
    const gtag = (globalThis as { gtag?: (command: string, name: string, parameters: Record<string, unknown>) => void }).gtag;
    if (typeof gtag !== 'function') throw createReservedError('ZEN-1901');
    gtag('event', event.type === 'page' ? 'page_view' : event.name, { ...event.props, ...(event.type === 'page' ? { page_path: event.name } : {}), send_to: options.id });
  } };
}
/** @public */
export function plausibleProvider(options: { domain: string }): AnalyticsProvider {
  return { name: `plausible:${options.domain}`, send(event) {
    const plausible = (globalThis as { plausible?: (name: string, options: { props: Record<string, unknown>; domain: string }) => void }).plausible;
    if (typeof plausible !== 'function') throw createReservedError('ZEN-1901');
    plausible(event.type === 'page' ? 'pageview' : event.name, { props: { ...event.props, ...(event.type === 'page' ? { path: event.name } : {}) }, domain: options.domain });
  } };
}
