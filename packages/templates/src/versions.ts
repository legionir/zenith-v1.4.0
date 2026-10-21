/**
 * Pinned dependency versions for generated projects (#158).
 *
 * This table is a verbatim copy of the version authority in
 * `packages/cli/src/templates/versions.ts`. It is duplicated (not imported)
 * because the CLI resolves build-time versions through the
 * `__ZENITH_PACKAGE_VERSIONS__` esbuild define, which does not exist for
 * consumers of this published package. The CLI table remains the authority
 * that is refreshed at release time; #109 unifies the two.
 *
 * @packageDocumentation
 */

/** @public */
export const TEMPLATE_PACKAGE_VERSIONS: Readonly<Record<string, string>> = {
  '@zenith/actions': '1.4.0',
  '@zenith/auth-oauth': '1.4.0',
  '@zenith/auth': '1.4.0',
  '@zenith/cache': '1.5.0',
  '@zenith/charts': '1.4.0',
  '@zenith/cli': '1.4.0',
  '@zenith/compiler': '1.4.0',
  '@zenith/components': '1.4.0',
  '@zenith/crud': '1.4.0',
  '@zenith/data-table': '1.4.0',
  '@zenith/data': '1.4.0',
  '@zenith/dependency-graph': '1.4.0',
  '@zenith/devtools-core': '1.5.0',
  '@zenith/a11y': '1.5.0',
  '@zenith/head': '1.5.0',
  '@zenith/devtools': '1.4.0',
  '@zenith/error-boundary': '1.4.0',
  '@zenith/errors': '1.4.0',
  '@zenith/events': '1.4.0',
  '@zenith/expressions': '1.4.0',
  '@zenith/feature-flags': '1.4.0',
  '@zenith/form': '1.4.0',
  '@zenith/http': '1.4.0',
  '@zenith/i18n': '1.4.0',
  '@zenith/icons': '1.4.0',
  '@zenith/jalali': '1.5.0',
  '@zenith/language-server': '1.4.0',
  '@zenith/logger': '1.5.0',
  '@zenith/notifications': '1.4.0',
  '@zenith/permission': '1.4.0',
  '@zenith/resource': '1.4.0',
  '@zenith/router': '1.4.0',
  '@zenith/runtime-core': '1.5.0',
  '@zenith/runtime': '1.4.0',
  '@zenith/scheduler': '1.4.0',
  '@zenith/schema': '1.5.0',
  '@zenith/security': '1.4.0',
  '@zenith/service-worker': '1.4.0',
  '@zenith/shared': '1.5.0',
  '@zenith/ssr': '1.4.0',
  '@zenith/state': '1.4.0',
  '@zenith/stateful': '1.4.0',
  '@zenith/storage': '1.5.0',
  '@zenith/store': '1.4.0',
  '@zenith/suspense': '1.4.0',
  '@zenith/testing': '1.4.0',
  '@zenith/theme': '1.4.0',
  '@zenith/transition': '1.4.0',
  '@zenith/virtual-list': '1.4.0',
  '@zenith/vite-plugin': '1.4.0',
  '@zenith/adapter-edge': '1.5.0',
  zenith: '1.5.0',
  '@zenith/adapter-node': '1.5.0',
  '@zenith/analytics': '1.5.0',
  '@zenith/eslint-plugin': '1.5.0',
  '@zenith/mock': '1.5.0',
  '@zenith/realtime': '1.5.0',
  '@zenith/testing-e2e': '1.5.0',
  '@zenith/ui': '1.5.0',
};

/**
 * Resolve a caret range for a Zenith package used by generated projects.
 *
 * @public
 */
export function dependencyVersion(name: string): string {
  const version = TEMPLATE_PACKAGE_VERSIONS[name];
  if (!version) throw new RangeError(`Unknown Zenith package: ${name}`);
  return `^${version}`;
}
