/**
 * Local fail-closed preflight, not evidence that npm/GitHub owner settings exist.
 * Inspect credential variable names only; never return or log their values.
 */
export function releasePolicy({ env, version, npmVersion, skipChecks = false, allowDirty = false, registry = null }) {
  if (skipChecks || allowDirty) return 'Public publication cannot skip checks or allow a dirty checkout.';
  if (registry && registry !== 'https://registry.npmjs.org') return 'Trusted publication only targets the canonical npm registry.';
  if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_EVENT_NAME !== 'push' || env.GITHUB_REF_TYPE !== 'tag') return 'Public publication requires a GitHub Actions tag-push event.';
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/.test(version ?? '') || env.GITHUB_REF !== `refs/tags/v${version}`) return 'The release tag must exactly match every package version.';
  if (!Object.hasOwn(env, 'ACTIONS_ID_TOKEN_REQUEST_URL') || !Object.hasOwn(env, 'ACTIONS_ID_TOKEN_REQUEST_TOKEN')) return 'GitHub OIDC permission is required for publication.';
  if (Object.hasOwn(env, 'NPM_TOKEN') || Object.hasOwn(env, 'NODE_AUTH_TOKEN')) return 'Long-lived npm token variables are not permitted in the OIDC release job.';
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(npmVersion).trim());
  if (!match || Number(match[1]) < 11 || (Number(match[1]) === 11 && (Number(match[2]) < 5 || (Number(match[2]) === 5 && Number(match[3]) < 1)))) return 'npm >=11.5.1 is required for Trusted Publishing.';
  return null;
}
