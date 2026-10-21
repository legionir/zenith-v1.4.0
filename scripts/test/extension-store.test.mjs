import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const EXT = join(ROOT, 'tools', 'devtools-extension');

describe('extension store package: policy matches code (#97)', () => {
  it('declares least-privilege permissions with no silent global access', () => {
    const manifest = JSON.parse(readFileSync(join(EXT, 'manifest.json'), 'utf8'));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(manifest.name).toBeTruthy();
    expect(manifest.description).toBeTruthy();
    // least privilege: exactly these three, used in background/popup.
    expect([...manifest.permissions].sort()).toEqual(['activeTab', 'notifications', 'scripting']);
    // no silent all-urls access — cross-tab inspection is opt-in only.
    expect(manifest.host_permissions ?? []).toEqual([]);
    expect(manifest.optional_host_permissions).toContain('https://*/*');
  });

  it('ships the privacy policy and documents every permission in it', () => {
    const manifest = JSON.parse(readFileSync(join(EXT, 'manifest.json'), 'utf8'));
    const policy = readFileSync(join(EXT, 'PRIVACY.md'), 'utf8');
    for (const perm of manifest.permissions) {
      expect(policy, perm).toContain(`\`${perm}\``);
    }
    for (const host of manifest.optional_host_permissions ?? []) {
      expect(policy, host).toContain(host);
    }
    // the headline promises must hold: no collection, no transmission.
    expect(policy).toMatch(/collects nothing/i);
    expect(policy).toMatch(/transmits nothing|makes zero network requests/i);
  });

  it('wires the policy into the installable package build', () => {
    const build = readFileSync(join(ROOT, 'scripts', 'build-tools.mjs'), 'utf8');
    expect(build).toContain('PRIVACY.md');
    // Firefox build declares zero data collection.
    expect(build).toContain("data_collection_permissions: { required: ['none'] }");
  });
});
