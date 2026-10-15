// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  initEventDelegation,
  setLinkNavigationHandler,
  getLinkNavigationHandler,
} from '../src/index';

describe('#48 & #49 reverse dependency removal & layer boundaries', () => {
  it('@zenith/events has no dependency on @zenith/router in package.json or source', () => {
    const pkgJson = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8'));
    expect(pkgJson.dependencies?.['@zenith/router']).toBeUndefined();
    expect(pkgJson.peerDependencies?.['@zenith/router']).toBeUndefined();

    const delegationSrc = readFileSync(resolve(__dirname, '../src/delegation.ts'), 'utf8');
    expect(delegationSrc).not.toContain("'@zenith/router'");
  });

  it('delegates [zen-link] clicks via setLinkNavigationHandler and restores on cleanup', () => {
    const navigated: string[] = [];
    const cleanupNav = setLinkNavigationHandler((path) => {
      navigated.push(path);
    });
    expect(typeof getLinkNavigationHandler()).toBe('function');

    const root = document.createElement('div');
    root.innerHTML = `<a id="nav-link" zen-link="/dashboard" href="/fallback">Dashboard</a>`;
    document.body.appendChild(root);

    const teardown = initEventDelegation({}, { root });
    const link = root.querySelector('#nav-link') as HTMLElement;
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(navigated).toEqual(['/dashboard']);

    teardown();
    cleanupNav();
    cleanupNav(); // idempotent
    root.remove();
  });
});
