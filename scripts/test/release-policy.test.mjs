import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { releasePolicy } from '../lib/release-policy.mjs';

const fixture = () => ({
  env: { GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'push', GITHUB_REF_TYPE: 'tag', GITHUB_REF: 'refs/tags/v1.5.0', ACTIONS_ID_TOKEN_REQUEST_URL: 'unit-fixture', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'unit-fixture' },
  version: '1.5.0', npmVersion: '11.21.1',
});

describe('fail-closed release policy (#66; unit fixtures are not live owner evidence)', () => {
  it('accepts a version-matched tag event with the OIDC-capable client', () => {
    expect(releasePolicy(fixture())).toBeNull();
    const prerelease = fixture(); prerelease.version = '1.5.0-beta.1'; prerelease.env.GITHUB_REF = 'refs/tags/v1.5.0-beta.1';
    expect(releasePolicy(prerelease)).toBeNull();
  });
  it('rejects branch pushes, pull requests, workflow dispatches and mismatched tags', () => {
    for (const update of [{ GITHUB_REF_TYPE: 'branch' }, { GITHUB_EVENT_NAME: 'pull_request' }, { GITHUB_EVENT_NAME: 'workflow_dispatch' }, { GITHUB_REF: 'refs/tags/v9.0.0' }, { GITHUB_ACTIONS: 'false' }]) {
      const value = fixture(); Object.assign(value.env, update); expect(releasePolicy(value)).not.toBeNull();
    }
  });
  it('cannot bypass gates, dirty-state checks or the canonical registry for real publication', () => {
    for (const update of [{ skipChecks: true }, { allowDirty: true }, { registry: 'https://example.invalid' }]) expect(releasePolicy({ ...fixture(), ...update })).not.toBeNull();
  });
  it('requires OIDC permission and never includes a token value in the refusal', () => {
    const absent = fixture(); delete absent.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
    expect(releasePolicy(absent)).toContain('OIDC');
    for (const name of ['NPM_TOKEN', 'NODE_AUTH_TOKEN']) {
      const value = fixture(); value.env[name] = 'private-unit-fixture-value';
      expect(releasePolicy(value)).toContain('token variables');
      expect(releasePolicy(value)).not.toContain('private-unit-fixture-value');
    }
  });
  it('rejects clients predating Trusted Publishing, including npm 11.5.0', () => {
    for (const npmVersion of ['10.9.3', '11.4.9', '11.5.0', 'not-a-version']) expect(releasePolicy({ ...fixture(), npmVersion })).not.toBeNull();
    expect(releasePolicy({ ...fixture(), npmVersion: '11.5.1' })).toBeNull();
  });
  it('wires signature/API/pack/browser/audit gates into actual publication code', () => {
    const script = readFileSync('scripts/release.mjs', 'utf8');
    for (const gate of ['api:strict', 'attw', 'pack:audit', 'install-import', 'dts-parity', 'test:e2e', '--audit-level=low']) expect(script).toContain(gate);
    const workflow = readFileSync('.github/workflows/release.yml', 'utf8');
    expect(workflow).toContain('npm@11.21.1');
    expect(workflow).toContain('environment: release');
    expect(workflow).not.toContain('registry-url:');
    const main = readFileSync('.github/workflows/main.yml', 'utf8');
    expect(main).toContain('run: npm run api:strict');
    expect(main).toContain('declaration-api-reports');
  });
});
