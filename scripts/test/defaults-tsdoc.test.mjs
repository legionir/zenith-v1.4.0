import { describe, it, expect } from 'vitest';
import { checkDefaultsAndTsdoc } from '../check-defaults-tsdoc.mjs';
import { DEFAULTS as cacheDefaults } from '../../packages/cache/src/index.ts';
import { DEFAULTS as compilerDefaults } from '../../packages/compiler/src/index.ts';
import { DEFAULTS as dataDefaults } from '../../packages/data/src/index.ts';
import { DEFAULTS as dataTableDefaults } from '../../packages/data-table/src/index.ts';
import { DEFAULTS as errorBoundaryDefaults } from '../../packages/error-boundary/src/index.ts';
import { DEFAULTS as eventsDefaults } from '../../packages/events/src/index.ts';
import { DEFAULTS as formDefaults } from '../../packages/form/src/index.ts';
import { DEFAULTS as jalaliDefaults } from '../../packages/jalali/src/index.ts';
import { DEFAULTS as loggerDefaults } from '../../packages/logger/src/index.ts';
import { DEFAULTS as notificationsDefaults } from '../../packages/notifications/src/index.ts';
import { DEFAULTS as routerDefaults } from '../../packages/router/src/index.ts';
import { DEFAULTS as schemaDefaults } from '../../packages/schema/src/index.ts';
import { DEFAULTS as securityDefaults } from '../../packages/security/src/index.ts';
import { DEFAULTS as ssrDefaults } from '../../packages/ssr/src/index.ts';
import { DEFAULTS as storageDefaults } from '../../packages/storage/src/index.ts';
import { DEFAULTS as suspenseDefaults } from '../../packages/suspense/src/index.ts';
import { DEFAULTS as transitionDefaults } from '../../packages/transition/src/index.ts';
import { DEFAULTS as virtualListDefaults } from '../../packages/virtual-list/src/index.ts';

describe('Frozen DEFAULTS & Options reference (#53)', () => {
  it('ensures every package with *Options exports a DEFAULTS constant and docs/OPTIONS-REFERENCE.md exists', () => {
    const res = checkDefaultsAndTsdoc(process.cwd());
    expect(res.errors).toEqual([]);
    expect(res.ok).toBe(true);
    expect(res.count).toBeGreaterThanOrEqual(25);
  });

  it('freezes all exported DEFAULTS objects against runtime mutation', () => {
    const allDefaults = [
      cacheDefaults,
      compilerDefaults,
      dataDefaults,
      dataTableDefaults,
      errorBoundaryDefaults,
      eventsDefaults,
      formDefaults,
      jalaliDefaults,
      loggerDefaults,
      notificationsDefaults,
      routerDefaults,
      schemaDefaults,
      securityDefaults,
      ssrDefaults,
      storageDefaults,
      suspenseDefaults,
      transitionDefaults,
      virtualListDefaults,
    ];
    for (const def of allDefaults) {
      expect(Object.isFrozen(def)).toBe(true);
    }
  });
});
