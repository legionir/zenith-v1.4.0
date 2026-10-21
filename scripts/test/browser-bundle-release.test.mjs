// scripts/test/browser-bundle-release.test.mjs
// #76 — every release produces zenith.min.js + separate sourcemap + integrity.json (sha384),
// under an immutable <version>/ directory and a moving latest/ alias, and the bundle version
// equals the package version (and what the bundle reports at runtime).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { buildBrowserBundles, lockstepViolations, sriOf } from '../build-browser-bundle.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const umbrellaVersion = JSON.parse(
  readFileSync(join(root, 'packages', 'zenith', 'package.json'), 'utf8'),
).version;
let out;
let result;

beforeAll(async () => {
  out = mkdtempSync(join(tmpdir(), 'zenith-bundles-'));
  result = await buildBrowserBundles({ root, out });
}, 120_000);
afterAll(() => rmSync(out, { recursive: true, force: true }));

const read = (...p) => readFileSync(join(out, ...p));

describe('#76 release bundle layout and integrity', () => {
  it('writes <version>/ with minified js, separate map and integrity.json; plus latest/', () => {
    for (const dir of [umbrellaVersion, 'latest']) {
      for (const f of [
        'zenith.min.js',
        'zenith.min.js.map',
        'zenith-runtime.js',
        'zenith-runtime.js.map',
        'integrity.json',
      ]) {
        expect(existsSync(join(out, dir, f)), `${dir}/${f}`).toBe(true);
      }
    }
  });

  it('integrity.json hashes (sha384, SRI format) match the real bytes', () => {
    const m = JSON.parse(read(umbrellaVersion, 'integrity.json').toString());
    expect(m).toMatchObject({ version: umbrellaVersion, algorithm: 'sha384', pinned: true });
    expect(Object.keys(m.files).sort()).toEqual([
      'zenith-runtime.js',
      'zenith-runtime.js.map',
      'zenith.min.js',
      'zenith.min.js.map',
    ]);
    for (const [name, { integrity, bytes }] of Object.entries(m.files)) {
      const buf = read(umbrellaVersion, name);
      expect(buf.length, `${name} size`).toBe(bytes);
      expect(integrity).toMatch(/^sha384-[A-Za-z0-9+/]+={0,2}$/);
      expect(integrity).toBe('sha384-' + createHash('sha384').update(buf).digest('base64'));
      expect(sriOf(buf)).toBe(integrity);
    }
  });

  it('is minified, and the sourcemap is a separate valid file referenced by a comment', () => {
    const js = read(umbrellaVersion, 'zenith.min.js').toString();
    // minified output keeps only a few newlines (inside template literals): avg line is huge
    expect(js.length / js.split('\n').length, 'average line length').toBeGreaterThan(2000);
    expect(js.trimEnd().endsWith('//# sourceMappingURL=zenith.min.js.map')).toBe(true);
    const map = JSON.parse(read(umbrellaVersion, 'zenith.min.js.map').toString());
    expect(map.version).toBe(3);
    expect(map.sources.length).toBeGreaterThan(10);
    expect(js).not.toContain('"sources"');
  });

  it('latest/ carries the same bytes but is flagged as not pinnable', () => {
    for (const f of ['zenith.min.js', 'zenith.min.js.map', 'zenith-runtime.js']) {
      expect(read('latest', f).equals(read(umbrellaVersion, f)), f).toBe(true);
    }
    const latest = JSON.parse(read('latest', 'integrity.json').toString());
    expect(latest.pinned).toBe(false);
    expect(latest.version).toBe(umbrellaVersion);
    expect(latest.note).toMatch(/pin SRI/);
  });

  it('keeps the legacy flat zenith-runtime.js used by the size budget and README', () => {
    expect(read('zenith-runtime.js').equals(read(umbrellaVersion, 'zenith-runtime.js'))).toBe(true);
    expect(result.version).toBe(umbrellaVersion);
  });
});

describe('#76 version coherence', () => {
  it('the bundle reports exactly its directory version at runtime (Zenith.version)', () => {
    const sandbox = { window: {}, structuredClone };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(read(umbrellaVersion, 'zenith.min.js').toString(), sandbox);
    expect(sandbox.Zenith.version).toBe(umbrellaVersion);
    expect(typeof sandbox.Zenith.createApp).toBe('function');
    expect(typeof sandbox.Zenith.signal).toBe('function');
    expect(read(umbrellaVersion, 'zenith.min.js').toString()).toContain(
      `zenith v${umbrellaVersion}`,
    );
  });

  it('lockstepViolations lists only packages that differ', () => {
    expect(
      lockstepViolations(
        [
          { name: 'a', version: '1.5.0' },
          { name: 'b', version: '1.4.0' },
        ],
        '1.5.0',
      ),
    ).toEqual(['b@1.4.0']);
    expect(lockstepViolations([{ name: 'a', version: '1.5.0' }], '1.5.0')).toEqual([]);
  });

  function fakeRoot({ umbrella, core, others = {} }) {
    const dir = mkdtempSync(join(tmpdir(), 'fake-root-'));
    const put = (rel, body) => {
      mkdirSync(dirname(join(dir, rel)), { recursive: true });
      writeFileSync(join(dir, rel), body);
    };
    put('packages/zenith/package.json', JSON.stringify({ name: 'zenith', version: umbrella }));
    put(
      'packages/runtime-core/src/index.ts',
      `export const ZENITH_RUNTIME_CORE_VERSION = '${core}';`,
    );
    for (const [n, v] of Object.entries(others)) {
      put(`packages/${n}/package.json`, JSON.stringify({ name: `@zenith/${n}`, version: v }));
    }
    return dir;
  }

  it('fails when the umbrella version and the reported runtime version disagree', async () => {
    const dir = fakeRoot({ umbrella: '2.0.0', core: '1.5.0' });
    await expect(buildBrowserBundles({ root: dir, out: join(dir, 'o') })).rejects.toThrow(
      /version mismatch.*2\.0\.0.*1\.5\.0/s,
    );
    rmSync(dir, { recursive: true, force: true });
  });

  it('--require-lockstep fails when any workspace package has another version', async () => {
    const dir = fakeRoot({ umbrella: '1.5.0', core: '1.5.0', others: { state: '1.4.0' } });
    await expect(
      buildBrowserBundles({ root: dir, out: join(dir, 'o'), requireLockstep: true }),
    ).rejects.toThrow(/lockstep violation.*@zenith\/state@1\.4\.0/s);
    rmSync(dir, { recursive: true, force: true });
  });
});
