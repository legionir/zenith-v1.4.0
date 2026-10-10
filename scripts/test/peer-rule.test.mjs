// Tests for scripts/peer-rule.mjs (#46).
// Synthetic fixtures + a real-repo acceptance assertion.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkPeerRule } from '../peer-rule.mjs';

let tmp;
beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), 'zen-peer-'));
});
afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function makePkg(root, name, pkgJson, src = '') {
  const dir = join(root, 'packages', name);
  mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkgJson));
  if (src) writeFileSync(join(dir, 'src', 'index.ts'), src);
}

function base(name, extra = {}) {
  return { name: `@zenith/${name}`, version: '1.4.0', ...extra };
}

describe('checkPeerRule (synthetic)', () => {
  it('passes a compliant workspace', () => {
    const root = join(tmp, 'ok');
    makePkg(root, 'state', base('state', { dependencies: { '@zenith/scheduler': '1.4.0' } }));
    makePkg(root, 'scheduler', base('scheduler'));
    makePkg(
      root,
      'consumer',
      base('consumer', { peerDependencies: { '@zenith/state': '^1.4.0' } }),
    );
    expect(checkPeerRule(join(root, 'packages'), '1.4.0')).toEqual([]);
  });

  it('flags a consumer that keeps state as a runtime dependency', () => {
    const root = join(tmp, 'bad-dep');
    makePkg(root, 'state', base('state', { dependencies: { '@zenith/scheduler': '1.4.0' } }));
    makePkg(root, 'scheduler', base('scheduler'));
    makePkg(root, 'consumer', base('consumer', { dependencies: { '@zenith/state': '1.4.0' } }));
    const v = checkPeerRule(join(root, 'packages'), '1.4.0');
    expect(v.some((x) => x.includes('consumer') && x.includes('@zenith/state'))).toBe(true);
  });

  it('flags an exact-pinned peer range instead of caret', () => {
    const root = join(tmp, 'bad-range');
    makePkg(root, 'state', base('state', { dependencies: { '@zenith/scheduler': '1.4.0' } }));
    makePkg(root, 'scheduler', base('scheduler'));
    makePkg(root, 'consumer', base('consumer', { peerDependencies: { '@zenith/state': '1.4.0' } }));
    const v = checkPeerRule(join(root, 'packages'), '1.4.0');
    expect(v.some((x) => x.includes('peer') && x.includes('range'))).toBe(true);
  });

  it('flags removal of the allowed state→scheduler dependency', () => {
    const root = join(tmp, 'bad-core');
    makePkg(root, 'state', base('state')); // scheduler dependency missing
    makePkg(root, 'scheduler', base('scheduler'));
    const v = checkPeerRule(join(root, 'packages'), '1.4.0');
    expect(v.some((x) => x.includes('state: @zenith/scheduler'))).toBe(true);
  });

  it('flags a src file that imports state but declares no peer', () => {
    const root = join(tmp, 'bad-import');
    makePkg(root, 'state', base('state', { dependencies: { '@zenith/scheduler': '1.4.0' } }));
    makePkg(root, 'scheduler', base('scheduler'));
    makePkg(
      root,
      'consumer',
      base('consumer'),
      `import { signal } from '@zenith/state';\nexport const s = signal(1);\n`,
    );
    const v = checkPeerRule(join(root, 'packages'), '1.4.0');
    expect(v.some((x) => x.includes('imports @zenith/state') && x.includes('consumer'))).toBe(true);
  });

  it('does NOT flag a test-only import of state (runs inside the workspace)', () => {
    const root = join(tmp, 'test-only');
    makePkg(root, 'state', base('state', { dependencies: { '@zenith/scheduler': '1.4.0' } }));
    makePkg(root, 'scheduler', base('scheduler'));
    const dir = join(root, 'packages', 'consumer');
    mkdirSync(join(dir, 'test'), { recursive: true });
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify(base('consumer')));
    writeFileSync(join(dir, 'src', 'index.ts'), `export const x = 1;\n`);
    writeFileSync(
      join(dir, 'test', 'a.test.ts'),
      `import { flushSync } from '@zenith/scheduler';\nvoid flushSync;\n`,
    );
    const v = checkPeerRule(join(root, 'packages'), '1.4.0');
    expect(v).toEqual([]);
  });
});

describe('checkPeerRule (real repo)', () => {
  it('all packages follow the state/scheduler peer rule (#46 acceptance)', () => {
    const violations = checkPeerRule(join(process.cwd(), 'packages'), '1.4.0');
    if (violations.length > 0) {
      throw new Error('peer-rule violations:\n  ' + violations.join('\n  '));
    }
    expect(violations).toEqual([]);
  });
});
