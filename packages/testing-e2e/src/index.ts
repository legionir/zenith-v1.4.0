import { test as base, expect, type Page, type ConsoleMessage } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createReservedError } from '@zenith/errors';
import { TEST_BRIDGE_KEY, TEST_MOUNT_KEY, type TestBridge, type TestMountController, type BrowserMountOptions } from './contract';
export type { BrowserMountOptions, TestPluginModule, TestMountController } from './contract';

import { DEFAULTS, assertE2eOptions, type E2eOptions } from './options';
export { DEFAULTS, e2eOptionsSchema, validateE2eOptions, type E2eOptions } from './options';

/** @public */
export interface ConsoleCapture { readonly errors: readonly string[]; dispose(): void }
const captures = new WeakMap<Page, ConsoleCapture>();
const pageOptions = new WeakMap<Page, E2eOptions>();

function failure(expected: string) { return createReservedError('ZEN-1090', { details: { expected } }); }
function redact(message: string) {
  return message.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').replace(/((?:token|password|cookie|authorization)\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]');
}

/** Begin capture before navigation/boot. @public */
export function captureConsole(page: Page): ConsoleCapture {
  const existing = captures.get(page);
  if (existing) return existing;
  const errors: string[] = [];
  const record = (value: string) => { if (errors.length < 500) errors.push(redact(value).slice(0, 4096)); else if (errors.length === 500) errors.push('[further errors omitted]'); };
  const onConsole = (message: ConsoleMessage) => { if (message.type() === 'error') record(message.text()); };
  const onError = (error: Error) => record(error.message);
  page.on('console', onConsole); page.on('pageerror', onError);
  let disposed = false;
  const capture: ConsoleCapture = { errors, dispose() {
    if (disposed) return;
    disposed = true; page.off('console', onConsole); page.off('pageerror', onError);
    if (captures.get(page) === capture) captures.delete(page);
  } };
  captures.set(page, capture);
  return capture;
}

/** Wait on an application-owned readiness callback, never a fixed sleep. @public */
export async function waitForHydration(page: Page, options: E2eOptions = {}): Promise<void> {
  assertE2eOptions(options);
  const timeout = options.hydrationTimeout ?? DEFAULTS.hydrationTimeout;
  if (!Number.isFinite(timeout) || timeout <= 0) throw failure('positive hydrationTimeout');
  await page.waitForFunction(key => (globalThis as unknown as Record<string, TestBridge>)[key]?.ready() === true, TEST_BRIDGE_KEY, { timeout });
}
/** Mount a real URL, optionally creating an isolated App through its test-only host. @public */
export async function mountApp(page: Page, options: { url?: string } & E2eOptions & Partial<BrowserMountOptions>): Promise<void> {
  captureConsole(page);
  options = { ...pageOptions.get(page), ...options };
  assertE2eOptions(options);
  const timeout = options.hydrationTimeout ?? DEFAULTS.hydrationTimeout;
  if (!Number.isFinite(timeout) || timeout <= 0) throw failure('positive hydrationTimeout');
  const url = options.url ?? options.baseURL;
  if (url) await page.goto(url);
  else if (options.html === undefined) throw failure('a URL or HTML with an installed test mount host');
  if (options.html === undefined && (options.state !== undefined || options.plugins !== undefined)) throw failure('HTML when supplying state/plugins');
  if (options.html !== undefined) {
    await page.waitForFunction(key => typeof (globalThis as unknown as Record<string, TestMountController>)[key]?.mount === 'function', TEST_MOUNT_KEY, { timeout });
    const mounting: BrowserMountOptions = { html: options.html, state: options.state, plugins: options.plugins, idPrefix: options.idPrefix, mountTimeout: options.mountTimeout ?? timeout };
    await page.evaluate(async ({ key, mounting }) => {
      await (globalThis as unknown as Record<string, TestMountController>)[key]!.mount(mounting);
    }, { key: TEST_MOUNT_KEY, mounting });
  }
  await waitForHydration(page, options);
}
/** Explicit cleanup for hosts that stay on the same page between mounts. @public */
export async function unmountApp(page: Page): Promise<void> {
  await page.evaluate(key => (globalThis as unknown as Record<string, TestMountController>)[key]?.unmount(), TEST_MOUNT_KEY);
}
/** @public */
export async function getSignal<T = unknown>(page: Page, name: string): Promise<T> {
  const result = await page.evaluate(({ key, name }) => {
    const bridge = (globalThis as unknown as Record<string, TestBridge>)[key];
    return bridge ? { value: bridge.getSignal(name) } : {};
  }, { key: TEST_BRIDGE_KEY, name });
  if (!('value' in result)) throw failure('test bridge installed');
  return result.value as T;
}
/** @public */
export async function setSignal(page: Page, name: string, value: unknown): Promise<void> {
  const found = await page.evaluate(({ key, name, value }) => {
    const bridge = (globalThis as unknown as Record<string, TestBridge>)[key];
    if (!bridge) return false;
    bridge.setSignal(name, value);
    return true;
  }, { key: TEST_BRIDGE_KEY, name, value });
  if (!found) throw failure('test bridge installed');
}
/** @public */
export async function snapshotDevtools(page: Page): Promise<unknown> {
  const result = await page.evaluate(key => {
    const bridge = (globalThis as unknown as Record<string, TestBridge>)[key];
    return bridge ? { value: bridge.snapshot() } : {};
  }, TEST_BRIDGE_KEY);
  if (!('value' in result)) throw failure('test bridge installed');
  return result.value;
}
/** A missing collector is an error, never a vacuously clean result. @public */
export function expectNoConsoleErrors(page: Page): void {
  const capture = captures.get(page);
  if (!capture) throw failure('console capture before boot');
  expect(capture.errors).toEqual([]);
}
/** @public */
export async function expectNoA11yViolations(page: Page, options: E2eOptions['a11y'] = {}): Promise<void> {
  assertE2eOptions({ a11y: options });
  let axe = new AxeBuilder({ page });
  if (options.rules?.length) axe = axe.withRules(options.rules);
  for (const selector of options.exclude ?? []) axe = axe.exclude(selector);
  const report = await axe.analyze();
  const rank = ['minor', 'moderate', 'serious', 'critical'];
  const minimum = rank.indexOf(options.impact ?? DEFAULTS.a11yImpact);
  expect(report.violations.filter(v => rank.indexOf(v.impact ?? 'minor') >= minimum)).toEqual([]);
}

/** Options can be overridden with test.use({ zenithOptions: ... }). @public */
export const test = base.extend<{ zenithOptions: E2eOptions; _zenithDiagnostics: void }>({
  zenithOptions: [{}, { option: true }],
  _zenithDiagnostics: [async ({ page, zenithOptions }, use, testInfo) => {
    assertE2eOptions(zenithOptions);
    const capture = captureConsole(page);
    pageOptions.set(page, zenithOptions);
    try {
      try { await use(); } finally { if (!page.isClosed()) await unmountApp(page); }
      if (capture.errors.length) await testInfo.attach('zenith-console-errors', { body: JSON.stringify(capture.errors, null, 2), contentType: 'application/json' });
      if (zenithOptions.failOnConsoleError ?? DEFAULTS.failOnConsoleError) expectNoConsoleErrors(page);
    } finally { pageOptions.delete(page); capture.dispose(); }
  }, { auto: true }],
});
export { expect };
